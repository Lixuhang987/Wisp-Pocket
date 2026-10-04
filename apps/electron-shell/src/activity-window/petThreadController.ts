import type { Pet } from "../../../thread-window-web/src/native/petTypes.ts";
import type { PetManagementBridge } from "../../../thread-window-web/src/native/settingsBridge.ts";
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
type Submission = { id: string; workspaceId: string; selectedAtStart: string | null; threadId?: string; items: InputItem[]; key: string; navigation: number; draftKey?: string; draftText?: string; files?: PetDraftFile[]; resolve?: () => void; reject?: (error: Error) => void };
type Preferences = { navigation?: number; selectedThreadId?: string | null; drafts: Record<string, string>; files?: Record<string, PetDraftFile[]>; visibility?: "visible" | "hidden"; submissions?: Array<Omit<Submission,"resolve"|"reject">> };

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
  private pet?: Pet;
  private disposePets?: () => void;
  private petVersion = 0;
  private petsLoaded = false;
  private readonly bridge?: PetManagementBridge;
  private restoring = true;
  private navigation = 0;
  private loadingMore = false;

  constructor(options: Pick<ConstructorParameters<typeof ThreadSocketClient>[0], "url" | "WebSocketImpl"> & { petId: string; bridge?: PetManagementBridge }) {
    this.petId = options.petId;
    this.bridge = options.bridge ?? window.handAgentSettings;
    try { const raw = localStorage.getItem(this.preferenceKey); if (raw) { const saved = JSON.parse(raw); if (saved && typeof saved.drafts === "object") this.preferences = saved; } } catch { this.error = "无法恢复本宠草稿。"; }
    this.navigation = this.preferences.navigation ?? 0;
    this.preferences.selectedThreadId = null;
    if (this.preferences.visibility) this.visibility = this.preferences.visibility;
    for (const submission of this.preferences.submissions ?? []) if (submission.id && Array.isArray(submission.items)) this.submissions.set(submission.id,submission);
    this.socket = new ThreadSocketClient({ ...options, listWorkspaces: true,
      onConnectionState: state => {
        this.store.getState().setConnectionState(state);
        if (state === "disconnected") {
          for (const submission of this.submissions.values()) this.finish(submission, new Error("连接中断，尚未确认接收。重试会沿用原提交身份。"));
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
      onRequest: request => { this.store.getState().handleRequest(request); if (request.threadId === this.pet?.threadId) this.revealBubble(); },
    });
    this.inputs = new ThreadInputController({ getState: this.store.getState, client: this.socket,
      onNotification: notification => { this.receive(notification); this.changed(); },
    });
    this.store.subscribe(() => this.changed());
    this.changed();
  }
  private get preferenceKey(): string { return `handagent.pet-ui.v1.${this.petId}`; }
  connect(): void {
    this.restoring = true; this.closed = false;
    this.disposePets?.();
    this.disposePets = this.bridge?.onPetsChanged(pets => { this.petVersion++; this.applyPets(pets); });
    const petVersion = this.petVersion;
    void this.bridge?.listPets().then(pets => { if (!this.closed && petVersion === this.petVersion) this.applyPets(pets); }).catch(error => { this.error = error instanceof Error ? error.message : "伙伴加载失败"; this.changed(); });
    this.socket.connect();
  }
  disconnect(): void { this.closed = true; clearTimeout(this.reconnectTimer); this.disposePets?.(); this.disposePets = undefined; this.socket.disconnect(); }
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
  async selectThread(threadId: string): Promise<void> {
    if (!this.ownsThread(threadId)) throw new Error("该对话不属于当前工作区。");
    const workspaceId = this.pet?.workspaceId;
    if (!workspaceId || !this.bridge) throw new Error("请先选择工作区。");
    this.navigation += 1;
    this.save();
    await this.bridge.assignPet({ petId: this.petId, workspaceId, threadId });
  }
  async newTopic(): Promise<void> {
    const workspaceId = this.pet?.workspaceId;
    if (!workspaceId || !this.bridge) throw new Error("请先选择工作区。");
    this.navigation += 1;
    this.save();
    await this.bridge.assignPet({ petId: this.petId, workspaceId, threadId: null, activate: false });
  }
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
  private submit(items: InputItem[], threadId?: string, id = crypto.randomUUID(), draft?: Pick<Submission, "draftKey" | "draftText" | "files">): Promise<void> {
    this.requireConnection();
    const workspaceId = this.pet?.workspaceId;
    if (!workspaceId) throw new Error("请先选择工作区，再提交输入。");
    if (threadId && !this.ownsThread(threadId)) throw new Error("该对话已经删除或不属于当前桌宠。");
    const key = JSON.stringify([workspaceId, threadId ?? "new", items.map(({id: _id,...item})=>item)]);
    let submission = [...this.submissions.values()].find(s=>s.key===key || !!threadId && s.threadId===threadId && JSON.stringify(s.items.filter(item=>!(item.type==="skill"&&item.actionId==="initial-role")).map(({id:_id,...item})=>item))===JSON.stringify(items.map(({id:_id,...item})=>item)));
    if (submission?.resolve) throw new Error("正在接收这份输入，请稍候。");
    submission ??= {id,workspaceId,selectedAtStart:this.pet?.threadId??null,threadId,items: !threadId && this.pet?.rolePrompt ? [...items, {type:"skill",id:`${id}-role`,actionId:"initial-role",title:"角色提示",prompt:this.pet.rolePrompt}] : items,key,navigation:this.navigation}; this.submissions.set(submission.id, submission);
    if (draft) Object.assign(submission, draft);
    const current = submission;
    const accepted = new Promise<void>((resolve,reject)=> { current.resolve=resolve; current.reject=reject; });
    if (current.threadId) this.socket.submitOp(current.threadId,{type:"user_input",opId:current.id,timestamp:new Date().toISOString(),payload:{items:current.items}});
    else this.inputs.startInitialPrompt({clientRequestId:current.id,workspaceId:current.workspaceId,userInput:{items:current.items}});
    this.save(); this.changed(); return accepted;
  }
  private receive(notification: ThreadNotification): void {
    if (notification.type === "thread.started") {
      const submission = notification.commandId ? this.submissions.get(notification.commandId) : undefined;
      if (submission) {
        submission.threadId = notification.threadId;
        if (submission.navigation === this.navigation && this.pet?.workspaceId) {
          void this.bridge?.assignPet({petId:this.petId,workspaceId:submission.workspaceId,threadId:notification.threadId,activate:false,expected:{workspaceId:submission.workspaceId,threadId:submission.selectedAtStart}}).catch(error => { this.error=error instanceof Error?error.message:"新话题关联失败";this.changed(); });
        }
        this.save();
      }
    } else if (notification.type === "thread.listed") {
      this.nextCursor = notification.payload.nextCursor;
      if (this.restoring) {
        this.restoring = false;
        if (this.pet?.threadId) this.socket.resumeThread(this.pet.threadId);
      }
    } else if (notification.type === "thread.deleted" && notification.payload.status === "deleted") {
      const id = notification.payload.targetThreadId; this.clearDraft(id);
      if (this.preferences.selectedThreadId===id) { this.preferences.selectedThreadId=null; this.clearInvalidAssociation(); } this.save();
    }
    if (notification.type === "thread.error" && notification.threadId === this.preferences.selectedThreadId && "code" in notification.payload && notification.payload.code === "not_found") {
      this.clearDraft(notification.threadId!);
      this.preferences.selectedThreadId = null;
      this.clearInvalidAssociation();
      this.save();
    }
    for (const submission of this.submissions.values()) {
      const messages = submission.threadId ? this.store.getState().threadsById[submission.threadId]?.messages : undefined;
      if (messages?.some(item=>item.type === "user_message" && item.id === submission.id)) { this.finish(submission); this.submissions.delete(submission.id); this.save(); }
      else if (notification.type === "thread.error" && (notification.commandId===submission.id || notification.threadId===submission.threadId)) this.finish(submission,new Error(notification.payload.message));
      else if (notification.type === "thread.deleted" && notification.payload.targetThreadId===submission.threadId) this.finish(submission,new Error("目标对话已删除，输入没有改投其他对话。"));
    }
  }
  private clearInvalidAssociation(): void {
    if (this.pet?.workspaceId) void this.bridge?.assignPet({petId:this.petId,workspaceId:this.pet.workspaceId,threadId:null,activate:false,expected:{workspaceId:this.pet.workspaceId,threadId:this.pet.threadId}}).catch(error=>{this.error=error instanceof Error?error.message:"失效话题关联清理失败";this.changed();});
  }
  private applyPets(pets: Pet[]): void {
    const next = pets.find(pet => pet.id === this.petId);
    const workspaceChanged = this.pet?.workspaceId !== next?.workspaceId;
    const selectionChanged = this.pet?.threadId !== next?.threadId;
    this.pet = next;
    if (workspaceChanged) {
      this.socket.setWorkspaceId(next?.workspaceId ?? undefined);
      this.store.setState({history:[]});
      if (next?.workspaceId) this.socket.listThreads();
    }
    if (workspaceChanged || selectionChanged) {
      const submission = next?.threadId ? [...this.submissions.values()].find(item=>item.threadId===next.threadId && item.navigation===this.navigation) : undefined;
      if (submission && !this.preferences.selectedThreadId) {
        this.preferences.drafts[next!.threadId!] = this.preferences.drafts.new ?? ""; delete this.preferences.drafts.new;
        if (this.preferences.files?.new) { this.preferences.files[next!.threadId!] = this.preferences.files.new; delete this.preferences.files.new; }
        if (submission.draftKey === "new") submission.draftKey = next!.threadId!;
      }
      if (this.petsLoaded) this.navigation += 1;
      this.preferences.selectedThreadId = next?.threadId ?? null;
      if (next?.threadId) { this.store.getState().ensureThreadState(next.threadId); this.socket.resumeThread(next.threadId); }
      this.save();
    }
    if (next) this.petsLoaded = true;
    this.changed();
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
  private history(): ThreadListEntry[] { return this.store.getState().history.filter(t=>t.workspaceId===this.pet?.workspaceId).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)); }
  private ownsThread(id: string): boolean { return this.history().some(t=>t.id===id) || this.store.getState().threadsById[id]?.workspaceId===this.pet?.workspaceId; }
  private requireConnection(): void { if (this.store.getState().connectionState!=="connected") throw new Error("还没有连上服务，输入尚未提交。"); }
  private save(): void { this.preferences.navigation = this.navigation; this.preferences.submissions = [...this.submissions.values()].map(({resolve:_resolve,reject:_reject,...submission})=>submission); try { const {selectedThreadId:_selection,...preferences}=this.preferences; localStorage.setItem(this.preferenceKey,JSON.stringify(preferences)); this.error=undefined; } catch { this.error="草稿保存失败，本次输入仍保留在窗口中。"; } }
  private changed(): void {
    const state=this.store.getState(), threadId=this.preferences.selectedThreadId ?? null, thread=threadId ? state.threadsById[threadId] : undefined;
    this.snapshot={threadId,pet:this.pet,bubbleVisible:this.visibility==="visible",draft:this.preferences.drafts[threadId??"new"]??"",files:this.preferences.files?.[threadId??"new"]??[],error:this.error,
      latestAssistant:thread?.messages.findLast((item):item is AssistantMessageItem=>item.type==="assistant_message"&&!!item.text.trim()),connection:state.connectionState,
      history:this.history(),nextCursor:this.nextCursor,receiving:[...this.submissions.values()].some(s=>!!s.resolve)};
    for(const listener of this.listeners) listener();
  }
}
