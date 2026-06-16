import { useMemo } from 'react';
import * as Accordion from '@radix-ui/react-accordion';
import { createThreadWindowStore } from '../store/threadWindowStore.ts';
import { groupThreadsByWorkspace } from '../utils/groupThreads.ts';
import { cn } from '../utils/cn.ts';
import type { ThreadListEntry } from '../protocol/threadProtocol.ts';
import { WorkspaceGroup } from './WorkspaceGroup.tsx';

interface HistorySidebarProps {
  history: ThreadListEntry[];
  activeThreadId: string | null;
  onOpenThread: (threadId: string) => void;
  onDeleteThread: (threadId: string) => void;
  onNewThread: () => void;
}

export function HistorySidebar({
  history,
  activeThreadId,
  onOpenThread,
  onDeleteThread,
  onNewThread,
}: HistorySidebarProps) {
  const workspaces = createThreadWindowStore((state) => state.workspaces);
  const searchQuery = createThreadWindowStore((state) => state.searchQuery);
  const expandedWorkspaceIds = createThreadWindowStore((state) => state.expandedWorkspaceIds);
  const setSearchQuery = createThreadWindowStore((state) => state.setSearchQuery);
  const toggleWorkspaceExpanded = createThreadWindowStore((state) => state.toggleWorkspaceExpanded);

  const grouped = useMemo(
    () => groupThreadsByWorkspace(history, workspaces, searchQuery),
    [history, workspaces, searchQuery]
  );

  return (
    <aside className="flex h-screen min-h-0 min-w-0 flex-col overflow-hidden border-r border-app-hairline bg-app-surface/95 p-sm shadow-[var(--thread-window-panel-shadow)]">
      <header className="mb-sm">
        <div className="flex items-center gap-xs">
          <span className="grid h-7 w-7 place-items-center rounded-lg border border-app-hairline bg-app-surface-elevated text-app-accent shadow-soft" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 2.2L13.2 5.4V10.6L8 13.8L2.8 10.6V5.4L8 2.2Z" stroke="currentColor" strokeWidth="1.4" />
              <path d="M8 5.1V10.9M5.1 8H10.9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </span>
          <h1 className="font-display text-[25px] font-normal leading-none text-app-text-primary">
            HandAgent
          </h1>
        </div>
        <p className="mt-xs text-xs text-app-text-secondary">
          本地 thread 工作台
        </p>
        <button
          onClick={onNewThread}
          className="mt-sm h-10 w-full rounded-lg bg-app-accent px-sm text-sm font-semibold text-app-on-accent shadow-soft transition-colors duration-200 hover:bg-app-accent-hover focus:outline-none focus:ring-4 focus:ring-app-accent-ring disabled:bg-app-surface-muted disabled:text-app-text-secondary"
        >
          新建对话
        </button>
      </header>

      <input
        type="search"
        placeholder="搜索对话..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="mb-sm h-10 w-full rounded-lg border border-app-hairline bg-app-canvas/80 px-sm text-sm text-app-text-primary placeholder:text-app-text-muted outline-none transition-shadow duration-200 focus:border-app-accent focus:ring-4 focus:ring-app-accent-ring"
      />

      {/* Workspace 分组和默认分组 */}
      <Accordion.Root
        type="multiple"
        value={Array.from(expandedWorkspaceIds)}
        className="flex-1 min-h-0 space-y-xs overflow-y-auto overflow-x-hidden pr-1"
      >
        {/* Workspace 分组 */}
        {grouped.workspaceGroups.map((group) => (
          <WorkspaceGroup
            key={group.workspace.id}
            workspace={group.workspace}
            threads={group.threads}
            activeThreadId={activeThreadId}
            isExpanded={expandedWorkspaceIds.has(group.workspace.id)}
            onToggle={() => toggleWorkspaceExpanded(group.workspace.id)}
            onOpenThread={onOpenThread}
            onDeleteThread={onDeleteThread}
          />
        ))}

        {/* 默认分组 - 固定在底部 */}
        {grouped.defaultGroup.length > 0 && (
          <div className="mt-md border-t border-app-hairline pt-sm">
            <h3 className="px-sm py-xs text-xs font-medium text-app-text-secondary">
              默认对话
            </h3>
            <div className="flex flex-col gap-xs">
              {grouped.defaultGroup.map((thread) => (
                <ThreadItem
                  key={thread.id}
                  thread={thread}
                  isActive={thread.id === activeThreadId}
                  onOpen={() => onOpenThread(thread.id)}
                  onDelete={() => onDeleteThread(thread.id)}
                />
              ))}
            </div>
          </div>
        )}

        {history.length === 0 && (
          <p className="rounded-lg border border-app-hairline bg-app-canvas/70 px-sm py-md text-sm leading-6 text-app-text-secondary">
            暂无对话历史
          </p>
        )}
      </Accordion.Root>
    </aside>
  );
}

// ThreadItem 组件（与 WorkspaceGroup 中的定义一致）
interface ThreadItemProps {
  thread: ThreadListEntry;
  isActive: boolean;
  onOpen: () => void;
  onDelete: () => void;
}

function ThreadItem({ thread, isActive, onOpen, onDelete }: ThreadItemProps) {
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
        'group flex items-center gap-xs rounded-lg border px-sm py-1.5 transition-colors duration-200 focus:outline-none focus:ring-4 focus:ring-app-accent-ring',
        isActive
          ? 'border-app-hairline bg-app-canvas shadow-soft'
          : 'border-transparent hover:bg-app-surface-soft/80'
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
