import { useRef, useState } from "react";
import { Composer } from "./Composer.tsx";
import { MessageList } from "./MessageList.tsx";
import { RequestPanels } from "./RequestPanels.tsx";
import type { InputItem, UserInput } from "../protocol/threadProtocol.ts";
import { createThreadWindowStore } from "../store/threadWindowStore.ts";
import { createEmptyComposerItems } from "./Composer.tsx";
import { getAvailableSkills } from "../native/nativeConfig.ts";

type ThreadWorkspacePaneProps = {
  threadId: string | null;
  onSubmit(threadId: string, input: UserInput): void;
  onStop(threadId: string): void;
  onRemoveQueuedInput(threadId: string, index: number): void;
  onAnswerPermission(requestId: string, decision: "allow" | "deny", scope: "once" | "always"): void;
  onAnswerWorkspace(requestId: string, workspaceId: string | null): void;
};

export function ThreadWorkspacePane({
  threadId,
  onSubmit,
  onStop,
  onRemoveQueuedInput,
  onAnswerPermission,
  onAnswerWorkspace,
}: ThreadWorkspacePaneProps) {
  const defaultComposerItemsRef = useRef<Record<string, InputItem[]>>({});
  const [composerItemsByThread, setComposerItemsByThread] = useState<Record<string, InputItem[]>>({});
  const connectionState = createThreadWindowStore((s) => s.connectionState);
  const windowErrorMessage = createThreadWindowStore((s) => s.windowErrorMessage);
  const availableSkills = getAvailableSkills();
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
              items={thread.messages}
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
            availableSkills={availableSkills}
            inputItems={composerInputItems}
            onInputItemsChange={updateComposerInputItems}
            onSubmit={submitComposerInput}
            onRemoveQueuedInput={(index) => onRemoveQueuedInput(thread.threadId, index)}
            onStop={() => onStop(thread.threadId)}
          />
        </>
      ) : (
        <div className="flex min-h-0 min-w-0 items-center justify-center overflow-hidden">
          <span className="text-sm text-app-text-muted">选择历史或创建新对话</span>
        </div>
      )}
    </section>
  );
}

function defaultComposerItemsFor(store: Record<string, InputItem[]>, threadId: string): InputItem[] {
  store[threadId] ??= createEmptyComposerItems();
  return store[threadId];
}
