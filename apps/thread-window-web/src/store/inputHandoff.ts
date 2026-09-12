import { current } from "immer";
import type {
  InitialPromptPayload,
  InputItem,
  RuntimeOp,
  RunStatus,
  ThreadNotification,
} from "../protocol/threadProtocol.ts";
import type { UserMessageItem } from "./threadItems.ts";

export type QueuedComposerInput = { op: RuntimeOp };

export type ThreadInputState = {
  pendingInitialPrompt: InitialPromptPayload | null;
  queuedComposerInputs: QueuedComposerInput[];
  queuedInputDispatchPending: boolean;
};

export type InitialPromptState = {
  pendingInitialPrompts: Record<string, InitialPromptPayload>;
};

export function emptyThreadInputState(): ThreadInputState {
  return {
    pendingInitialPrompt: null,
    queuedComposerInputs: [],
    queuedInputDispatchPending: false,
  };
}

export function enqueueInitialPrompt(state: InitialPromptState, prompt: InitialPromptPayload): void {
  state.pendingInitialPrompts[prompt.clientRequestId] = prompt;
}

export function queueComposerInput(thread: ThreadInputState, op: RuntimeOp): void {
  thread.queuedComposerInputs.push({ op });
}

export function removeQueuedComposerInput(thread: ThreadInputState | undefined, index: number): void {
  if (!thread || index < 0 || index >= thread.queuedComposerInputs.length) return;
  thread.queuedComposerInputs.splice(index, 1);
}

export function markComposerInputDispatchPending(thread: ThreadInputState): void {
  thread.queuedInputDispatchPending = true;
}

export function isWaitingForTurn(thread: ThreadInputState, status: RunStatus): boolean {
  return status === "running" || thread.queuedInputDispatchPending;
}

export function takeNextQueuedInputForDispatch(
  thread: ThreadInputState | undefined,
  status: RunStatus | undefined,
): QueuedComposerInput | null {
  if (!thread || !status || isWaitingForTurn(thread, status)) return null;
  const queuedInput = thread.queuedComposerInputs.shift();
  if (!queuedInput) return null;
  markComposerInputDispatchPending(thread);
  return { op: structuredClone(current(queuedInput.op)) };
}

export function applyInputNotification(
  state: InitialPromptState,
  thread: ThreadInputState | undefined,
  notification: ThreadNotification,
): void {
  if (notification.type === "thread.error" && notification.commandId) {
    delete state.pendingInitialPrompts[notification.commandId];
  }
  if (!thread) return;

  switch (notification.type) {
    case "thread.started":
      thread.pendingInitialPrompt = notification.commandId
        ? state.pendingInitialPrompts[notification.commandId] ?? null
        : null;
      if (notification.commandId) delete state.pendingInitialPrompts[notification.commandId];
      break;
    case "turn.started":
    case "thread.error":
      thread.queuedInputDispatchPending = false;
      break;
    case "turn.completed":
      thread.pendingInitialPrompt = null;
      break;
  }
}

export function pendingInitialMessage(thread: ThreadInputState): UserMessageItem | null {
  const prompt = thread.pendingInitialPrompt;
  if (!prompt) return null;
  return {
    type: "user_message",
    id: `pending-${prompt.clientRequestId}`,
    text: summarizeInputItems(prompt.userInput.items),
    inputItems: [],
    pending: true,
  };
}

function summarizeInputItems(items: InputItem[]): string {
  return items.map((item) => {
    switch (item.type) {
      case "text":
      case "text_selection":
        return item.text;
      case "skill":
        return item.title || item.prompt;
      case "image":
        return "图片附件";
    }
  }).filter((value) => value.length > 0).join("\n\n");
}
