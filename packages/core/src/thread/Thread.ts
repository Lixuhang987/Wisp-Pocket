import type { AgentMessage } from "../runtime/types/AgentMessage.ts";
import type { Op } from "../protocol/types/Op.ts";
import type { ThreadNotification } from "../protocol/types/ThreadNotification.ts";
import type { RunStatus } from "../protocol/types/ThreadProtocolShared.ts";
import { META_TOOL_NAME } from "../tools/MetaToolUseTool.ts";
import { ThreadRequests } from "./ThreadRequests.ts";
import type { ThreadTools } from "./ThreadTools.ts";
import type { ActiveTurn, QueuedInput, ThreadRuntime, ThreadServices } from "./types/ThreadServices.ts";
import type { PersistedThread, ThreadAuditEvent } from "./types/ThreadHistory.ts";
import { settleWithin } from "./utils/settleWithin.ts";

export class Thread {
  readonly requests: ThreadRequests;
  readonly createdAt: string;
  readonly petId: string;
  readonly petSnapshot: import("../pet/Pet.ts").PetSnapshot;
  readonly rootPath: string;
  private history: AgentMessage[];
  private readonly tools: ThreadTools;
  private runtime: ThreadRuntime;
  private inputs: QueuedInput[] = [];
  private active?: ActiveTurn;
  private control: Promise<unknown> = Promise.resolve();
  private closed = false;
  private faulted = false;
  private state: RunStatus = "idle";

  constructor(readonly id: string, private readonly services: ThreadServices, data: PersistedThread, status: RunStatus = "idle") {
    this.history = structuredClone(data.messages);
    this.inputs = structuredClone(data.pendingInputs ?? []);
    this.createdAt = data.metadata.createdAt;
    this.petId = data.metadata.petId;
    this.petSnapshot = structuredClone(data.metadata.petSnapshot);
    this.rootPath = data.metadata.rootPath;
    this.state = status;
    this.tools = services.createTools(data.metadata.dynamicTools ?? []);
    this.runtime = services.createRuntime(id, this.tools);
    this.requests = new ThreadRequests(id, (request) => services.publish(request), () => !!this.active && !this.active.controller.signal.aborted && !this.closed,
      60_000, (requestId) => services.publish({ type: "request.resolved", threadId: id, notificationId: crypto.randomUUID(), timestamp: this.now(), payload: { requestId } }));
  }

  get status(): RunStatus { return this.state; }
  get needsRecovery(): boolean { return this.faulted; }
  snapshot() {
    const pending = new Set(this.inputs.map((input) => input.opId));
    return {
      petId: this.petId, petRevision: this.petSnapshot.revision, petSnapshot: structuredClone(this.petSnapshot), rootPath: this.rootPath,
      messages: this.services.projection.conversation(structuredClone(this.history)).map((message) => {
        if (message.role === "user" && pending.has(message.id)) return { ...message, pending: true };
        if (message.role === "assistant" && this.active) return { ...message, awaitingReply: false };
        return message;
      }),
      status: this.state,
      pendingRequests: this.requests.snapshot(),
    };
  }

  async submit(op: Op): Promise<void> {
    if (op.type === "client_response") {
      if (!this.closed) this.requests.answer(op.payload.response);
      return;
    }
    if (op.type === "interrupt") return this.interrupt();
    await this.serial(async () => {
      this.requireWritable();
      const duplicate = this.history.find(message => message.role === "user" && message.id === op.opId);
      if (duplicate?.role === "user") {
        this.services.publish({type:"user.message.recorded",threadId:this.id,notificationId:`${this.id}-${op.opId}-user-recorded`,timestamp:this.now(),payload:{messageId:op.opId,text:this.services.projection.summarizeInput({items:duplicate.inputItems ?? []}),items:duplicate.inputItems,pending:this.inputs.some(input=>input.opId===op.opId)}});
        return;
      }
      try {
        const saved = await this.recordInput(op);
        this.inputs.push(saved);
        if (!this.closed) this.startQueued();
      } catch (error) { this.fail(error); throw error; }
    });
  }

  async recover(): Promise<void> {
    await this.serial(async () => {
      if (this.closed) throw new Error(`Thread closed: ${this.id}`);
      if (!this.faulted) return;
      await this.services.storage.resetThread(this.id);
      const status = await this.services.storage.recoverIncompleteTurnForSnapshot(this.id);
      const data = await this.services.storage.getThread(this.id);
      if (!data) throw new Error(`Thread not found: ${this.id}`);
      this.history = structuredClone(data.messages);
      this.inputs = structuredClone(data.pendingInputs ?? []);
      this.runtime = this.services.createRuntime(this.id, this.tools);
      this.faulted = false;
      this.state = status ?? "idle";
    });
  }

