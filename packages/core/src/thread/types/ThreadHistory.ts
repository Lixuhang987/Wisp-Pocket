import type { AgentMessage } from "../../runtime/types/AgentMessage.ts";
import type { DynamicToolSpec } from "../../protocol/types/DynamicTool.ts";

export type ThreadMetadata = {
  id: string;
  preview: string | null;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  workspaceId: string | null;
  dynamicTools?: DynamicToolSpec[];
};

export type ThreadSummary = Pick<
  ThreadMetadata,
  "id" | "preview" | "createdAt" | "updatedAt" | "messageCount" | "workspaceId"
>;

export type PersistedThread = {
  version: 1;
  metadata: ThreadMetadata;
  messages: AgentMessage[];
  events: ThreadAuditEvent[];
};

export type ThreadAuditEventType =
  | "tool_call"
  | "tool_result"
  | "permission_request"
  | "error";

export type ToolCallAuditEvent = {
  type: "tool_call";
  timestamp: string;
  toolCallId: string;
  toolName: string;
  input: Record<string, unknown>;
};

export type ToolResultAuditEvent = {
  type: "tool_result";
  timestamp: string;
  toolCallId: string;
  status: "success" | "error";
  output?: string;
  durationMs?: number;
};

export type PermissionRequestAuditEvent = {
  type: "permission_request";
  timestamp: string;
  toolName: string;
  action: string;
  granted: boolean;
};

export type ErrorAuditEvent = {
  type: "error";
  timestamp: string;
  message: string;
  code?: string;
};

export type ThreadAuditEvent =
  | ToolCallAuditEvent
  | ToolResultAuditEvent
  | PermissionRequestAuditEvent
  | ErrorAuditEvent;

