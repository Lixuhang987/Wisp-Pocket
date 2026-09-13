import type { AgentMessage } from "@handagent/core/runtime/types/AgentMessage.ts";
import type { BlobStore } from "@handagent/core/blob/types/BlobStore.ts";
import { FilesystemBlobStore } from "@handagent/core/adapters/filesystem/FilesystemBlobStore.ts";
import type { UserInput } from "@handagent/core/protocol/types/Op.ts";
import type { ThreadNotification } from "@handagent/core/protocol/types/ThreadNotification.ts";
import type { DynamicToolSpec } from "@handagent/core/protocol/types/DynamicTool.ts";
import {
  CurrentThread,
  ThreadStore,
  type PersistedThread,
  type RolloutItem,
  type ThreadAuditEvent,
  type ThreadStoreResult,
  type ThreadSummary,
} from "@handagent/thread-store/index.ts";
import type { CreateThreadParams } from "@handagent/thread-store/index.ts";
import {
  agentMessagesToConversation,
  composeUserContent,
  composeUserInputContent,
  deriveTitle,
  storeUserInput,
} from "../protocol/MessageTranslator.ts";

export type CreatePersistedThreadInput = {
  preview?: string | null;
  workspaceId?: string | null;
  dynamicTools?: DynamicToolSpec[];
};

export class ThreadPersistence {
  private readonly currentThreads = new Map<string, CurrentThread>();

  constructor(
    private readonly store: ThreadStore,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly blobStore: BlobStore = new FilesystemBlobStore(),
  ) {}

  async createThread(input: CreatePersistedThreadInput = {}): Promise<PersistedThread> {
    const id = generateThreadId();
    const current = await this.createCurrentThread({
      threadId: id,
      preview: input.preview,
      workspaceId: input.workspaceId,
      dynamicTools: input.dynamicTools,
      timestamp: this.now(),
      threadSource: "user",
      originator: "user",
    });
    unwrap(await current.persist());
    this.currentThreads.set(id, current);
    return await this.requireThread(id);
  }

  async deleteThread(threadId: string): Promise<void> {
    this.currentThreads.delete(threadId);
    unwrap(await this.store.deleteThread(threadId));
  }

  async renameThread(threadId: string, preview: string): Promise<void> {
    unwrap(await this.store.updatePreview(threadId, preview, this.now()));
  }

  async listThreads(): Promise<ThreadSummary[]> {
    return unwrap(await this.store.listThreads());
  }

  async getThread(threadId: string): Promise<PersistedThread | null> {
    return unwrap(await this.store.getPersistedThread(threadId));
  }

  async ensureThread(threadId: string): Promise<void> {
    await this.ensureCurrentThread(threadId);
  }

  async persistUserMessage(
    threadId: string,
    text: string,
    attachments?: Parameters<typeof composeUserContent>[1],
  ): Promise<void> {
    const userMessage: AgentMessage = {
      role: "user",
      content: await composeUserContent(text, attachments, this.blobStore),
    };
    await this.appendAndPersist(threadId, [
      { kind: "response_item", payload: userMessage },
    ]);
  }

  async persistUserInput(threadId: string, userInput: UserInput, messageId?: string): Promise<AgentMessage> {
    const savedInput = await storeUserInput(userInput, this.blobStore);
    const userMessage: AgentMessage = {
      role: "user",
      ...(messageId ? { id: messageId } : {}),
      content: await composeUserInputContent(savedInput, this.blobStore),
      inputItems: savedInput.items,
      ...(savedInput.mode ? { inputMode: savedInput.mode } : {}),
    };
    await this.appendAndPersist(threadId, [
      { kind: "response_item", payload: userMessage },
    ]);
    return userMessage;
  }

  async autoTitle(threadId: string, text: string): Promise<void> {
    const thread = await this.getThread(threadId);
    if (!thread) return;
    if (thread.metadata.preview || thread.messages.length !== 1) return;

    unwrap(await this.store.updatePreview(threadId, deriveTitle(text), this.now()));
  }

  async getMessages(threadId: string): Promise<AgentMessage[]> {
    const Thread = await this.getThread(threadId);
    return Thread?.messages ?? [];
  }

  async getConversationMessages(threadId: string) {
    const messages = await this.getMessages(threadId);
    return agentMessagesToConversation(messages);
  }

  async recoverIncompleteTurnForSnapshot(
    threadId: string,
    timestamp = this.now(),
  ): Promise<"failed" | "interrupted" | null> {
    const thread = await this.getThread(threadId);
    if (!thread) return null;
    const history = unwrap(await this.store.loadHistory({ threadId }));
    const unfinished = new Set<string>();
    for (const item of history.rolloutItems) {
      if (item.kind !== "event_msg") continue;
      if (item.payload.type === "turn.started") unfinished.add(item.payload.turnId);
      if (item.payload.type === "turn.completed") unfinished.delete(item.payload.turnId);
    }
    // Receipt and execution are separate facts: a queued input has no started Turn.
    if (unfinished.size === 0) return null;
    const lastError = [...thread.events].reverse().find((event) =>
      event.type === "error" && event.timestamp.localeCompare(thread.metadata.updatedAt) >= 0);
    const status = lastError?.type === "error" && lastError.code === RUN_INTERRUPTED_CODE ? "interrupted" : "failed";
    const message = lastError?.type === "error" ? lastError.message : RUN_LOST_AFTER_RESTART_MESSAGE;
    await this.appendAndPersist(threadId, [
      { kind: "response_item", payload: { role: "assistant", id: `recovery-${crypto.randomUUID()}`, content: message, awaitingReply: true } },
      ...[...unfinished].map((turnId): RolloutItem => ({
        kind: "event_msg", payload: { type: "turn.completed", threadId, turnId,
          notificationId: `recovery-${crypto.randomUUID()}`, timestamp, payload: { status } },
      })),
      { kind: "turn_context", payload: {
        turnId: `${threadId}-recovery`, status, timestamp,
        auditEvents: [{ type: "error", timestamp, message,
          code: lastError?.type === "error" ? lastError.code : RUN_LOST_AFTER_RESTART_CODE }],
      } },
    ]);
    return status;
  }

