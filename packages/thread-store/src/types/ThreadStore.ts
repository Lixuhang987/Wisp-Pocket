import type { AgentMessage } from "@handagent/core/runtime/types/AgentMessage.ts";
import type { ThreadNotification } from "@handagent/core/protocol/types/ThreadNotification.ts";
import type { DynamicToolSpec } from "@handagent/core/protocol/types/DynamicTool.ts";

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
  petId: string;
  petSnapshot?: import("@handagent/core/pet/Pet.ts").PetSnapshot;
  commandId?: string;
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
  petId: string;
  petSnapshot?: import("@handagent/core/pet/Pet.ts").PetSnapshot;
  commandId?: string;
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

export type { ThreadMetadata, ThreadSummary, PersistedThread, ThreadAuditEventType, ToolCallAuditEvent, ToolResultAuditEvent, PermissionRequestAuditEvent, ErrorAuditEvent, ThreadAuditEvent } from "@handagent/core/thread/types/ThreadHistory.ts";
import type { ThreadAuditEvent } from "@handagent/core/thread/types/ThreadHistory.ts";

export type AppendItemsInput = {
  threadId: ThreadId;
  items: RolloutItem[];
};

export type LoadHistoryInput = {
  threadId: ThreadId;
};
