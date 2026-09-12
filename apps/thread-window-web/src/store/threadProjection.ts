import type {
  RunStatus,
  ServerRequest,
  ThreadListEntry,
  ThreadNotification,
  ThreadSnapshotPayload,
  WorkspaceAskCandidate,
} from "../protocol/threadProtocol.ts";
import type {
  AssistantMessageItem,
  ThreadItem,
  ToolCallItem,
  UserMessageItem,
} from "./threadItems.ts";

export type PermissionRequestState = {
  id: string;
  toolName: string;
  toolCallId: string;
  argumentsJSON: string;
};

export type WorkspaceRequestState = {
  id: string;
  prompt: string;
  candidates: WorkspaceAskCandidate[];
};

export type ThreadProjection = {
  threadId: string;
  title: string | null;
  status: RunStatus;
  messages: ThreadItem[];
  permissionRequests: PermissionRequestState[];
  workspaceRequests: WorkspaceRequestState[];
  errorMessage: string | null;
};

export type ThreadWindowProjection = {
  windowErrorMessage: string | null;
  history: ThreadListEntry[];
  threadsById: Record<string, ThreadProjection>;
  processedNotificationIds: Record<string, true>;
  workspaces: Array<{ id: string; name: string; rootPath: string }>;
};

export function emptyThreadProjection(threadId: string, title: string | null): ThreadProjection {
  return {
    threadId,
    title,
    status: "idle",
    messages: [],
    permissionRequests: [],
    workspaceRequests: [],
    errorMessage: null,
  };
}

export function acceptNotification(state: ThreadWindowProjection, notification: ThreadNotification): boolean {
  if (notification.type === "assistant.delta" && state.processedNotificationIds[notification.notificationId]) {
    return false;
  }
  state.processedNotificationIds[notification.notificationId] = true;
  return true;
}

// The store prepares the complete Thread cache before applying this projection.
export function projectNotification(
  state: ThreadWindowProjection,
  notification: ThreadNotification,
  pendingMessage: UserMessageItem | null,
): void {
  switch (notification.type) {
    case "thread.started":
      upsertHistoryEntry(state, notification.threadId, {
        preview: notification.payload.preview,
        createdAt: notification.timestamp,
        updatedAt: notification.timestamp,
      });
      break;
    case "thread.snapshot": {
      const thread = state.threadsById[notification.threadId];
      thread.status = notification.payload.status;
      thread.messages = notification.payload.messages.map(snapshotMessageToItem);
      if (pendingMessage && !thread.messages.some((item) => item.type === "user_message" && item.pending)) {
        thread.messages.unshift(pendingMessage);
      }
      break;
    }
    case "user.message.recorded": {
      const thread = state.threadsById[notification.threadId];
      thread.messages = thread.messages.filter((item) => !(item.type === "user_message" && item.pending));
      thread.messages.push({
        type: "user_message",
        id: notification.payload.messageId,
        text: notification.payload.text,
        inputItems: notification.payload.items?.map((item) => structuredClone(item)) ?? [],
      });
      upsertHistoryEntry(state, notification.threadId, {
        preview: notification.payload.text,
        updatedAt: notification.timestamp,
        messageCount: thread.messages.length,
      });
      break;
    }
    case "turn.started":
      state.threadsById[notification.threadId].status = "running";
      break;
    case "assistant.delta": {
      const thread = state.threadsById[notification.threadId];
      const existing = thread.messages.find((item): item is AssistantMessageItem => item.type === "assistant_message" && item.id === notification.itemId);
      if (existing) {
        existing.text += notification.payload.text;
      } else {
        thread.messages.push({ type: "assistant_message", id: notification.itemId, text: notification.payload.text });
      }
      break;
    }
    case "tool.started":
      state.threadsById[notification.threadId].messages.push({
        type: "tool_call",
        id: notification.itemId,
        toolName: notification.payload.name,
        input: JSON.stringify(notification.payload.input),
        output: null,
        status: "running",
      });
      break;
    case "tool.finished": {
      const thread = state.threadsById[notification.threadId];
      const existing = thread.messages.find((item): item is ToolCallItem => item.type === "tool_call" && item.id === notification.itemId);
      if (existing) {
        existing.output = notification.payload.output;
        existing.status = notification.payload.status;
        existing.toolName = notification.payload.name;
      } else {
        thread.messages.push({
          type: "tool_call",
          id: notification.itemId,
          toolName: notification.payload.name,
          input: null,
          output: notification.payload.output,
          status: notification.payload.status,
        });
      }
      break;
    }
    case "turn.completed": {
      const thread = state.threadsById[notification.threadId];
      thread.status = notification.payload.status === "completed" ? "idle" : notification.payload.status;
      clearThreadRequests(thread);
      upsertHistoryEntry(state, notification.threadId, { updatedAt: notification.timestamp, messageCount: thread.messages.length });
      break;
    }
    case "thread.status.changed": {
      const thread = state.threadsById[notification.threadId];
      thread.status = notification.payload.value;
      if (thread.status !== "running") clearThreadRequests(thread);
      upsertHistoryEntry(state, notification.threadId, { updatedAt: notification.timestamp, messageCount: thread.messages.length });
      break;
    }
    case "thread.listed":
      state.history = notification.payload.threads;
      break;
    case "workspace.listed":
      state.workspaces = notification.payload.workspaces;
      break;
    case "thread.deleted":
      if (notification.payload.status === "deleted") {
        state.history = state.history.filter((item) => item.id !== notification.payload.targetThreadId);
      }
      break;
    case "thread.error":
      if (notification.threadId) {
        const thread = state.threadsById[notification.threadId];
        thread.errorMessage = notification.payload.message;
        thread.status = "failed";
        clearThreadRequests(thread);
      } else {
        state.windowErrorMessage = notification.payload.message;
      }
      break;
  }
}

