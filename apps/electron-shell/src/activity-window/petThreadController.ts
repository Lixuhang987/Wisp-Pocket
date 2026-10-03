import type { Pet } from "@handagent/core/pet/Pet.ts";
import type { InputItem, ThreadNotification, ThreadListEntry, ThreadCommand } from "../../../thread-window-web/src/protocol/threadProtocol.ts";
import { encodePermissionAnswer, encodeThreadDelete } from "../../../thread-window-web/src/protocol/threadProtocol.ts";
import { makeThreadWindowStore } from "../../../thread-window-web/src/store/threadWindowStore.ts";
import type { AssistantMessageItem } from "../../../thread-window-web/src/store/threadItems.ts";
import { ThreadSocketClient } from "../../../thread-window-web/src/thread/threadSocketClient.ts";
import { ThreadInputController } from "../../../thread-window-web/src/thread/threadInputController.ts";
import { pathInput } from "./readDroppedItems.ts";

export type PetDropTarget = "pet" | "conversation";
export type PetDraftFile = { id: string; path: string };
export type PetSnapshot = {
  threadId: string | null; pet?: Pet; bubbleVisible: boolean; draft: string; files: PetDraftFile[]; error?: string;
  latestAssistant?: AssistantMessageItem; connection: "disconnected" | "connecting" | "connected";
  history: ThreadListEntry[]; nextCursor?: string | null; receiving: boolean;
};
type Submission = { id: string; threadId?: string; items: InputItem[]; key: string; navigation: number; draftKey?: string; draftText?: string; files?: PetDraftFile[]; resolve?: () => void; reject?: (error: Error) => void };
type Preferences = { selectedThreadId?: string | null; drafts: Record<string, string>; files?: Record<string, PetDraftFile[]>; visibility?: "visible" | "hidden"; submissions?: Array<Omit<Submission,"resolve"|"reject">> };

/** One independent UI projection bound permanently to one Pet. */
export class PetThreadController {
  readonly store = makeThreadWindowStore();
  readonly petId: string;
  private readonly socket: ThreadSocketClient;
  private readonly inputs: ThreadInputController;
  private readonly listeners = new Set<() => void>();
  private preferences: Preferences = { drafts: {} };
  private visibility: "startup" | "visible" | "hidden" = "startup";
  private snapshot: PetSnapshot = { threadId: null, bubbleVisible: false, draft: "", files: [], connection: "disconnected", history: [], receiving: false };
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private closed = true;
  private error?: string;
  private nextCursor?: string | null;
  private readonly submissions = new Map<string, Submission>();
  private readonly management = new Map<string, { resolve(value: ThreadNotification): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> }>();
  private restoring = true;
  private navigation = 0;
  private loadingMore = false;

