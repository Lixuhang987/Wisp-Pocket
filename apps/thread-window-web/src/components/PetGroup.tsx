// apps/thread-window-web/src/components/PetGroup.tsx
import * as Accordion from '@radix-ui/react-accordion';
import { Folder, FolderOpen, MoreHorizontal, X } from 'lucide-react';
import type { ThreadListEntry } from '../protocol/threadProtocol.ts';
import { ThreadItem } from './ThreadItem.tsx';

interface PetGroupProps {
  pet: { id: string; name: string; rootPath: string };
  threads: ThreadListEntry[];
  activeThreadId: string | null;
  isExpanded: boolean;
  onToggle: () => void;
  onOpenThread: (threadId: string) => void;
  onDeleteThread: (threadId: string) => void;
}

export function PetGroup({
  pet,
  threads,
  activeThreadId,
  isExpanded,
  onToggle,
  onOpenThread,
  onDeleteThread,
}: PetGroupProps) {
  return (
    <Accordion.Item value={pet.id} className="mb-xs">
      <Accordion.Header>
        <Accordion.Trigger
          onClick={onToggle}
          className="group flex w-full items-center gap-2 rounded-lg px-sm py-1.5 text-left text-xs text-app-text-primary transition-colors duration-200 hover:text-app-text-primary focus:outline-none"
        >
          <FolderIcon isExpanded={isExpanded} />

          <span className="min-w-0 flex-1 truncate font-medium">{pet.name}</span>

          <span className="text-app-text-muted">{pet.id.slice(-6)}</span>
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
