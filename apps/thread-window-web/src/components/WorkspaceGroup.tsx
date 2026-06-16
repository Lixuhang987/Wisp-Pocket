// apps/thread-window-web/src/components/WorkspaceGroup.tsx
import * as Accordion from '@radix-ui/react-accordion';
import type { ThreadListEntry } from '../protocol/threadProtocol.ts';
import { cn } from '../utils/cn.ts';
import { createThreadWindowStore } from '../store/threadWindowStore.ts';

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
          className="group flex w-full items-center gap-2 rounded-lg px-sm py-1.5 text-left text-xs text-app-text-primary transition-colors duration-200 hover:bg-app-surface-soft focus:outline-none focus:ring-4 focus:ring-app-accent-ring"
        >
          {/* 文件夹图标 */}
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            className="flex-shrink-0 text-app-text-secondary"
            aria-hidden="true"
          >
            {isExpanded ? (
              <path
                d="M2 3.5C2 2.67157 2.67157 2 3.5 2H5.5L6.5 3.5H10.5C11.3284 3.5 12 4.17157 12 5V10C12 10.8284 11.3284 11.5 10.5 11.5H3.5C2.67157 11.5 2 10.8284 2 10V3.5Z"
                stroke="currentColor"
                strokeWidth="1.2"
                fill="none"
              />
            ) : (
              <path
                d="M2 3.5C2 2.67157 2.67157 2 3.5 2H5.5L6.5 3.5H10.5C11.3284 3.5 12 4.17157 12 5V10C12 10.8284 11.3284 11.5 10.5 11.5H3.5C2.67157 11.5 2 10.8284 2 10V3.5Z"
                stroke="currentColor"
                strokeWidth="1.2"
                fill="none"
              />
            )}
          </svg>

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

// ThreadItem 组件
interface ThreadItemProps {
  thread: ThreadListEntry;
  isActive: boolean;
  onOpen: () => void;
  onDelete: () => void;
}

function ThreadItem({ thread, isActive, onOpen, onDelete }: ThreadItemProps) {
  const threadsById = createThreadWindowStore((state) => state.threadsById);
  const threadState = threadsById[thread.id];
  const isRunning = threadState?.status === 'running';

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen();
    }
  };

  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return '刚刚';
    if (diffHours < 24) return `${diffHours}小时`;
    if (diffDays < 7) return `${diffDays}天`;
    return date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={handleKeyDown}
      className={cn(
        'group flex items-center gap-xs rounded-lg px-sm py-1.5 transition-colors duration-200 focus:outline-none focus:ring-4 focus:ring-app-accent-ring',
        isActive
          ? 'bg-app-canvas'
          : 'hover:bg-app-surface-soft/80'
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className="truncate text-[13px] font-medium text-app-text-primary">
            {thread.preview || '新对话'}
          </span>
          <span className="flex-shrink-0 text-[10px] text-app-text-secondary">
            {formatRelativeTime(new Date(thread.updatedAt))}
          </span>
        </div>
      </div>

      {/* 运行状态指示器 */}
      {isRunning && (
        <div
          className="flex h-5 w-5 flex-shrink-0 items-center justify-center"
          aria-label="运行中"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" className="animate-spin text-app-accent">
            <circle
              cx="6"
              cy="6"
              r="4"
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
              strokeDasharray="6 18"
              strokeLinecap="round"
            />
          </svg>
        </div>
      )}

      {/* 删除按钮 */}
      <button
        onClick={(event) => {
          event.stopPropagation();
          onDelete();
        }}
        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-app-text-secondary opacity-0 transition-all duration-200 group-hover:opacity-70 hover:!opacity-100 hover:bg-app-surface-muted hover:text-app-text-primary focus:outline-none focus:ring-2 focus:ring-app-accent-ring"
        aria-label="删除对话"
      >
        <svg width="12" height="12" viewBox="0 0 14 14" aria-hidden="true">
          <path
            d="M3 3L11 11M11 3L3 11"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}
