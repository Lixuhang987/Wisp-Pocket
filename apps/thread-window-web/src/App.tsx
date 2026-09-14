import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { useCallback, useEffect, useRef, useState } from "react";
import { HistorySidebar } from "./components/HistorySidebar.tsx";
import { ThreadWorkspacePane } from "./components/ThreadWorkspacePane.tsx";
import { openHistoryThread } from "./history/openHistoryThread.ts";
import {
  getThreadWebSocketURL,
  installInitialPromptReceiver,
  installThreadOpenReceiver,
} from "./native/nativeConfig.ts";
import { applyThemeToDocument, getInitialTheme, installThemeSubscription } from "./native/themeConfig.ts";
import {
  encodePermissionAnswer,
  encodeThreadDelete,
  encodeThreadStart,
  encodeWorkspaceAnswer,
} from "./protocol/threadProtocol.ts";
import { createThreadWindowStore } from "./store/threadWindowStore.ts";
import { ThreadSocketClient } from "./thread/threadSocketClient.ts";
import { ThreadInputController } from "./thread/threadInputController.ts";
import { useSidebarLayout } from "./utils/sidebarLayout.ts";

function now() {
  return new Date().toISOString();
}

function id(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function App() {
  const clientRef = useRef<ThreadSocketClient | null>(null);
  const inputControllerRef = useRef<ThreadInputController | null>(null);
  const pendingSelectionCommandsRef = useRef(new Set<string>());
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [deleteTargetThreadId, setDeleteTargetThreadId] = useState<string | null>(null);
  const sidebarLayout = useSidebarLayout();

  const handleOpenThread = useCallback((threadId: string) => {
    openHistoryThread(threadId, {
      ensureThreadState: (nextThreadId) => {
        createThreadWindowStore.getState().ensureThreadState(nextThreadId);
      },
      setActiveThreadId,
      resumeThread: (nextThreadId) => {
        clientRef.current?.resumeThread(nextThreadId);
      },
    });
  }, []);

  useEffect(() => {
    applyThemeToDocument(getInitialTheme());
    return installThemeSubscription((theme) => {
      applyThemeToDocument(theme);
    });
  }, []);

  useEffect(() => {
    const pendingSelectionCommands = pendingSelectionCommandsRef.current;
    const socket = new ThreadSocketClient({
      url: getThreadWebSocketURL(),
      onConnectionState: (connectionState) => createThreadWindowStore.getState().setConnectionState(connectionState),
      onNotification: (notification) => inputs.handleNotification(notification),
      onRequest: (request) => createThreadWindowStore.getState().handleRequest(request),
    });
    const inputs = new ThreadInputController({
      getState: createThreadWindowStore.getState,
      client: socket,
      onNotification: (notification) => {
        if ((notification.type === "thread.started" || notification.type === "thread.error") && notification.commandId) {
          const shouldSelect = pendingSelectionCommands.delete(notification.commandId);
          if (notification.type === "thread.started" && shouldSelect) {
            setActiveThreadId(notification.threadId);
          }
        }
      },
    });
    clientRef.current = socket;
    inputControllerRef.current = inputs;
    socket.connect();
    const disposeInitialPromptReceiver = installInitialPromptReceiver((payload) => {
      const wasPending = pendingSelectionCommands.has(payload.clientRequestId);
      pendingSelectionCommands.add(payload.clientRequestId);
      try {
        inputs.startInitialPrompt(payload);
      } catch (error) {
        if (!wasPending) pendingSelectionCommands.delete(payload.clientRequestId);
        throw error;
      }
    });
    const disposeThreadOpenReceiver = installThreadOpenReceiver(handleOpenThread);

    return () => {
      disposeInitialPromptReceiver();
      disposeThreadOpenReceiver();
      pendingSelectionCommands.clear();
      socket.disconnect();
      if (clientRef.current === socket) {
        clientRef.current = null;
      }
      if (inputControllerRef.current === inputs) {
        inputControllerRef.current = null;
      }
    };
  }, [handleOpenThread]);


  const handleNewThread = () => {
    const client = clientRef.current;
    if (!client) return;
    const commandId = id('start');
    const timestamp = now();

    pendingSelectionCommandsRef.current.add(commandId);
    try {
      client.sendRaw(encodeThreadStart({ commandId, timestamp, workspaceId: null }));
    } catch (error) {
      pendingSelectionCommandsRef.current.delete(commandId);
      throw error;
    }
  };

  return (
    <main
      className="grid h-screen w-full max-w-full overflow-hidden bg-app-canvas text-app-text-primary font-body [background-image:radial-gradient(circle_at_78%_-12%,var(--thread-window-glow-warm),transparent_34%),radial-gradient(circle_at_18%_104%,var(--thread-window-glow-cool),transparent_30%)]"
      style={{ gridTemplateColumns: sidebarLayout.gridTemplateColumns }}
    >
      {sidebarLayout.isSidebarVisible ? (
        <HistorySidebar
          activeThreadId={activeThreadId}
          onOpenThread={handleOpenThread}
          onDeleteThread={(threadId) => {
            setDeleteTargetThreadId(threadId);
          }}
          onNewThread={handleNewThread}
        />
      ) : null}
      <section className="relative min-h-0 min-w-0 overflow-hidden">
        <ThreadWorkspacePane
          threadId={activeThreadId}
          onSubmit={(threadId, userInput) => {
            inputControllerRef.current?.submitComposerInput(threadId, userInput);
          }}
          onStop={(threadId) => {
            const latestThread = createThreadWindowStore.getState().threadsById[threadId];
            if (createThreadWindowStore.getState().connectionState !== "connected" || latestThread?.status !== "running") {
              return;
            }
            clientRef.current?.submitOp(threadId, {
              type: "interrupt",
              opId: id("interrupt"),
              timestamp: now(),
              payload: { reason: "user" },
            });
          }}
          onAnswerPermission={(requestId, decision, scope) => {
            clientRef.current?.sendRaw(encodePermissionAnswer({
              requestId,
              timestamp: now(),
              decision,
              scope,
            }));
          }}
          onAnswerWorkspace={(requestId, workspaceId) => {
            clientRef.current?.sendRaw(encodeWorkspaceAnswer({
              requestId,
              timestamp: now(),
              ...(workspaceId ? { workspaceId } : { cancelled: true }),
            }));
          }}
        />
        <AlertDialog.Root
          open={deleteTargetThreadId !== null}
          onOpenChange={(open) => {
            if (!open) setDeleteTargetThreadId(null);
          }}
        >
          <AlertDialog.Portal>
            <AlertDialog.Overlay className="fixed inset-0 z-20 bg-app-canvas/55 backdrop-blur-sm" />
            <AlertDialog.Content className="fixed left-1/2 top-1/2 z-20 w-full max-w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-app-hairline bg-app-surface-elevated p-lg text-app-text-primary shadow-[var(--thread-window-floating-shadow)] focus:outline-none">
              <AlertDialog.Title className="text-base font-semibold">
                删除这个 thread？
              </AlertDialog.Title>
              <AlertDialog.Description className="mt-xs text-sm leading-6 text-app-text-secondary">
                历史记录会从本地持久化中移除。
              </AlertDialog.Description>
              <div className="mt-md flex justify-end gap-xs">
                <AlertDialog.Action
                  className="h-9 rounded-md bg-app-error px-sm text-sm font-medium text-app-on-accent transition-colors hover:bg-app-error/90 focus:outline-none focus:ring-4 focus:ring-app-accent-ring"
                  onClick={() => {
                    if (!deleteTargetThreadId) return;
                    clientRef.current?.sendRaw(encodeThreadDelete({
                      commandId: id("delete"),
                      timestamp: now(),
                      targetThreadId: deleteTargetThreadId,
                    }));
                  }}
                >
                  删除
                </AlertDialog.Action>
                <AlertDialog.Cancel
                  className="h-9 rounded-md border border-app-hairline bg-app-surface px-sm text-sm font-medium text-app-text-primary transition-colors hover:bg-app-surface-soft focus:outline-none focus:ring-4 focus:ring-app-accent-ring"
                >
                  取消
                </AlertDialog.Cancel>
              </div>
            </AlertDialog.Content>
          </AlertDialog.Portal>
        </AlertDialog.Root>
      </section>
    </main>
  );
}