  async interrupt(): Promise<void> {
    let active = this.active;
    active?.controller.abort();
    this.requests.cancel();
    if (!active) {
      await this.serial(async () => {
        active = this.active;
        active?.controller.abort();
        this.requests.cancel();
      });
    }
    if (!active) return;
    const interrupted = active;
    this.tools.cancelRefresh();
    await settleWithin(interrupted.done, this.services.stopTimeoutMs ?? 3000);
    await this.serial(async () => {
      if (this.active !== interrupted) return;
      this.active = undefined;
      this.runtime = this.services.createRuntime(this.id, this.tools);
      this.state = "interrupted";
      try {
        await this.persistCompletion(interrupted.id, "interrupted");
        await this.write(() => this.services.storage.persistError(this.id, "本轮运行已中断。", "run_interrupted"));
      } catch (error) { this.fail(error); }
    });
  }

  async close(): Promise<void> {
    this.closed = true;
    this.tools.cancelRefresh();
    this.requests.cancel();
    await this.interrupt();
    await this.control;
  }

  private serial<T>(operation: () => Promise<T>): Promise<T> {
    const task = this.control.then(operation);
    this.control = task.catch(() => {});
    return task;
  }

  private requireWritable(): void {
    if (this.closed) throw new Error(`Thread closed: ${this.id}`);
    if (this.faulted) throw new Error("Thread 保存失败，请重新打开后继续。");
  }

  private async recordInput(input: QueuedInput): Promise<QueuedInput> {
    const message = await this.write(() => this.services.storage.persistUserInput(this.id, input.payload, input.opId));
    const payload = { ...input.payload, items: message.role === "user" && message.inputItems ? message.inputItems : input.payload.items };
    const text = this.services.projection.summarizeInput(input.payload);
    await this.write(() => this.services.storage.autoTitle(this.id, text));
    const notification: ThreadNotification = {
      type: "user.message.recorded", threadId: this.id,
      notificationId: `${this.id}-${input.opId}-user-recorded`, timestamp: this.now(),
      payload: { messageId: input.opId, text, items: structuredClone(payload.items), pending: true },
    };
    await this.write(() => this.services.storage.persistNotifications(this.id, [notification]));
    if (!this.closed) {
      this.history.push(structuredClone(message));
      this.services.publish(notification);
    }
    return { opId: input.opId, payload: structuredClone(payload) };
  }

  private start(input: QueuedInput): void {
    const active: ActiveTurn = { id: input.opId, input, controller: new AbortController(), sequence: 0, done: Promise.resolve() };
    this.active = active;
    this.state = "running";
    // Execution waits for the accepting short operation, but never occupies its queue.
    active.done = this.control.then(() => this.execute(active)).catch((error) => {
      if (this.active === active && !active.controller.signal.aborted) this.fail(error);
    });
  }

  private async execute(active: ActiveTurn): Promise<void> {
    try {
      await this.serial(async () => {
        if (!this.valid(active)) return;
        const started: ThreadNotification = { type: "turn.started", threadId: this.id, turnId: active.id,
          notificationId: `${this.id}-${active.id}-started`, timestamp: this.now(), payload: {} };
        await this.write(() => this.services.storage.persistNotifications(this.id, [started]));
        if (this.valid(active)) this.services.publish(started);
      });
      if (this.valid(active)) {
        if (!this.tools.isActivated() && this.history.some((message) => message.role === "tool" && message.name === META_TOOL_NAME)) await this.tools.activate();
        await this.tools.refresh();
        if (!this.valid(active)) return;
        const pending = new Set([...this.inputs.map((input) => input.opId), active.id]);
        const inputMessage = this.history.find((message) => message.role === "user" && message.id === active.id);
        const ordered = this.history.filter((message) => message.role !== "user" || !message.id || !pending.has(message.id));
        if (inputMessage) ordered.push(inputMessage);
        const messages = this.services.projection.runtimeMessages(structuredClone(ordered));
        const base = messages.length;
        const events: ThreadAuditEvent[] = [];
        const notifications: ThreadNotification[] = [];
        const result = await this.runtime.runWithMessages(messages, (event) => {
          if (!this.valid(active)) return;
          const time = this.now();
          const notification = this.services.projection.notification(this.id, active.id, event, time, ++active.sequence);
          if (notification) { notifications.push(notification); this.services.publish(notification); }
          const audit = this.services.projection.audit(event, time);
          if (audit) events.push(audit);
        }, { threadId: this.id, turnId: active.id, signal: active.controller.signal,
          rootPath: this.rootPath, rolePrompt: this.petSnapshot.rolePrompt });
        if (!this.valid(active)) return;
        // The runtime owns a detached summary working copy; only committed deltas enter history.
        const committed = structuredClone(result.messages).map((message, index) => index >= base && message.role === "assistant" && message.id
          ? { ...message, id: `${this.id}-${active.id}-${message.id}` } : message);
        await this.serial(async () => {
          if (!this.valid(active)) return;
          await this.write(() => this.services.storage.persistRunDelta(this.id, base, committed, events, notifications));
          if (!this.valid(active)) return;
          this.history.push(...committed.slice(base));
          await this.persistCompletion(active.id, "completed", () => this.valid(active));
          if (!this.valid(active)) return;
          this.state = "idle";
          this.active = undefined;
          this.startQueued();
        });
      }
    } catch (error) {
      if (this.valid(active)) {
        try {
          await this.finishWithMessage(active, `这次没能完成：${error instanceof Error ? error.message : String(error)}\n输入已经保存，你可以补充说明后继续。`, "failed");
        } catch (saveError) { this.fail(saveError); }
      }
    }
  }

