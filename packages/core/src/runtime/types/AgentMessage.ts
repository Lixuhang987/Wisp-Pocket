import type { InputItem } from "../../protocol/types/Op.ts";
import type { ToolCallEnvelope } from "./ToolCallEnvelope.ts";

export type AgentTextContentPart = {
  type: "text";
  text: string;
};

export type AgentImageContentPart = {
  type: "image";
  blobId: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
};

export type AgentUserContent = string | Array<AgentTextContentPart | AgentImageContentPart>;

export type UserAgentMessage = {
  role: "user";
  id?: string;
  content: AgentUserContent;
  inputItems?: InputItem[];
};

export type AssistantAgentMessage = {
  role: "assistant";
  id?: string;
  content: string;
  toolCalls?: ToolCallEnvelope[];
  suggestedReplies?: string[];
  awaitingReply?: boolean;
};

export type ToolAgentMessage = {
  role: "tool";
  toolCallId: string;
  name: string;
  content: string;
  blob?: { id: string; cached: "turn" | "persist"; summarized?: boolean };
};

export type SystemAgentMessage = {
  role: "system";
  content: string;
};

export type AgentMessage =
  | UserAgentMessage
  | AssistantAgentMessage
  | ToolAgentMessage
  | SystemAgentMessage;
