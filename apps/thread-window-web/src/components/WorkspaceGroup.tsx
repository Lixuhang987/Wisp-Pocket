// apps/thread-window-web/src/components/WorkspaceGroup.tsx
import * as Accordion from '@radix-ui/react-accordion';
import type { ThreadListEntry } from '../protocol/threadProtocol.ts';
import { cn } from '../utils/cn.ts';

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
          className="flex w-full items-center justify-between rounded-lg px-sm py-1.5 text-left text-xs text-app-text-primary transition-colors duration-200 hover:bg-app-surface-soft focus:outline-none focus:ring-4 focus:ring-app-accent-ring"
        >
          <span className="min-w-0 truncate font-medium">{workspace.name}</span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            className={cn(
              'ml-xs flex-shrink-0 text-app-text-secondary transition-transform',
              isExpanded && 'rotate-180'
            )}
          >
            <path
              d="M3 5L6 8L9 5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        </Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
        <div className="flex flex-col gap-xs pt-xs">
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
