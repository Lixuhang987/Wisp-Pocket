import type { AgentMessage } from "../../runtime/types/AgentMessage.ts";
import type { DynamicToolSpec } from "../../protocol/types/DynamicTool.ts";
import type { UserInput } from "../../protocol/types/Op.ts";

export type ThreadMetadata = {
  id: string;
  preview: string | null;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  petId: string;
  petSnapshot: import("../../pet/Pet.ts").PetSnapshot;
  rootPath: string;
  dynamicTools?: DynamicToolSpec[];
};

export type ThreadSummary = Pick<
  ThreadMetadata,
  "id" | "preview" | "createdAt" | "updatedAt" | "messageCount" | "petId" | "petSnapshot" | "rootPath"
> & {status?: import("../../protocol/types/ThreadProtocolShared.ts").RunStatus};

export type PersistedThread = {
  version: 1;
  metadata: ThreadMetadata;
  messages: AgentMessage[];
  events: ThreadAuditEvent[];
  pendingInputs?: Array<{ opId: string; payload: UserInput }>;
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
