import type { InputItem } from "../protocol/threadProtocol.ts";

// ---------------------------------------------------------------------------
// ThreadItem — Codex 风格 discriminated union
// ---------------------------------------------------------------------------

export type ToolCallStatus = "running" | "completed" | "failed";

export type UserMessageItem = {
  type: "user_message";
  id: string;
  text: string;
  inputItems: InputItem[];
  pending?: boolean;
};

// Display attachment only; the original skill Input Item remains model/persistence input.
export type RolePromptAttachment = { type: "role_prompt"; id: string; text: string; label: string };

export function rolePromptAttachment(item: InputItem): RolePromptAttachment | null {
  return item.type === "skill" && item.actionId === "initial-role"
    ? { type: "role_prompt", id: item.id, text: item.prompt, label: `${item.title} · ${item.prompt}` }
    : null;
}

export type AssistantMessageItem = {
  type: "assistant_message";
  id: string;
  text: string;
  suggestedReplies?: string[];
  awaitingReply?: boolean;
};

export type ToolCallItem = {
  type: "tool_call";
  id: string;
  toolName: string;
  /** JSON.stringify of tool input（来自 tool.started；snapshot 恢复时为 null） */
  input: string | null;
  /** tool output（来自 tool.finished；running 时为 null） */
  output: string | null;
  status: ToolCallStatus;
};

export type ErrorItem = {
  type: "error";
  id: string;
  message: string;
};

export type ThreadItem =
  | UserMessageItem
  | AssistantMessageItem
  | ToolCallItem
  | ErrorItem;

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

export function isUserMessage(item: ThreadItem): item is UserMessageItem {
  return item.type === "user_message";
}

export function isAssistantMessage(item: ThreadItem): item is AssistantMessageItem {
  return item.type === "assistant_message";
}

export function isToolCall(item: ThreadItem): item is ToolCallItem {
  return item.type === "tool_call";
}

export function isError(item: ThreadItem): item is ErrorItem {
  return item.type === "error";
}

export function hasAssistantText(item: AssistantMessageItem): boolean {
  return !!item.text.trim();
}

export function hasSuggestedReplies(item: AssistantMessageItem): item is AssistantMessageItem & { suggestedReplies: string[] } {
  return !!item.awaitingReply && !!item.suggestedReplies?.length;
}

export function hasAssistantContent(item: AssistantMessageItem): boolean {
  return hasAssistantText(item) || hasSuggestedReplies(item);
}