  constructor(options: Pick<ConstructorParameters<typeof ThreadSocketClient>[0], "url" | "WebSocketImpl"> & { petId: string }) {
    this.petId = options.petId;
    try { const raw = localStorage.getItem(this.preferenceKey); if (raw) { const saved = JSON.parse(raw); if (saved && typeof saved.drafts === "object") this.preferences = saved; } } catch { this.error = "无法恢复本宠草稿。"; }
    if (this.preferences.visibility) this.visibility = this.preferences.visibility;
    for (const submission of this.preferences.submissions ?? []) if (submission.id && Array.isArray(submission.items)) this.submissions.set(submission.id,submission);
    this.socket = new ThreadSocketClient({ ...options,
      onConnectionState: state => {
        this.store.getState().setConnectionState(state);
        if (state === "disconnected") {
          for (const submission of this.submissions.values()) this.finish(submission, new Error("连接中断，尚未确认接收。重试会沿用原提交身份。"));
          for (const request of this.management.values()) { clearTimeout(request.timer); request.reject(new Error("连接已断开，请重新保存。")); }
          this.management.clear();
          if (!this.closed) { clearTimeout(this.reconnectTimer); this.reconnectTimer = setTimeout(() => { this.restoring = true; this.socket.connect(); }, 1000); }
        }
      },
      onNotification: notification => {
        if (notification.type === "thread.listed" && this.loadingMore) {
          const page = notification.payload;
          notification = {...notification,payload:{...page,threads:[...this.history().filter(previous=>!page.threads.some(item=>item.id===previous.id)),...page.threads]}};
          this.loadingMore = false;
        }
        this.inputs.handleNotification(notification);
      },
      onRequest: request => { this.store.getState().handleRequest(request); if (this.ownsThread(request.threadId)) this.revealBubble(); },
    });
    this.inputs = new ThreadInputController({ getState: this.store.getState, client: this.socket,
      onNotification: notification => { this.receive(notification); this.changed(); },
    });
    this.store.subscribe(() => this.changed());
    this.changed();
  }
  private get preferenceKey(): string { return `handagent.pet-ui.v1.${this.petId}`; }
  connect(): void { this.restoring = true; this.closed = false; this.socket.connect(); }
  disconnect(): void { this.closed = true; clearTimeout(this.reconnectTimer); this.socket.disconnect(); }
  getSnapshot = (): PetSnapshot => this.snapshot;
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  hideBubble(): void { this.visibility = "hidden"; this.preferences.visibility = "hidden"; this.save(); this.changed(); }
  revealBubble(): void { this.visibility = "visible"; this.preferences.visibility = "visible"; this.save(); this.changed(); }
  setDraft(text: string, threadId = this.preferences.selectedThreadId): void { this.preferences.drafts[threadId ?? "new"] = text; this.save(); this.changed(); }
  addFiles(paths: string[], threadId = this.preferences.selectedThreadId): void {
    if (threadId && !this.ownsThread(threadId)) throw new Error("目标对话已删除，文件没有改投其他对话。");
    if (paths.some(path => !path.startsWith("/"))) throw new Error("文件没有可交付的本地原路径。");
    const key = threadId ?? "new";
    const files = this.preferences.files ??= {};
    const current = files[key] ?? [];
    files[key] = [...current, ...[...new Set(paths)].filter(path => !current.some(file => file.path === path)).map(path => ({ id: crypto.randomUUID(), path }))];
    this.save(); this.changed();
  }
  removeFile(id: string): void {
    const key = this.preferences.selectedThreadId ?? "new";
    if (this.preferences.files) this.preferences.files[key] = (this.preferences.files[key] ?? []).filter(file => file.id !== id);
    this.save(); this.changed();
  }
  selectThread(threadId: string): void {
    if (!this.ownsThread(threadId)) throw new Error("该对话不属于当前桌宠。");
    this.navigation += 1;
    this.preferences.selectedThreadId = threadId; this.save(); this.socket.resumeThread(threadId); this.changed();
  }
  newTopic(): void { this.navigation += 1; this.preferences.selectedThreadId = null; this.save(); this.changed(); }
  listMore(): void { if (this.nextCursor) { this.loadingMore = true; this.socket.listThreads(this.nextCursor); } }
  deleteThread(threadId: string): void { this.requireConnection(); if (!this.ownsThread(threadId)) throw new Error("该对话不属于当前桌宠。"); this.socket.sendRaw(encodeThreadDelete({targetThreadId:threadId, commandId:crypto.randomUUID(),timestamp:new Date().toISOString()})); }
  stop(): void { this.requireConnection(); const threadId = this.preferences.selectedThreadId; if (threadId) this.socket.submitOp(threadId, {type:"interrupt",opId:crypto.randomUUID(),timestamp:new Date().toISOString(),payload:{reason:"user"}}); }
  drop(items: InputItem[], target: PetDropTarget, threadId = this.preferences.selectedThreadId ?? undefined, id = crypto.randomUUID()): Promise<void> {
    if (target === "conversation" && !threadId) throw new Error("当前没有可追加的对话，请把内容拖到角色上。");
    return this.submit(items, target === "pet" ? undefined : threadId, id);
  }
  respond(text: string, includeFiles = false): Promise<void> | undefined {
    const key = this.preferences.selectedThreadId ?? "new";
    const originalDraft = this.preferences.drafts[key] ?? "";
    const files = includeFiles ? this.preferences.files?.[key] ?? [] : [];
    const items: InputItem[] = text.trim() ? [{type:"text",id:crypto.randomUUID(),text:text.trim()}] : [];
    items.push(...files.map(file => ({ ...pathInput(file.path), id: file.id })));
    if (!items.length) return;
    return this.submit(items, this.preferences.selectedThreadId ?? undefined, crypto.randomUUID(),
      { draftKey: key, draftText: originalDraft.trim() === text.trim() ? originalDraft : undefined, files });
  }
  answerPermission(requestId: string, decision: "allow" | "deny", scope: "once" | "always" = "once"): void {
    this.requireConnection(); this.socket.sendRaw(encodePermissionAnswer({requestId,decision,scope,timestamp:new Date().toISOString()}));
  }
  command(type: "pet.image.import" | "pet.create" | "pet.update", payload: Record<string, unknown>, commandId: string = crypto.randomUUID()): Promise<ThreadNotification> {
    this.requireConnection();
    return new Promise((resolve,reject)=> {
      const timer = setTimeout(() => {
        this.management.delete(commandId);
        reject(new Error("保存回执超时，请重试；伙伴创建会沿用原提交身份。"));
      }, 30000);
      this.management.set(commandId,{resolve,reject,timer});
      try { this.socket.sendRaw(JSON.stringify({type,payload,commandId,timestamp:new Date().toISOString()})); }
      catch (error) { clearTimeout(timer); this.management.delete(commandId); reject(error); }
    });
  }
  private submit(items: InputItem[], threadId?: string, id = crypto.randomUUID(), draft?: Pick<Submission, "draftKey" | "draftText" | "files">): Promise<void> {
    this.requireConnection();
    if (threadId && !this.ownsThread(threadId)) throw new Error("该对话已经删除或不属于当前桌宠。");
    const key = JSON.stringify([threadId ?? "new", items.map(({id: _id,...item})=>item)]);
    let submission = [...this.submissions.values()].find(s=>s.key===key || !!threadId && s.threadId===threadId && JSON.stringify(s.items.map(({id:_id,...item})=>item))===JSON.stringify(items.map(({id:_id,...item})=>item)));
    if (submission?.resolve) throw new Error("正在接收这份输入，请稍候。");
    submission ??= {id,threadId,items,key,navigation:this.navigation}; this.submissions.set(submission.id, submission);
    if (draft) Object.assign(submission, draft);
    const current = submission;
    const accepted = new Promise<void>((resolve,reject)=> { current.resolve=resolve; current.reject=reject; });
    if (current.threadId) this.socket.submitOp(current.threadId,{type:"user_input",opId:current.id,timestamp:new Date().toISOString(),payload:{items:current.items}});
    else this.inputs.startInitialPrompt({clientRequestId:current.id,petId:this.petId,userInput:{items:current.items}});
    this.save(); this.changed(); return accepted;
  }
  private receive(notification: ThreadNotification): void {
    if (notification.type === "pet.listed" && !("workspaceId" in notification.payload)) {
      const knownIds = new Set(notification.payload.pets.map(pet => pet.id));
      try {
        const staleKeys: string[] = [];
        const prefixes = ["handagent.pet-ui.v1.", "handagent.pet-size."];
        for (let index = 0; index < localStorage.length; index++) {
          const key = localStorage.key(index);
          const prefix = prefixes.find(value => key?.startsWith(value));
          if (key && prefix && !knownIds.has(key.slice(prefix.length))) staleKeys.push(key);
        }
        for (const key of staleKeys) localStorage.removeItem(key);
      } catch { this.error = "无法清理失效伙伴偏好，有效草稿仍保留。"; }
    }
    const commandId = "commandId" in notification ? notification.commandId : undefined;
    const request = commandId ? this.management.get(commandId) : undefined;
    if (request && notification.type.startsWith("pet.")) { clearTimeout(request.timer); this.management.delete(commandId!); if (notification.type === "pet.error") request.reject(new Error(notification.payload.message)); else request.resolve(notification); }
    if (notification.type === "thread.started") {
      const submission = notification.commandId ? this.submissions.get(notification.commandId) : undefined;
      if (submission) {
        submission.threadId = notification.threadId;
        if (submission.navigation === this.navigation) { if (!this.preferences.selectedThreadId) {
          this.preferences.drafts[notification.threadId] = this.preferences.drafts.new ?? ""; delete this.preferences.drafts.new;
          if (this.preferences.files?.new) { this.preferences.files[notification.threadId] = this.preferences.files.new; delete this.preferences.files.new; }
          if (submission.draftKey === "new") submission.draftKey = notification.threadId;
        } this.preferences.selectedThreadId = notification.threadId; }
        this.save();
      }
    } else if (notification.type === "thread.listed") {
      this.nextCursor = notification.payload.nextCursor;
      if (this.restoring) {
        const history = notification.payload.threads.filter(t=>t.petId===this.petId);
        const selected = this.preferences.selectedThreadId;
        if (selected && !history.some(t=>t.id===selected)) {
          // A selected item may live on another page; resume provides its authoritative existence.
          if (notification.payload.nextCursor) this.socket.resumeThread(selected);
          else { this.clearDraft(selected); this.preferences.selectedThreadId = history[0]?.id ?? null; }
        } else if (selected === undefined) this.preferences.selectedThreadId = history[0]?.id ?? null;
        this.restoring = false; this.save(); if (this.preferences.selectedThreadId) this.socket.resumeThread(this.preferences.selectedThreadId);
      }
    } else if (notification.type === "thread.deleted" && notification.payload.status === "deleted") {
      const id = notification.payload.targetThreadId; this.clearDraft(id);
      if (this.preferences.selectedThreadId===id) { this.preferences.selectedThreadId=this.history()[0]?.id ?? null; if (this.preferences.selectedThreadId) this.socket.resumeThread(this.preferences.selectedThreadId); } this.save();
    }
    if (notification.type === "thread.error" && notification.threadId === this.preferences.selectedThreadId && "code" in notification.payload && notification.payload.code === "not_found") {
      this.clearDraft(notification.threadId!);
      this.preferences.selectedThreadId = this.history().find(thread => thread.id !== notification.threadId)?.id ?? null;
      this.save();
      if (this.preferences.selectedThreadId) this.socket.resumeThread(this.preferences.selectedThreadId);
    }
    for (const submission of this.submissions.values()) {
      const messages = submission.threadId ? this.store.getState().threadsById[submission.threadId]?.messages : undefined;
      if (messages?.some(item=>item.type === "user_message" && item.id === submission.id)) { this.finish(submission); this.submissions.delete(submission.id); this.save(); }
      else if (notification.type === "thread.error" && (notification.commandId===submission.id || notification.threadId===submission.threadId)) this.finish(submission,new Error(notification.payload.message));
      else if (notification.type === "thread.deleted" && notification.payload.targetThreadId===submission.threadId) this.finish(submission,new Error("目标对话已删除，输入没有改投其他对话。"));
    }
  }
  private clearDraft(key: string): void { delete this.preferences.drafts[key]; if (this.preferences.files) delete this.preferences.files[key]; }
  private finish(submission: Submission, error?: Error): void {
    if (error) submission.reject?.(error);
    else {
      const key = submission.draftKey;
      if (key) {
        if (submission.draftText !== undefined && this.preferences.drafts[key] === submission.draftText) delete this.preferences.drafts[key];
        if (this.preferences.files?.[key]) this.preferences.files[key] = this.preferences.files[key].filter(file => !submission.files?.some(sent => sent.id === file.id));
      }
      submission.resolve?.();
    }
    submission.resolve=undefined;submission.reject=undefined;
  }
  private history(): ThreadListEntry[] { return this.store.getState().history.filter(t=>t.petId===this.petId).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)); }
  private ownsThread(id: string): boolean { return this.history().some(t=>t.id===id) || this.store.getState().threadsById[id]?.petId===this.petId; }
  private requireConnection(): void { if (this.store.getState().connectionState!=="connected") throw new Error("还没有连上服务，输入尚未提交。"); }
  private save(): void { this.preferences.submissions = [...this.submissions.values()].map(({resolve:_resolve,reject:_reject,...submission})=>submission); try { localStorage.setItem(this.preferenceKey,JSON.stringify(this.preferences)); this.error=undefined; } catch { this.error="草稿保存失败，本次输入仍保留在窗口中。"; } }
  private changed(): void {
    const state=this.store.getState(), threadId=this.preferences.selectedThreadId ?? null, thread=threadId ? state.threadsById[threadId] : undefined;
    this.snapshot={threadId,pet:state.pets.find(p=>p.id===this.petId),bubbleVisible:this.visibility==="visible",draft:this.preferences.drafts[threadId??"new"]??"",files:this.preferences.files?.[threadId??"new"]??[],error:this.error,
      latestAssistant:thread?.messages.findLast((item):item is AssistantMessageItem=>item.type==="assistant_message"&&!!item.text.trim()),connection:state.connectionState,
      history:this.history(),nextCursor:this.nextCursor,receiving:[...this.submissions.values()].some(s=>!!s.resolve)};
    for(const listener of this.listeners) listener();
  }
}
