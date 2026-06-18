import { current, produce } from "immer";
import { create } from "zustand";
import type { PersistStorage, StorageValue } from "zustand/middleware";
import { persist } from "zustand/middleware";
import type {
  InitialPromptPayload,
  InputItem,
  RuntimeOp,
  RunStatus,
  ServerRequest,
  ThreadListEntry,
  ThreadNotification,
  WorkspaceAskCandidate,
} from "../protocol/threadProtocol.ts";

const EXPANDED_WORKSPACE_IDS_STORAGE_KEY = "handAgent.threadWindow.expandedWorkspaceIds";

type PersistedThreadWindowState = {
  expandedWorkspaceIds: string[];
};

function getLocalStorage(): Storage | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export type ConnectionState = "disconnected" | "connecting" | "connected";

export type ThreadMessage = {
  id: string;
  role: "user" | "assistant" | "tool" | "system";
  text: string;
  userInputItems?: InputItem[];
  pending?: boolean;
  toolName?: string;
  status?: string;
};

export type QueuedComposerInput = {
  op: RuntimeOp;
};

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

export type ThreadState = {
  threadId: string;
  title: string | null;
  status: RunStatus;
  messages: ThreadMessage[];
  pendingInitialPrompt: InitialPromptPayload | null;
  queuedComposerInputs: QueuedComposerInput[];
  queuedInputDispatchPending: boolean;
  permissionRequests: PermissionRequestState[];
  workspaceRequests: WorkspaceRequestState[];
  errorMessage: string | null;
};

export type ThreadWindowState = {
  connectionState: ConnectionState;
  windowErrorMessage: string | null;
  history: ThreadListEntry[];
  threadsById: Record<string, ThreadState>;
  pendingInitialPrompts: Record<string, InitialPromptPayload>;
  processedNotificationIds: Record<string, true>;
  workspaces: Array<{ id: string; name: string; rootPath: string }>;
  expandedWorkspaceIds: Set<string>;
  searchQuery: string;
  setConnectionState(state: ConnectionState): void;
  enqueueInitialPrompt(prompt: InitialPromptPayload): void;
  ensureThreadState(threadId: string): void;
  resolvePermissionRequest(requestId: string): void;
  resolveWorkspaceRequest(requestId: string): void;
  setWorkspaces(workspaces: Array<{ id: string; name: string; rootPath: string }>): void;
  toggleWorkspaceExpanded(workspaceId: string): void;
  setSearchQuery(query: string): void;
  queueComposerInput(threadId: string, op: RuntimeOp): void;
  removeQueuedComposerInput(threadId: string, index: number): void;
  markComposerInputDispatchPending(threadId: string): void;
  takeNextQueuedInputForDispatch(threadId: string): QueuedComposerInput | null;
  handleNotification(notification: ThreadNotification): void;
  handleRequest(request: ServerRequest): void;
};

function emptyThreadState(threadId: string, title: string | null = null): ThreadState {
  return {
    threadId,
    title,
    status: "idle",
    messages: [],
    pendingInitialPrompt: null,
    queuedComposerInputs: [],
    queuedInputDispatchPending: false,
    permissionRequests: [],
    workspaceRequests: [],
    errorMessage: null,
  };
}

