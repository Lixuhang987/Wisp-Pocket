import { Plus, Search } from 'lucide-react';
import { useMemo } from 'react';
import * as Accordion from '@radix-ui/react-accordion';
import { createThreadWindowStore } from '../store/threadWindowStore.ts';
import { groupThreadsByWorkspace } from '../utils/groupThreads.ts';
import { ThreadItem } from './ThreadItem.tsx';
import { WorkspaceGroup } from './WorkspaceGroup.tsx';

interface HistorySidebarProps {
  activeThreadId: string | null;
  onOpenThread: (threadId: string) => void;
  onDeleteThread: (threadId: string) => void;
  onNewThread: (workspaceId?: string) => void;
}

export function HistorySidebar({
  activeThreadId,
  onOpenThread,
  onDeleteThread,
  onNewThread,
}: HistorySidebarProps) {
  const history = createThreadWindowStore((state) => state.history);
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
      <header className="mb-sm space-y-xs">
        <button
          onClick={() => onNewThread()}
          className="flex h-7 w-7 items-center justify-center rounded-md bg-transparent text-app-text-secondary transition-colors duration-200 hover:bg-app-surface-muted focus:outline-none focus:ring-4 focus:ring-app-accent-ring"
          aria-label="新建对话"
        >
          <Plus size={16} strokeWidth={2} />
        </button>
      </header>

      <div className="relative mb-sm">
        <Search size={14} strokeWidth={1.5} className="pointer-events-none absolute left-sm top-1/2 -translate-y-1/2 text-app-text-muted" aria-hidden="true" />
        <input
          type="search"
          placeholder="搜索对话..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-8 w-full rounded-lg border-0 bg-app-surface-muted pl-[calc(theme(spacing.sm)+18px)] pr-sm text-sm text-app-text-primary placeholder:text-app-text-muted outline-none transition-shadow duration-200 focus:border-app-accent focus:ring-4 focus:ring-app-accent-ring"
        />
      </div>

      {/* 全部项目一级分组 */}
      <Accordion.Root
        type="multiple"
        value={Array.from(expandedWorkspaceIds)}
        className="flex-1 min-h-0 space-y-xs overflow-y-auto overflow-x-hidden pr-1"
      >
        {/* 项目内包含所有伙伴的历史 */}
        {grouped.map((group) => (
          <WorkspaceGroup
            key={group.workspace.id}
            workspace={group.workspace}
            threads={group.threads}
            activeThreadId={activeThreadId}
            isExpanded={expandedWorkspaceIds.has(group.workspace.id)}
            onToggle={() => toggleWorkspaceExpanded(group.workspace.id)}
            onNewThread={() => onNewThread(group.workspace.id)}
            onOpenThread={onOpenThread}
            onDeleteThread={onDeleteThread}
          />
        ))}

        {history.length === 0 && (
          <p className="rounded-lg border border-app-hairline bg-app-canvas/70 px-sm py-md text-sm leading-6 text-app-text-secondary">
            暂无对话历史
          </p>
        )}
      </Accordion.Root>
    </aside>
  );
}
