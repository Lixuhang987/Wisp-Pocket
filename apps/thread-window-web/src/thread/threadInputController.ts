import {
  encodeThreadStart,
  type InitialPromptPayload,
  type ThreadNotification,
  type UserInput,
} from "../protocol/threadProtocol.ts";
import type { ThreadWindowState } from "../store/threadWindowStore.ts";
import type { ThreadSocketClient } from "./threadSocketClient.ts";

type InputStore = Pick<ThreadWindowState,
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
    if (Object.hasOwn(store.pendingInitialPrompts, prompt.clientRequestId)) {
      throw new Error(`Initial prompt ${prompt.clientRequestId} is already pending`);
    }
    store.enqueueInitialPrompt(prompt);
    this.options.client.sendRaw(encodeThreadStart({
      commandId: prompt.clientRequestId,
      timestamp: this.now(),
      workspaceId: null,
    }));
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
