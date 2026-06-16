// apps/thread-window-web/src/components/WorkspaceGroup.tsx
import * as Accordion from '@radix-ui/react-accordion';
import { Folder, FolderOpen, MoreHorizontal, X } from 'lucide-react';
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
              <MoreHorizontal size={12} />
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
              <X size={10} strokeWidth={1.5} />
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
  const Icon = isExpanded ? FolderOpen : Folder;
  return <Icon size={15} className="flex-shrink-0 text-app-text-secondary" aria-hidden="true" />;
}
