import { produce } from "immer";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  InitialPromptPayload,
  ServerRequest,
  ThreadNotification,
} from "../protocol/threadProtocol.ts";
import type { ConnectionState } from "../thread/threadSocketClient.ts";
import * as inputHandoff from "./inputHandoff.ts";
import type { InitialPromptState, ThreadInputState } from "./inputHandoff.ts";
import * as projection from "./threadProjection.ts";
import type { ThreadProjection, ThreadWindowProjection } from "./threadProjection.ts";
import { createWindowPreferences, windowPreferencePersistence, type WindowPreferences } from "./windowPreferences.ts";

export type { ConnectionState } from "../thread/threadSocketClient.ts";
export type { PermissionRequestState, WorkspaceRequestState } from "./threadProjection.ts";
export type { ThreadItem } from "./threadItems.ts";
export { isUserMessage, isAssistantMessage, isToolCall, isError } from "./threadItems.ts";

export type ThreadState = ThreadProjection & ThreadInputState;

export type ThreadWindowState = Omit<ThreadWindowProjection, "threadsById"> & InitialPromptState & WindowPreferences & {
  connectionState: ConnectionState;
  threadsById: Record<string, ThreadState>;
  setConnectionState(state: ConnectionState): void;
  enqueueInitialPrompt(prompt: InitialPromptPayload): void;
  ensureThreadState(threadId: string): void;
  resolvePermissionRequest(requestId: string): void;
  resolveWorkspaceRequest(requestId: string): void;
  setWorkspaces(workspaces: ThreadWindowProjection["workspaces"]): void;
  handleNotification(notification: ThreadNotification): void;
  handleRequest(request: ServerRequest): void;
};

function emptyThreadState(threadId: string, title: string | null = null): ThreadState {
  return { ...projection.emptyThreadProjection(threadId, title), ...inputHandoff.emptyThreadInputState() };
}

function ensureThread(state: ThreadWindowState, threadId: string): ThreadState {
  return state.threadsById[threadId] ??= emptyThreadState(threadId);
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
  ...createWindowPreferences(set),

  setConnectionState(state) {
    set({ connectionState: state });
  },

  setWorkspaces(workspaces) {
    set({ workspaces });
  },

  enqueueInitialPrompt(prompt) {
    set(produce<ThreadWindowState>((draft) => inputHandoff.enqueueInitialPrompt(draft, prompt)));
  },

  ensureThreadState(threadId) {
    set(produce<ThreadWindowState>((draft) => { ensureThread(draft, threadId); }));
  },

  resolvePermissionRequest(requestId) {
    set(produce<ThreadWindowState>((draft) => projection.resolvePermissionRequest(draft, requestId)));
  },

  resolveWorkspaceRequest(requestId) {
    set(produce<ThreadWindowState>((draft) => projection.resolveWorkspaceRequest(draft, requestId)));
  },

  handleNotification(notification) {
    set(produce<ThreadWindowState>((draft) => {
      if (!projection.acceptNotification(draft, notification)) return;
      let thread: ThreadState | undefined;
      if (notification.type === "thread.started") {
        thread = draft.threadsById[notification.threadId] = emptyThreadState(notification.threadId, notification.payload.preview);
      } else if (notification.type === "request.resolved") {
        thread = draft.threadsById[notification.threadId];
      } else if ("threadId" in notification && notification.threadId) {
        thread = ensureThread(draft, notification.threadId);
      }

      inputHandoff.applyInputNotification(draft, thread, notification);
      projection.projectNotification(
        draft,
        notification,
        thread && notification.type === "thread.snapshot" ? inputHandoff.pendingInitialMessage(thread) : null,
      );

      if (notification.type === "thread.deleted" && notification.payload.status === "deleted") {
        delete draft.threadsById[notification.payload.targetThreadId];
      }
    }));
  },

  handleRequest(request) {
    set(produce<ThreadWindowState>((draft) => projection.projectRequest(ensureThread(draft, request.threadId), request)));
  },
}), windowPreferencePersistence<ThreadWindowState>()));
}

export const createThreadWindowStore = makeThreadWindowStore();
