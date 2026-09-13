import type { InputItem, ThreadNotification, ThreadListEntry } from "../../../thread-window-web/src/protocol/threadProtocol.ts";
import { encodePermissionAnswer, encodeWorkspaceAnswer } from "../../../thread-window-web/src/protocol/threadProtocol.ts";
import { makeThreadWindowStore } from "../../../thread-window-web/src/store/threadWindowStore.ts";
import { pendingInitialMessage } from "../../../thread-window-web/src/store/inputHandoff.ts";
import type { AssistantMessageItem } from "../../../thread-window-web/src/store/threadItems.ts";
import { ThreadSocketClient } from "../../../thread-window-web/src/thread/threadSocketClient.ts";
import { ThreadInputController } from "../../../thread-window-web/src/thread/threadInputController.ts";

export type PetDropTarget = "pet" | "conversation";
export type PetSnapshot = {
  threadId: string | null;
  bubbleVisible: boolean;
  latestAssistant?: AssistantMessageItem;
  connection: "disconnected" | "connecting" | "connected";
};

/** A lightweight view of the same Thread store used by the full window. */
export class PetThreadController {
  readonly store = makeThreadWindowStore();
  private readonly socket: ThreadSocketClient;
  private readonly inputs: ThreadInputController;
  private readonly listeners = new Set<() => void>();
  private currentThread: { id: string; createdAt: string } | null = null;
  private visibility: "startup" | "visible" | "hidden" = "startup";
  private snapshot: PetSnapshot = { threadId: null, bubbleVisible: false, connection: "disconnected" };
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private closed = true;
  private initialReply?: { id: string; threadId?: string; resolve(): void; reject(error: Error): void };

