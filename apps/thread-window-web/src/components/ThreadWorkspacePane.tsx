import { useRef, useState } from "react";
import { Composer } from "./Composer.tsx";
import { MessageList } from "./MessageList.tsx";
import { RequestPanels } from "./RequestPanels.tsx";
import type { InputItem, UserInput } from "../protocol/threadProtocol.ts";
import { createThreadWindowStore, type ConnectionState } from "../store/threadWindowStore.ts";
import { createEmptyComposerItems } from "./Composer.tsx";

type ThreadWorkspacePaneProps = {
  threadId: string | null;
  connectionState: ConnectionState;
  windowErrorMessage: string | null;
  onSubmit(threadId: string, input: UserInput): void;
  onStop(threadId: string): void;
  onRemoveQueuedInput(threadId: string, index: number): void;
  onAnswerPermission(requestId: string, decision: "allow" | "deny"): void;
  onAnswerWorkspace(requestId: string, workspaceId: string | null): void;
};

export function ThreadWorkspacePane({
  threadId,
  connectionState,
  windowErrorMessage,
  onSubmit,
  onStop,
  onRemoveQueuedInput,
  onAnswerPermission,
  onAnswerWorkspace,
}: ThreadWorkspacePaneProps) {
  const defaultComposerItemsRef = useRef<Record<string, InputItem[]>>({});
  const [composerItemsByThread, setComposerItemsByThread] = useState<Record<string, InputItem[]>>({});
  const state = createThreadWindowStore();
  const liveState = createThreadWindowStore.getState();
  const thread = threadId
    ? state.threadsById[threadId] ?? liveState.threadsById[threadId] ?? null
    : null;
  const composerInputItems = thread
    ? composerItemsByThread[thread.threadId] ?? defaultComposerItemsFor(defaultComposerItemsRef.current, thread.threadId)
    : createEmptyComposerItems();

  const updateComposerInputItems = (nextItems: InputItem[]) => {
    if (!thread) return;
    setComposerItemsByThread((current) => ({
      ...current,
      [thread.threadId]: nextItems,
    }));
  };

  const submitComposerInput = (input: UserInput) => {
    if (!thread) return;
    onSubmit(thread.threadId, input);
    const emptyItems = createEmptyComposerItems();
    defaultComposerItemsRef.current[thread.threadId] = emptyItems;
    setComposerItemsByThread((current) => ({
      ...current,
      [thread.threadId]: emptyItems,
    }));
  };

  return (
    <section
      className="grid h-screen min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden bg-app-canvas/80 text-app-text-primary shadow-product-inner"
      aria-label="Thread workspace"
    >
      <div className="min-h-0 min-w-0 overflow-hidden" data-thread-window-error-slot="true">
        {windowErrorMessage ? (
          <div className="mx-sm mt-xs rounded-md border border-app-error/30 bg-app-error/10 px-sm py-xs text-sm text-app-error">
            {windowErrorMessage}
          </div>
        ) : null}
      </div>

      {thread ? (
        <>
          <div className="grid min-h-0 min-w-0 grid-rows-[minmax(0,1fr)_auto] overflow-hidden">
            <MessageList
              messages={thread.messages}
              errorMessage={thread.errorMessage}
              isRunning={thread.status === "running"}
            />
            <RequestPanels
              permissionRequests={thread.permissionRequests}
              workspaceRequests={thread.workspaceRequests}
              onAnswerPermission={onAnswerPermission}
              onAnswerWorkspace={onAnswerWorkspace}
            />
          </div>
          <Composer
            disabled={connectionState !== "connected"}
            stopDisabled={connectionState !== "connected" || thread.status !== "running"}
            queuedInputs={thread.queuedComposerInputs}
            inputItems={composerInputItems}
            onInputItemsChange={updateComposerInputItems}
            onSubmit={submitComposerInput}
            onRemoveQueuedInput={(index) => onRemoveQueuedInput(thread.threadId, index)}
            onStop={() => onStop(thread.threadId)}
          />
        </>
      ) : (
        <div className="flex min-h-0 min-w-0 items-center justify-center overflow-hidden text-sm text-app-text-muted">
          <div className="rounded-xl border border-app-hairline bg-app-surface-elevated/95 px-lg py-md text-center shadow-[var(--thread-window-floating-shadow)]">
            <div className="font-display text-[30px] leading-none text-app-text-primary">准备开始</div>
            <div className="mt-xs text-sm text-app-text-secondary">选择历史或创建新对话</div>
          </div>
        </div>
      )}
    </section>
  );
}

function defaultComposerItemsFor(store: Record<string, InputItem[]>, threadId: string): InputItem[] {
  store[threadId] ??= createEmptyComposerItems();
  return store[threadId];
}