export const createThreadWindowStore = create<ThreadWindowState>()(persist((set) => ({
  connectionState: "disconnected",
  windowErrorMessage: null,
  history: [],
  threadsById: {},
  pendingInitialPrompts: {},
  processedNotificationIds: {},
  workspaces: [],
  expandedWorkspaceIds: new Set(),
  searchQuery: "",

  setConnectionState(state) {
    set({ connectionState: state });
  },

  setWorkspaces(workspaces) {
    set({ workspaces });
  },

  toggleWorkspaceExpanded(workspaceId) {
    set((state) => {
      const nextExpandedWorkspaceIds = new Set(state.expandedWorkspaceIds);

      if (nextExpandedWorkspaceIds.has(workspaceId)) {
        nextExpandedWorkspaceIds.delete(workspaceId);
      } else {
        nextExpandedWorkspaceIds.add(workspaceId);
      }

      return { expandedWorkspaceIds: nextExpandedWorkspaceIds };
    });
  },

  setSearchQuery(query) {
    set({ searchQuery: query });
  },

  queueComposerInput(threadId, op) {
    set(produce<ThreadWindowState>((draft) => {
      const thread = draft.threadsById[threadId] ??= emptyThreadState(threadId);
      thread.queuedComposerInputs.push({ op });
    }));
  },

  removeQueuedComposerInput(threadId, index) {
    set(produce<ThreadWindowState>((draft) => {
      const thread = draft.threadsById[threadId];
      if (!thread || index < 0 || index >= thread.queuedComposerInputs.length) {
        return;
      }
      thread.queuedComposerInputs.splice(index, 1);
    }));
  },

  markComposerInputDispatchPending(threadId) {
    set(produce<ThreadWindowState>((draft) => {
      const thread = draft.threadsById[threadId] ??= emptyThreadState(threadId);
      thread.queuedInputDispatchPending = true;
    }));
  },

  takeNextQueuedInputForDispatch(threadId) {
    let nextInput: QueuedComposerInput | null = null;
    set(produce<ThreadWindowState>((draft) => {
      const thread = draft.threadsById[threadId];
      if (
        !thread
        || thread.status === "running"
        || thread.queuedInputDispatchPending
        || thread.queuedComposerInputs.length === 0
      ) {
        return;
      }
      const queuedInput = thread.queuedComposerInputs.shift() ?? null;
      if (queuedInput) {
        nextInput = { op: cloneOp(current(queuedInput.op)) };
        thread.queuedInputDispatchPending = true;
      }
    }));
    return nextInput;
  },

  enqueueInitialPrompt(prompt) {
    set(produce<ThreadWindowState>((draft) => {
      draft.pendingInitialPrompts[prompt.clientRequestId] = prompt;
    }));
  },

  ensureThreadState(threadId) {
    set(produce<ThreadWindowState>((draft) => {
      draft.threadsById[threadId] ??= emptyThreadState(threadId);
    }));
  },

  resolvePermissionRequest(requestId) {
    set(produce<ThreadWindowState>((draft) => {
      for (const thread of Object.values(draft.threadsById)) {
        thread.permissionRequests = thread.permissionRequests.filter((request) => request.id !== requestId);
      }
    }));
  },

  resolveWorkspaceRequest(requestId) {
    set(produce<ThreadWindowState>((draft) => {
      for (const thread of Object.values(draft.threadsById)) {
        thread.workspaceRequests = thread.workspaceRequests.filter((request) => request.id !== requestId);
      }
    }));
  },

  handleNotification(notification) {
    set(produce<ThreadWindowState>((draft) => {
      switch (notification.type) {
        case "thread.started": {
          draft.processedNotificationIds[notification.notificationId] = true;
          const prompt = notification.commandId
            ? draft.pendingInitialPrompts[notification.commandId]
            : undefined;
          if (notification.commandId) {
            delete draft.pendingInitialPrompts[notification.commandId];
          }
          draft.threadsById[notification.threadId] = emptyThreadState(
            notification.threadId,
            notification.payload.preview,
          );
          draft.threadsById[notification.threadId].pendingInitialPrompt = prompt ?? null;
          upsertHistoryEntry(draft, notification.threadId, {
            preview: notification.payload.preview,
            createdAt: notification.timestamp,
            updatedAt: notification.timestamp,
          });
          break;
        }

        case "thread.snapshot": {
          draft.processedNotificationIds[notification.notificationId] = true;
          const thread = draft.threadsById[notification.threadId] ??= emptyThreadState(notification.threadId);
          thread.status = notification.payload.status;
          thread.messages = notification.payload.messages.map((message) => ({
            id: message.id,
            role: message.role,
            text: message.text,
            ...(message.role === "user" && message.inputItems ? { userInputItems: message.inputItems.map(cloneInputItem) } : {}),
            status: message.status,
            toolName: message.toolCall?.name,
          }));
          if (
            thread.pendingInitialPrompt
            && !thread.messages.some((message) => message.role === "user" && message.pending)
          ) {
            const pendingText = summarizeInputItems(thread.pendingInitialPrompt.userInput.items);
            thread.messages.unshift({
              id: `pending-${thread.pendingInitialPrompt.clientRequestId}`,
              role: "user",
              text: pendingText,
              pending: true,
            });
          }
          break;
        }

        case "user.message.recorded": {
          draft.processedNotificationIds[notification.notificationId] = true;
          const thread = draft.threadsById[notification.threadId] ??= emptyThreadState(notification.threadId);
          thread.messages = thread.messages.filter((message) => !message.pending);
          thread.messages.push({
            id: notification.payload.messageId,
            role: "user",
            text: notification.payload.text,
            ...(notification.payload.items ? { userInputItems: notification.payload.items.map(cloneInputItem) } : {}),
          });
          upsertHistoryEntry(draft, notification.threadId, {
            preview: notification.payload.text,
            updatedAt: notification.timestamp,
            messageCount: thread.messages.length,
          });
          break;
        }

        case "turn.started": {
          draft.processedNotificationIds[notification.notificationId] = true;
          const thread = draft.threadsById[notification.threadId] ??= emptyThreadState(notification.threadId);
          thread.status = "running";
          thread.queuedInputDispatchPending = false;
          break;
        }

        case "assistant.delta": {
          if (draft.processedNotificationIds[notification.notificationId]) {
            break;
          }
          draft.processedNotificationIds[notification.notificationId] = true;
          const thread = draft.threadsById[notification.threadId] ??= emptyThreadState(notification.threadId);
          const existing = thread.messages.find((message) => message.id === notification.itemId);
          if (existing) {
            existing.text += notification.payload.text;
          } else {
            thread.messages.push({
              id: notification.itemId,
              role: "assistant",
              text: notification.payload.text,
            });
          }
          break;
        }

        case "tool.started": {
          draft.processedNotificationIds[notification.notificationId] = true;
          const thread = draft.threadsById[notification.threadId] ??= emptyThreadState(notification.threadId);
          thread.messages.push({
            id: notification.itemId,
            role: "tool",
            text: JSON.stringify(notification.payload.input),
            toolName: notification.payload.name,
            status: "running",
          });
          break;
        }

        case "tool.finished": {
          draft.processedNotificationIds[notification.notificationId] = true;
          const thread = draft.threadsById[notification.threadId] ??= emptyThreadState(notification.threadId);
          const existing = thread.messages.find((message) => message.id === notification.itemId);
          if (existing) {
            existing.text = notification.payload.output;
            existing.status = notification.payload.status;
            existing.toolName = notification.payload.name;
          } else {
            thread.messages.push({
              id: notification.itemId,
              role: "tool",
              text: notification.payload.output,
              toolName: notification.payload.name,
              status: notification.payload.status,
            });
          }
          break;
        }

        case "turn.completed": {
          draft.processedNotificationIds[notification.notificationId] = true;
          const thread = draft.threadsById[notification.threadId] ??= emptyThreadState(notification.threadId);
          thread.status = notification.payload.status === "completed" ? "idle" : notification.payload.status;
          thread.pendingInitialPrompt = null;
          clearThreadRequests(thread);
          upsertHistoryEntry(draft, notification.threadId, {
            updatedAt: notification.timestamp,
            messageCount: thread.messages.length,
          });
          break;
        }

        case "thread.status.changed": {
          draft.processedNotificationIds[notification.notificationId] = true;
          const thread = draft.threadsById[notification.threadId] ??= emptyThreadState(notification.threadId);
          thread.status = notification.payload.value;
          if (thread.status !== "running") {
            clearThreadRequests(thread);
          }
          upsertHistoryEntry(draft, notification.threadId, {
            updatedAt: notification.timestamp,
            messageCount: thread.messages.length,
          });
          break;
        }

        case "thread.listed":
          draft.processedNotificationIds[notification.notificationId] = true;
          draft.history = notification.payload.threads;
          break;

        case "workspace.listed":
          draft.processedNotificationIds[notification.notificationId] = true;
          draft.workspaces = notification.payload.workspaces;
          break;

        case "thread.deleted":
          draft.processedNotificationIds[notification.notificationId] = true;
          if (notification.payload.status !== "deleted") {
            break;
          }
          draft.history = draft.history.filter((item) => item.id !== notification.payload.targetThreadId);
          delete draft.threadsById[notification.payload.targetThreadId];
          break;

        case "thread.error": {
          draft.processedNotificationIds[notification.notificationId] = true;
          if (notification.commandId) {
            delete draft.pendingInitialPrompts[notification.commandId];
          }
          if (notification.threadId) {
            const thread = draft.threadsById[notification.threadId] ??= emptyThreadState(notification.threadId);
            thread.errorMessage = notification.payload.message;
            thread.status = "failed";
            thread.queuedInputDispatchPending = false;
            clearThreadRequests(thread);
          } else {
            draft.windowErrorMessage = notification.payload.message;
          }
          break;
        }
      }
    }));
  },

  handleRequest(request) {
    set(produce<ThreadWindowState>((draft) => {
      const thread = draft.threadsById[request.threadId] ??= emptyThreadState(request.threadId);
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
    }));
  },
}), {
  name: EXPANDED_WORKSPACE_IDS_STORAGE_KEY,
  storage: createExpandedWorkspaceIdsStorage(),
  partialize: (state) => ({
    expandedWorkspaceIds: Array.from(state.expandedWorkspaceIds),
  }),
  merge: (persistedState, currentState) => {
    const persisted = persistedState as Partial<PersistedThreadWindowState> | undefined;
    return {
      ...currentState,
      expandedWorkspaceIds: new Set(
        persisted?.expandedWorkspaceIds?.filter((value): value is string => typeof value === "string") ?? [],
      ),
    };
  },
}));

