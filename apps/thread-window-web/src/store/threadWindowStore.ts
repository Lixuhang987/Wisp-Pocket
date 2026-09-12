import { produce } from "immer";
import { create } from "zustand";
import type { PersistStorage, StorageValue } from "zustand/middleware";
import { persist } from "zustand/middleware";
import type {
  InitialPromptPayload,
  InputItem,
  RunStatus,
  ServerRequest,
  ThreadListEntry,
  ThreadNotification,
  WorkspaceAskCandidate,
} from "../protocol/threadProtocol.ts";
import type {
  AssistantMessageItem,
  ThreadItem,
  ToolCallItem,
  ToolCallStatus,
  UserMessageItem,
} from "./threadItems.ts";

export type { ThreadItem } from "./threadItems.ts";
export { isUserMessage, isAssistantMessage, isToolCall, isError } from "./threadItems.ts";

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
  messages: ThreadItem[];
  pendingInitialPrompt: InitialPromptPayload | null;
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
    permissionRequests: [],
    workspaceRequests: [],
    errorMessage: null,
  };
}

export function makeThreadWindowStore() {
return create<ThreadWindowState>()(persist((set) => ({
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
      if (draft.processedNotificationIds[notification.notificationId]) return;
      switch (notification.type) {
        case "thread.started": {
          draft.processedNotificationIds[notification.notificationId] = true;
          draft.windowErrorMessage = null;
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
            createdAt: notification.payload.createdAt ?? notification.timestamp,
            updatedAt: notification.timestamp,
          });
          break;
        }

        case "thread.snapshot": {
          draft.processedNotificationIds[notification.notificationId] = true;
          const thread = draft.threadsById[notification.threadId] ??= emptyThreadState(notification.threadId);
          thread.status = notification.payload.status;
          thread.messages = notification.payload.messages.map((message): ThreadItem => {
            switch (message.role) {
              case "tool":
                return {
                  type: "tool_call",
                  id: message.id,
                  toolName: message.toolCall?.name ?? "unknown",
                  input: null,
                  output: message.text,
                  status: (message.status === "running" ? "running" : message.status === "failed" ? "failed" : "completed") as ToolCallStatus,
                };
              case "user":
                return {
                  type: "user_message",
                  id: message.id,
                  text: message.text,
                  inputItems: message.inputItems ? message.inputItems.map(cloneInputItem) : [],
                  ...(message.pending ? { pending: true } : {}),
                };
              case "assistant":
                return {
                  type: "assistant_message",
                  id: message.id,
                  text: message.text,
                  suggestedReplies: message.suggestedReplies,
                  awaitingReply: message.awaitingReply,
                };
              default:
                return {
                  type: "error",
                  id: message.id,
                  message: message.text,
                };
            }
          });
          thread.permissionRequests = [];
          thread.workspaceRequests = [];
          for (const request of notification.payload.pendingRequests ?? []) addRequest(thread, request);
          if (
            thread.pendingInitialPrompt
            && !thread.messages.some((item) => item.type === "user_message" && item.pending)
          ) {
            const pendingText = summarizeInputItems(thread.pendingInitialPrompt.userInput.items);
            thread.messages.unshift({
              type: "user_message",
              id: `pending-${thread.pendingInitialPrompt.clientRequestId}`,
              text: pendingText,
              inputItems: [],
              pending: true,
            });
          }
          break;
        }

        case "user.message.recorded": {
          draft.processedNotificationIds[notification.notificationId] = true;
          const thread = draft.threadsById[notification.threadId] ??= emptyThreadState(notification.threadId);
          thread.messages = thread.messages.filter((item) => !(item.type === "user_message" && item.pending && item.id.startsWith("pending-")));
          for (const item of thread.messages) if (item.type === "assistant_message") item.awaitingReply = false;
          const userItem: UserMessageItem = {
            type: "user_message",
            id: notification.payload.messageId,
            text: notification.payload.text,
            inputItems: notification.payload.items ? notification.payload.items.map(cloneInputItem) : [],
            ...(notification.payload.pending ? { pending: true } : {}),
          };
          const existing = thread.messages.findIndex((item) => item.id === userItem.id);
          if (existing >= 0) thread.messages[existing] = userItem;
          else thread.messages.push(userItem);
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
          thread.errorMessage = null;
          for (const message of thread.messages) if (message.type === "assistant_message") message.awaitingReply = false;
          const input = thread.messages.find((item) => item.type === "user_message" && item.id === notification.turnId);
          if (input?.type === "user_message") input.pending = false;
          break;
        }

        case "assistant.delta": {
          if (draft.processedNotificationIds[notification.notificationId]) {
            break;
          }
          draft.processedNotificationIds[notification.notificationId] = true;
          const thread = draft.threadsById[notification.threadId] ??= emptyThreadState(notification.threadId);
          const existing = thread.messages.find((item): item is AssistantMessageItem => item.type === "assistant_message" && item.id === notification.itemId);
          if (existing) {
            existing.text += notification.payload.text;
            if (notification.payload.suggestedReplies) existing.suggestedReplies = notification.payload.suggestedReplies;
            if (notification.payload.awaitingReply !== undefined) existing.awaitingReply = notification.payload.awaitingReply;
          } else {
            thread.messages.push({
              type: "assistant_message",
              id: notification.itemId,
              text: notification.payload.text,
              suggestedReplies: notification.payload.suggestedReplies,
              awaitingReply: notification.payload.awaitingReply,
            });
          }
          break;
        }

        case "tool.started": {
          draft.processedNotificationIds[notification.notificationId] = true;
          const thread = draft.threadsById[notification.threadId] ??= emptyThreadState(notification.threadId);
          thread.messages.push({
            type: "tool_call",
            id: notification.itemId,
            toolName: notification.payload.name,
            input: JSON.stringify(notification.payload.input),
            output: null,
            status: "running",
          });
          break;
        }

        case "tool.finished": {
          draft.processedNotificationIds[notification.notificationId] = true;
          const thread = draft.threadsById[notification.threadId] ??= emptyThreadState(notification.threadId);
          const existing = thread.messages.find((item): item is ToolCallItem => item.type === "tool_call" && item.id === notification.itemId);
          if (existing) {
            existing.output = notification.payload.output;
            existing.status = notification.payload.status as ToolCallStatus;
            existing.toolName = notification.payload.name;
          } else {
            thread.messages.push({
              type: "tool_call",
              id: notification.itemId,
              toolName: notification.payload.name,
              input: null,
              output: notification.payload.output,
              status: notification.payload.status as ToolCallStatus,
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

        case "request.resolved": {
          draft.processedNotificationIds[notification.notificationId] = true;
          const thread = draft.threadsById[notification.threadId];
          if (thread) {
            thread.permissionRequests = thread.permissionRequests.filter((request) => request.id !== notification.payload.requestId);
            thread.workspaceRequests = thread.workspaceRequests.filter((request) => request.id !== notification.payload.requestId);
          }
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
      addRequest(thread, request);
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
}

export const createThreadWindowStore = makeThreadWindowStore();

function addRequest(thread: ThreadState, request: ServerRequest): void {
  if (request.type === "permission.requested") {
    if (!thread.permissionRequests.some((item) => item.id === request.requestId)) thread.permissionRequests.push({
      id: request.requestId, toolName: request.payload.toolName, toolCallId: request.payload.toolCallId,
      argumentsJSON: JSON.stringify(request.payload.arguments),
    });
  } else if (!thread.workspaceRequests.some((item) => item.id === request.requestId)) thread.workspaceRequests.push({
    id: request.requestId, prompt: request.payload.prompt, candidates: request.payload.candidates,
  });
}

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
      case "pdf":
        return `PDF：${item.name}`;
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
