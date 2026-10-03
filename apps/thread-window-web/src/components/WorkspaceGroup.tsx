// apps/thread-window-web/src/components/WorkspaceGroup.tsx
import * as Accordion from '@radix-ui/react-accordion';
import { Folder, FolderOpen, Plus } from 'lucide-react';
import type { ThreadListEntry } from '../protocol/threadProtocol.ts';
import { ThreadItem } from './ThreadItem.tsx';

interface WorkspaceGroupProps {
  workspace: { id: string; name: string; rootPath: string };
  threads: ThreadListEntry[];
  activeThreadId: string | null;
  isExpanded: boolean;
  onNewThread: () => void;
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
  onNewThread,
  onOpenThread,
  onDeleteThread,
}: WorkspaceGroupProps) {
  return (
    <Accordion.Item value={workspace.id} className="mb-xs">
      <Accordion.Header className="flex items-center">
        <Accordion.Trigger
          onClick={onToggle}
          className="group flex w-full items-center gap-2 rounded-lg px-sm py-1.5 text-left text-xs text-app-text-primary transition-colors duration-200 hover:text-app-text-primary focus:outline-none"
        >
          <FolderIcon isExpanded={isExpanded} />

          <span className="min-w-0 flex-1 truncate font-medium">{workspace.name}</span>

          <span className="text-app-text-muted">{threads.length}</span>
        </Accordion.Trigger>
        <button aria-label={`在 ${workspace.name} 新建对话`} onClick={onNewThread} className="rounded-md p-xs text-app-text-secondary hover:bg-app-surface-muted"><Plus size={14}/></button>
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