  private startQueued(): void {
    if (this.active || this.closed || this.faulted || this.inputs.length === 0) return;
    this.start(this.inputs.shift()!);
  }

  private async appendGenerated(active: ActiveTurn, messages: AgentMessage[]): Promise<void> {
    if (!messages.length) return;
    await this.serial(async () => {
      if (!this.valid(active)) return;
      await this.write(() => this.services.storage.persistRunDelta(this.id, 0, messages, []));
      if (this.valid(active)) this.history.push(...structuredClone(messages));
    });
  }

  private async finishWithMessage(active: ActiveTurn, text: string, status: "completed" | "failed"): Promise<void> {
    await this.serial(async () => {
      if (!this.valid(active)) return;
      const messageId = "input-result";
      const notification = this.services.projection.notification(this.id, active.id,
        { type: "assistant_message_delta", messageId, payload: { text, awaitingReply: true } }, this.now(), ++active.sequence);
      const message: AgentMessage = { role: "assistant", id: `${this.id}-${active.id}-${messageId}`, content: text, awaitingReply: true };
      await this.write(() => this.services.storage.persistRunDelta(this.id, 0, [message], [], notification ? [notification] : []));
      if (!this.valid(active)) return;
      this.history.push(message);
      if (notification) this.services.publish(notification);
      await this.persistCompletion(active.id, status, () => this.valid(active));
      if (!this.valid(active)) return;
      this.requests.cancel();
      this.state = status === "completed" ? "idle" : "failed";
      this.active = undefined;
      this.startQueued();
    });
  }

  private async persistCompletion(turnId: string, status: "completed" | "interrupted" | "failed", canPublish: () => boolean = () => true): Promise<void> {
    const notifications: ThreadNotification[] = [
      { type: "turn.completed", threadId: this.id, turnId, notificationId: `${this.id}-${turnId}-${status}`, timestamp: this.now(), payload: { status } },
      { type: "thread.status.changed", threadId: this.id, notificationId: `${this.id}-${turnId}-status-${status}`, timestamp: this.now(), payload: { value: status === "completed" ? "idle" : status } },
    ];
    await this.write(() => this.services.storage.persistNotifications(this.id, notifications));
    if (canPublish()) for (const notification of notifications) this.services.publish(notification);
  }

  private async write<T>(operation: () => Promise<T>): Promise<T> {
    try { return await operation(); }
    catch (error) { this.fail(error); throw error; }
  }

  private valid(active: ActiveTurn): boolean { return this.active === active && !active.controller.signal.aborted && !this.closed && !this.faulted; }
  private now(): string { return this.services.now?.() ?? new Date().toISOString(); }
  private fail(error: unknown): void {
    if (this.faulted) return;
    const active = this.active;
    active?.controller.abort();
    this.active = undefined;
    this.requests.cancel();
    this.faulted = true;
    this.state = "failed";
    this.services.publish({ type: "thread.error", threadId: this.id, notificationId: crypto.randomUUID(), timestamp: this.now(), payload: { message: error instanceof Error ? error.message : String(error) } });
    if (active) this.services.publish({ type: "turn.completed", threadId: this.id, turnId: active.id, notificationId: crypto.randomUUID(), timestamp: this.now(), payload: { status: "failed" } });
    this.services.publish({ type: "thread.status.changed", threadId: this.id, notificationId: crypto.randomUUID(), timestamp: this.now(), payload: { value: "failed" } });
  }
}