export function projectRequest(thread: ThreadProjection, request: ServerRequest): void {
  if (request.type === "permission.requested") {
    thread.permissionRequests.push({
      id: request.requestId,
      toolName: request.payload.toolName,
      toolCallId: request.payload.toolCallId,
      argumentsJSON: JSON.stringify(request.payload.arguments),
    });
  } else {
    thread.workspaceRequests.push({
      id: request.requestId,
      prompt: request.payload.prompt,
      candidates: request.payload.candidates,
    });
  }
}

export function resolvePermissionRequest(state: ThreadWindowProjection, requestId: string): void {
  for (const thread of Object.values(state.threadsById)) {
    thread.permissionRequests = thread.permissionRequests.filter((request) => request.id !== requestId);
  }
}

export function resolveWorkspaceRequest(state: ThreadWindowProjection, requestId: string): void {
  for (const thread of Object.values(state.threadsById)) {
    thread.workspaceRequests = thread.workspaceRequests.filter((request) => request.id !== requestId);
  }
}

function clearThreadRequests(thread: ThreadProjection): void {
  thread.permissionRequests = [];
  thread.workspaceRequests = [];
}

function snapshotMessageToItem(message: ThreadSnapshotPayload["messages"][number]): ThreadItem {
  switch (message.role) {
    case "tool":
      return {
        type: "tool_call",
        id: message.id,
        toolName: message.toolCall?.name ?? "unknown",
        input: null,
        output: message.text,
        status: message.status === "running" ? "running" : message.status === "failed" ? "failed" : "completed",
      };
    case "user":
      return {
        type: "user_message",
        id: message.id,
        text: message.text,
        inputItems: message.inputItems?.map((item) => structuredClone(item)) ?? [],
      };
    case "assistant":
      return { type: "assistant_message", id: message.id, text: message.text };
    default:
      return { type: "error", id: message.id, message: message.text };
  }
}

function upsertHistoryEntry(
  state: ThreadWindowProjection,
  threadId: string,
  update: Partial<Omit<ThreadListEntry, "id">>,
): void {
  const existingIndex = state.history.findIndex((entry) => entry.id === threadId);
  const existing = existingIndex >= 0 ? state.history[existingIndex] : null;
  const createdAt = update.createdAt ?? existing?.createdAt ?? update.updatedAt ?? new Date(0).toISOString();
  const updatedAt = update.updatedAt ?? existing?.updatedAt ?? createdAt;
  const nextEntry: ThreadListEntry = {
    id: threadId,
    preview: Object.hasOwn(update, "preview") ? update.preview ?? null : existing?.preview ?? null,
    createdAt,
    updatedAt,
    messageCount: update.messageCount ?? existing?.messageCount ?? 0,
    workspaceId: Object.hasOwn(update, "workspaceId") ? update.workspaceId ?? null : existing?.workspaceId ?? null,
  };
  if (existingIndex >= 0) {
    state.history[existingIndex] = nextEntry;
  } else {
    state.history.push(nextEntry);
  }
  state.history.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