  constructor(options: Pick<ConstructorParameters<typeof ThreadSocketClient>[0], "url" | "WebSocketImpl">) {
    this.socket = new ThreadSocketClient({
      ...options,
      onConnectionState: (state) => {
        this.store.getState().setConnectionState(state);
        if (state === "disconnected") this.finishInitialReply(new Error("连接已断开，这份输入尚未确认。"));
        if (state === "disconnected" && !this.closed) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = setTimeout(() => this.socket.connect(), 1000);
        }
      },
      onNotification: (notification) => this.inputs.handleNotification(notification),
      onRequest: (request) => this.store.getState().handleRequest(request),
    });
    this.inputs = new ThreadInputController({
      getState: this.store.getState,
      client: this.socket,
      onNotification: (notification) => {
        this.selectThread(notification);
        this.receiveInitialReply(notification);
        this.changed();
      },
    });
    this.store.subscribe(() => this.changed());
  }

  connect(): void { this.closed = false; this.socket.connect(); }
  disconnect(): void { this.closed = true; clearTimeout(this.reconnectTimer); this.socket.disconnect(); }
  getSnapshot = (): PetSnapshot => this.snapshot;
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };

  hideBubble(): void { this.visibility = "hidden"; this.changed(); }
  revealBubble(): void { this.visibility = "visible"; this.changed(); }

  drop(items: InputItem[], target: PetDropTarget, threadId = this.currentThread?.id): void {
    this.requireConnection();
    if (!items.length) return;
    if (target === "pet") {
      this.inputs.startInitialPrompt({ clientRequestId: crypto.randomUUID(), userInput: { items, mode: "inspect" } });
    } else {
      if (!threadId) throw new Error("当前没有可追加的对话，请把内容拖到角色上。");
      this.socket.submitOp(threadId, { type: "user_input", opId: crypto.randomUUID(), timestamp: new Date().toISOString(), payload: { items, mode: "inspect" } });
    }
    this.changed();
  }

  respond(text: string): Promise<void> | void {
    this.requireConnection();
    if (!text.trim()) return;
    if (this.initialReply) throw new Error("正在接收首条输入，请稍候。");
    const threadId = this.currentThread?.id;
    const id = crypto.randomUUID();
    const userInput = { items: [{ type: "text" as const, id: crypto.randomUUID(), text: text.trim() }] };
    const thread = threadId ? this.store.getState().threadsById[threadId] : undefined;
    const placeholderId = thread ? pendingInitialMessage(thread)?.id : undefined;
    const hasRecordedInput = thread?.messages.some((message) => message.type === "user_message" && message.id !== placeholderId);
    const accepted = hasRecordedInput ? undefined : new Promise<void>((resolve, reject) => {
      this.initialReply = { id, threadId, resolve, reject };
    });
    try {
      if (threadId) this.socket.submitOp(threadId, { type: "user_input", opId: id, timestamp: new Date().toISOString(), payload: userInput });
      else this.inputs.startInitialPrompt({ clientRequestId: id, userInput });
    } catch (error) {
      if (!accepted) throw error;
      this.finishInitialReply(error instanceof Error ? error : new Error(String(error)));
    }
    return accepted;
  }

  answerPermission(requestId: string, decision: "allow" | "deny", scope: "once" | "always" = "once"): void {
    this.requireConnection();
    this.socket.sendRaw(encodePermissionAnswer({ requestId, decision, scope, timestamp: new Date().toISOString() }));
  }

  answerWorkspace(requestId: string, workspaceId?: string): void {
    this.requireConnection();
    this.socket.sendRaw(encodeWorkspaceAnswer({ requestId, workspaceId, cancelled: !workspaceId, timestamp: new Date().toISOString() }));
  }

  private requireConnection(): void {
    if (this.store.getState().connectionState !== "connected") throw new Error("还没有连上服务，这份输入尚未提交。连接恢复后请再交给我。");
  }

  private receiveInitialReply(notification: ThreadNotification): void {
    const reply = this.initialReply;
    if (!reply) return;
    if (notification.type === "thread.started" && notification.commandId === reply.id) reply.threadId = notification.threadId;
    const messages = reply.threadId ? this.store.getState().threadsById[reply.threadId]?.messages : undefined;
    if (messages?.some((message) => message.type === "user_message" && message.id === reply.id)) {
      this.finishInitialReply();
    } else if (notification.type === "thread.error" && (notification.commandId === reply.id || reply.threadId && notification.threadId === reply.threadId)) {
      this.finishInitialReply(new Error(notification.payload.message));
    } else if (notification.type === "thread.deleted" && notification.payload.targetThreadId === reply.threadId) {
      this.finishInitialReply(new Error("对话已被删除，这份输入尚未确认。"));
    }
  }

  private finishInitialReply(error?: Error): void {
    const reply = this.initialReply;
    this.initialReply = undefined;
    if (error) reply?.reject(error);
    else reply?.resolve();
  }

  private selectThread(notification: ThreadNotification): void {
    if (notification.type === "thread.started") {
      const createdAt = notification.payload.createdAt ?? notification.timestamp;
      if (!this.currentThread || createdAt >= this.currentThread.createdAt) {
        this.currentThread = { id: notification.threadId, createdAt };
        if (this.visibility === "startup") this.visibility = "visible";
      }
    } else if (notification.type === "thread.listed") {
      const latest = newest(notification.payload.threads);
      const currentExists = notification.payload.threads.some((thread) => thread.id === this.currentThread?.id);
      if (!currentExists || latest && (!this.currentThread || latest.createdAt > this.currentThread.createdAt)) this.currentThread = latest;
      if (this.currentThread) this.socket.resumeThread(this.currentThread.id);
    } else if (notification.type === "thread.deleted" && notification.payload.targetThreadId === this.currentThread?.id) {
      this.currentThread = newest(this.store.getState().history);
      if (this.currentThread) this.socket.resumeThread(this.currentThread.id);
    }
  }

  private changed(): void {
    const state = this.store.getState();
    const thread = this.currentThread ? state.threadsById[this.currentThread.id] : undefined;
    const latestAssistant = thread?.messages.findLast((item): item is AssistantMessageItem => item.type === "assistant_message" && !!item.text.trim());
    this.snapshot = {
      threadId: this.currentThread?.id ?? null,
      bubbleVisible: this.visibility === "visible",
      latestAssistant,
      connection: state.connectionState,
    };
    for (const listener of this.listeners) listener();
  }
}

function newest(threads: ThreadListEntry[]): { id: string; createdAt: string } | null {
  return threads.reduce<ThreadListEntry | null>((latest, candidate) => !latest || candidate.createdAt > latest.createdAt ? candidate : latest, null);
}
