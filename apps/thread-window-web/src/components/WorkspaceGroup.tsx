// apps/thread-window-web/src/components/WorkspaceGroup.tsx
import * as Accordion from '@radix-ui/react-accordion';
import type { ThreadListEntry } from '../protocol/threadProtocol.ts';
import { ThreadItem } from './ThreadItem.tsx';

interface WorkspaceGroupProps {
  workspace: { id: string; name: string; rootPath: string };
  threads: ThreadListEntry[];
  activeThreadId: string | null;
  isExpanded: boolean;
  onToggle: () => void;
  onOpenThread: (threadId: string) => void;
  onDeleteThread: (threadId: string) => void;
}

export function WorkspaceGroup({
  workspace,
  threads,
  activeThreadId,
  isExpanded,
  onToggle,
  onOpenThread,
  onDeleteThread,
}: WorkspaceGroupProps) {
  return (
    <Accordion.Item value={workspace.id} className="mb-xs">
      <Accordion.Header>
        <Accordion.Trigger
          onClick={onToggle}
          className="group flex w-full items-center gap-2 rounded-lg px-sm py-1.5 text-left text-xs text-app-text-primary transition-colors duration-200 hover:text-app-text-primary focus:outline-none"
        >
          <FolderIcon isExpanded={isExpanded} />

          <span className="min-w-0 flex-1 truncate font-medium">{workspace.name}</span>

          {/* 右侧操作按钮组 */}
          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            {/* 更多选项按钮 */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                // TODO: 实现更多选项菜单
              }}
              className="flex h-5 w-5 items-center justify-center rounded text-app-text-secondary hover:bg-app-surface-muted hover:text-app-text-primary"
              aria-label="更多选项"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                <circle cx="2" cy="6" r="1" />
                <circle cx="6" cy="6" r="1" />
                <circle cx="10" cy="6" r="1" />
              </svg>
            </button>

            {/* 删除按钮 */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                // TODO: 实现删除 workspace
              }}
              className="flex h-5 w-5 items-center justify-center rounded text-app-text-secondary hover:bg-app-surface-muted hover:text-app-text-primary"
              aria-label="删除工作区"
            >
              <svg width="10" height="10" viewBox="0 0 14 14">
                <path
                  d="M3 3L11 11M11 3L3 11"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
        <div className="flex flex-col gap-xs pt-xs pl-6">
          {threads.length === 0 ? (
            <p className="px-sm py-xs text-xs text-app-text-secondary">
              暂无对话
            </p>
          ) : (
            threads.map((thread) => (
              <ThreadItem
                key={thread.id}
                thread={thread}
                isActive={thread.id === activeThreadId}
                onOpen={() => onOpenThread(thread.id)}
                onDelete={() => onDeleteThread(thread.id)}
              />
            ))
          )}
        </div>
      </Accordion.Content>
    </Accordion.Item>
  );
}

function FolderIcon({ isExpanded }: { isExpanded: boolean }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 15 15"
      className="flex-shrink-0 text-app-text-secondary"
      aria-hidden="true"
    >
      {isExpanded ? (
        <path
          d="M1.75 6.25H4.8C5.25 6.25 5.66 5.99 5.85 5.59L6.25 4.75H12.5C13 4.75 13.36 5.23 13.22 5.71L11.82 10.71C11.64 11.34 11.07 11.78 10.42 11.78H3.44C2.78 11.78 2.2 11.33 2.03 10.69L1.35 8.16C1.1 7.2 1.82 6.25 2.81 6.25H4.8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M1.75 4.25C1.75 3.56 2.31 3 3 3H5.2L6.3 4.35H12C12.69 4.35 13.25 4.91 13.25 5.6V10.5C13.25 11.19 12.69 11.75 12 11.75H3C2.31 11.75 1.75 11.19 1.75 10.5V4.25Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}
