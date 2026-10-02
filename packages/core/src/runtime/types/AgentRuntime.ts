import type { AgentMessage } from "./AgentMessage.ts";

export type AgentRunResult = {
  messages: AgentMessage[];
};

export type AssistantMessageStartEvent = {
  type: "assistant_message_start";
  messageId: string;
  payload: { role: "assistant" };
};

export type AssistantMessageDeltaEvent = {
  type: "assistant_message_delta";
  messageId: string;
  payload: { text: string; suggestedReplies?: string[]; awaitingReply?: boolean };
};

export type AssistantMessageEndEvent = {
  type: "assistant_message_end";
  messageId: string;
  payload: { status: "completed" | "interrupted" };
};

export type ToolCallEvent = {
  type: "tool_call";
  toolCallId: string;
  toolName: string;
  input: Record<string, unknown>;
};

export type ToolResultEvent = {
  type: "tool_result";
  toolCallId: string;
  toolName: string;
  status: "success" | "error";
  output: string;
  durationMs: number;
};

export type PermissionDecisionEvent = {
  type: "permission_decision";
  toolCallId: string;
  toolName: string;
  decision: "allow" | "deny";
  scope?: "once" | "always";
  reason?: string;
};

export type RuntimeErrorEvent = {
  type: "runtime_error";
  message: string;
  code?: string;
};

export type AgentRuntimeEvent =
  | AssistantMessageStartEvent
  | AssistantMessageDeltaEvent
  | AssistantMessageEndEvent
  | ToolCallEvent
  | ToolResultEvent
  | PermissionDecisionEvent
  | RuntimeErrorEvent;

export type AgentRuntimeRunOptions = {
  threadId?: string;
  turnId?: string;
  signal?: AbortSignal;
  rootPath?: string;
  rolePrompt?: string;
};

export type AgentRuntimeEventSink = (event: AgentRuntimeEvent) => void;

export type ToolExecutionResult = {
  content: string;
  status: "success" | "error";
  durationMs: number;
};
