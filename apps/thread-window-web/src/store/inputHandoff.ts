import type {
  InitialPromptPayload,
  InputItem,
  ThreadNotification,
} from "../protocol/threadProtocol.ts";
import type { UserMessageItem } from "./threadItems.ts";

export type ThreadInputState = {
  pendingInitialPrompt: InitialPromptPayload | null;
};

export type InitialPromptState = {
  pendingInitialPrompts: Record<string, InitialPromptPayload>;
};

export function emptyThreadInputState(): ThreadInputState {
  return {
    pendingInitialPrompt: null,
  };
}

export function enqueueInitialPrompt(state: InitialPromptState, prompt: InitialPromptPayload): void {
  state.pendingInitialPrompts[prompt.clientRequestId] = prompt;
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
      case "pdf":
        return `PDF：${item.name}`;
    }
  }).filter((value) => value.length > 0).join("\n\n");
}
