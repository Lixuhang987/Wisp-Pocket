import type { Workspace } from "@handagent/core/workspace/Workspace.ts";
import type { ThreadListEntry } from '../protocol/threadProtocol.ts';
const collator = new Intl.Collator(undefined, {numeric:true,sensitivity:"base"});
export function groupThreadsByWorkspace(threads: ThreadListEntry[], workspaces: Workspace[], searchQuery:string) {
  const query = searchQuery.toLowerCase();
  const grouped = new Map<string,ThreadListEntry[]>();
  for (const thread of threads) {
    if (query && !thread.preview?.toLowerCase().includes(query)) continue;
    const members = grouped.get(thread.workspaceId) ?? [];
    members.push(thread); grouped.set(thread.workspaceId,members);
  }
  return [...workspaces].sort((a,b)=>collator.compare(a.name,b.name)||a.id.localeCompare(b.id))
    .map(workspace=>({workspace,threads:grouped.get(workspace.id)??[]}));
}