function createExpandedWorkspaceIdsStorage(): PersistStorage<PersistedThreadWindowState> {
  return {
    getItem(name) {
      const storage = getLocalStorage();
      if (!storage) return null;
      try {
        const rawValue = storage.getItem(name);
        if (!rawValue) return null;
        const parsed = JSON.parse(rawValue) as unknown;
        if (Array.isArray(parsed)) {
          return {
            state: {
              expandedWorkspaceIds: parsed.filter((value): value is string => typeof value === "string"),
            },
          };
        }
        if (isStorageValue(parsed)) {
          return parsed;
        }
        return null;
      } catch {
        return null;
      }
    },
    setItem(name, value) {
      const storage = getLocalStorage();
      if (!storage) return;
      try {
        storage.setItem(name, JSON.stringify(value));
      } catch {
        // Persistence is best-effort; losing it must not block the UI toggle.
      }
    },
    removeItem(name) {
      getLocalStorage()?.removeItem(name);
    },
  };
}

function cloneOp(op: RuntimeOp): RuntimeOp {
  return structuredClone(op);
}

function cloneInputItem(item: InputItem): InputItem {
  return structuredClone(item);
}

function isStorageValue(value: unknown): value is StorageValue<PersistedThreadWindowState> {
  if (typeof value !== "object" || value === null || !("state" in value)) {
    return false;
  }
  const state = (value as { state?: unknown }).state;
  return typeof state === "object" && state !== null && "expandedWorkspaceIds" in state;
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

function clearThreadRequests(thread: ThreadState): void {
  thread.permissionRequests = [];
  thread.workspaceRequests = [];
}

function upsertHistoryEntry(
  draft: ThreadWindowState,
  threadId: string,
  update: Partial<Omit<ThreadListEntry, "id">>,
): void {
  const existingIndex = draft.history.findIndex((entry) => entry.id === threadId);
  const existing = existingIndex >= 0 ? draft.history[existingIndex] : null;
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
    draft.history[existingIndex] = nextEntry;
  } else {
    draft.history.push(nextEntry);
  }
  draft.history.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
