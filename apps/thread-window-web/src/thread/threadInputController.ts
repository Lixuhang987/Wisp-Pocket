import {
  encodeThreadStart,
  type InitialPromptPayload,
  type ThreadNotification,
  type UserInput,
} from "../protocol/threadProtocol.ts";
import type { ThreadWindowState } from "../store/threadWindowStore.ts";
import type { ThreadSocketClient } from "./threadSocketClient.ts";

type InputStore = Pick<ThreadWindowState,
  | "pets"
  | "connectionState"
  | "threadsById"
  | "pendingInitialPrompts"
  | "enqueueInitialPrompt"
  | "handleNotification"
>;

export class ThreadInputController {
  constructor(private readonly options: {
    getState(): InputStore;
    client: Pick<ThreadSocketClient, "sendRaw" | "resumeThread" | "submitOp">;
    onNotification?: (notification: ThreadNotification) => void;
    now?: () => string;
    id?: () => string;
  }) {}

  startInitialPrompt(prompt: InitialPromptPayload): void {
    const store = this.options.getState();
    const pending = store.pendingInitialPrompts[prompt.clientRequestId];
    if (pending && JSON.stringify(pending.userInput) !== JSON.stringify(prompt.userInput)) throw new Error(`Initial prompt ${prompt.clientRequestId} is already pending`);
    const petId = prompt.petId ?? store.pets.find(pet => pet.isDefault)?.id;
    store.enqueueInitialPrompt({ ...prompt, ...(petId ? {petId} : {}) });
    if (!petId) return;
    this.options.client.sendRaw(encodeThreadStart({ commandId: prompt.clientRequestId, timestamp: this.now(), petId }));
  }

  handleNotification(notification: ThreadNotification): void {
    const store = this.options.getState();
    const prompt = notification.type === "thread.started"
      && notification.commandId
      && Object.hasOwn(store.pendingInitialPrompts, notification.commandId)
      ? store.pendingInitialPrompts[notification.commandId]
      : undefined;

    store.handleNotification(notification);
    this.options.onNotification?.(notification);
    if (notification.type === "pet.listed") {
      for (const pending of Object.values(this.options.getState().pendingInitialPrompts)) if (!pending.petId) this.startInitialPrompt(pending);
    }

    // Preserve the callback → history load → first input handoff order.
    if (notification.type === "thread.started" && prompt) {
      this.options.client.resumeThread(notification.threadId);
      this.options.client.submitOp(notification.threadId, {
        type: "user_input",
        opId: prompt.clientRequestId,
        timestamp: this.now(),
        payload: prompt.userInput,
      });
    }
  }

  submitComposerInput(threadId: string, input: UserInput): void {
    const store = this.options.getState();
    const thread = store.threadsById[threadId];
    if (!thread || store.connectionState !== "connected") return;
    const op = {
      type: "user_input" as const,
      opId: this.options.id?.() ?? `op-${crypto.randomUUID()}`,
      timestamp: this.now(),
      payload: structuredClone(input),
    };
    this.options.client.submitOp(threadId, op);
  }

  private now(): string {
    return this.options.now?.() ?? new Date().toISOString();
  }
}
