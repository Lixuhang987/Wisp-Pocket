import type { AgentMessage } from "@handagent/core/runtime/AgentMessage.ts";
import type { ThreadNotification } from "@handagent/core/protocol/ThreadNotification.ts";
import type { DynamicToolSpec } from "@handagent/core/protocol/DynamicTool.ts";

export type { DynamicToolSpec };

export type ThreadId = string;

export type ThreadSource = "user" | "subagent";

export type ThreadStoreErrorCode =
  | "thread_exists"
  | "thread_not_found"
  | "thread_not_open"
  | "thread_closed"
  | "not_implemented"
  | "sqlite_error";

export type ThreadStoreError = {
  code: ThreadStoreErrorCode;
  message: string;
  cause?: unknown;
};

export type ThreadStoreResult<T = void> =
  | { ok: true; value: T }
  | { ok: false; error: ThreadStoreError };

export type CreateThreadParams = {
  threadId: ThreadId;
  preview?: string | null;
  forkedFromId?: ThreadId | null;
  parentThreadId?: ThreadId | null;
  threadSource?: ThreadSource;
  originator?: string;
  agentPath?: string | null;
  dynamicTools?: DynamicToolSpec[];
  workspaceId?: string | null;
  timestamp?: string;
};

export type ResumeThreadParams = {
  threadId: ThreadId;
};

export type SessionMeta = {
  id: ThreadId;
  forkedFromId?: ThreadId;
  parentThreadId?: ThreadId;
  timestamp: string;
  originator: string;
  threadSource: ThreadSource;
  agentPath?: string;
  dynamicTools?: DynamicToolSpec[];
  workspaceId?: string | null;
};

export type CompactedItem = {
  status: "placeholder";
};

export type TurnContextItem = {
  turnId: string;
  status?: "running" | "completed" | "interrupted" | "failed";
  timestamp: string;
  auditEvents?: ThreadAuditEvent[];
};

export type RolloutItem =
  | { kind: "session_meta"; payload: SessionMeta }
  | { kind: "response_item"; payload: AgentMessage }
  | { kind: "compacted"; payload: CompactedItem }
  | { kind: "turn_context"; payload: TurnContextItem }
  | { kind: "event_msg"; payload: ThreadNotification };

export type StoredRolloutItem = RolloutItem & {
  sequence: number;
  createdAt: string;
};

export type StoredThreadHistory = {
  threadId: ThreadId;
  rolloutItems: StoredRolloutItem[];
  persisted: boolean;
};

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

export type AppendItemsInput = {
  threadId: ThreadId;
  items: RolloutItem[];
};

export type LoadHistoryInput = {
  threadId: ThreadId;
};