  async persistRunResult(
    threadId: string,
    messages: AgentMessage[],
    events: ThreadAuditEvent[],
  ): Promise<void> {
    const history = unwrap(await this.store.loadHistory({ threadId }));
    if (history.persisted) {
      unwrap(await this.store.replaceResponseItems(threadId, messages, this.now()));
      if (events.length > 0) {
        await this.appendAndPersist(threadId, [this.turnContextItem(threadId, events, "completed")]);
      }
      return;
    }

    await this.appendAndPersist(threadId, [
      ...messages.map((message): RolloutItem => ({ kind: "response_item", payload: message })),
      ...(events.length > 0 ? [this.turnContextItem(threadId, events, "completed")] : []),
    ]);
  }

  async persistRunDelta(
    threadId: string,
    baseMessageCount: number,
    runtimeMessages: AgentMessage[],
    events: ThreadAuditEvent[],
    notifications: ThreadNotification[] = [],
  ): Promise<void> {
    const generatedMessages = runtimeMessages.slice(baseMessageCount);
    await this.appendAndPersist(threadId, [
      ...notifications.map((notification): RolloutItem => ({
        kind: "event_msg",
        payload: notification,
      })),
      ...generatedMessages.map((message): RolloutItem => ({
        kind: "response_item",
        payload: message,
      })),
      ...(events.length > 0 ? [this.turnContextItem(threadId, events, "completed")] : []),
    ]);
  }

  async persistNotifications(
    threadId: string,
    notifications: ThreadNotification[],
  ): Promise<void> {
    await this.appendAndPersist(threadId, notifications.map((notification) => ({
      kind: "event_msg",
      payload: notification,
    })));
  }

  async persistError(threadId: string, errorMessage: string, code?: string): Promise<void> {
    const event: ThreadAuditEvent = {
      type: "error",
      timestamp: this.now(),
      message: errorMessage,
      ...(code ? { code } : {}),
    };
    await this.appendAndPersist(threadId, [
      this.turnContextItem(threadId, [event], "failed"),
    ]);
  }

  private async appendAndPersist(threadId: string, items: RolloutItem[]): Promise<void> {
    if (items.length === 0) return;

    const current = await this.ensureCurrentThread(threadId);
    unwrap(await current.appendItems(items));
    unwrap(await current.persist());
  }

  private async ensureCurrentThread(threadId: string): Promise<CurrentThread> {
    const current = this.currentThreads.get(threadId);
    if (current) return current;

    const existing = await this.getThread(threadId);
    if (existing) {
      const resumed = unwrap(await CurrentThread.resume(this.store, { threadId }));
      this.currentThreads.set(threadId, resumed);
      return resumed;
    }

    throw new Error(`Thread not found: ${threadId}`);
  }

  async resetThread(threadId: string): Promise<void> {
    this.currentThreads.delete(threadId);
    unwrap(await this.store.discardThread(threadId));
  }

  private async createCurrentThread(params: CreateThreadParams): Promise<CurrentThread> {
    return unwrap(await CurrentThread.create(this.store, params));
  }

  private async requireThread(threadId: string): Promise<PersistedThread> {
    const thread = await this.getThread(threadId);
    if (!thread) {
      throw new Error(`Thread not found after create: ${threadId}`);
    }
    return thread;
  }

  private turnContextItem(
    threadId: string,
    auditEvents: ThreadAuditEvent[],
    status: "completed" | "failed" | "interrupted",
  ): RolloutItem {
    return {
      kind: "turn_context",
      payload: {
        turnId: `${threadId}-${this.now()}`,
        status,
        timestamp: this.now(),
        auditEvents,
      },
    };
  }
}

export const RUN_INTERRUPTED_CODE = "run_interrupted";
export const RUN_INTERRUPTED_MESSAGE = "本轮运行已中断。";
export const RUN_LOST_AFTER_RESTART_CODE = "run_lost_after_restart";
export const RUN_LOST_AFTER_RESTART_MESSAGE = "本轮运行因 agent-server 重启而中断，请重新发送请求。";

function generateThreadId(): string {
  return `thread-${crypto.randomUUID()}`;
}

function unwrap<T>(result: ThreadStoreResult<T>): T {
  if (!result.ok) {
    throw new Error(`${result.error.code}: ${result.error.message}`);
  }
  return result.value;
}
