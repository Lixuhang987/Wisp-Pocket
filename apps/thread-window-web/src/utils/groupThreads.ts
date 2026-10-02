// apps/thread-window-web/src/utils/groupThreads.ts
import type { ThreadListEntry } from '../protocol/threadProtocol.ts';

const petNameCollator = new Intl.Collator("en", {
  numeric: true,
  sensitivity: "base",
});

export interface GroupedThreads {
  petGroups: Array<{
    pet: { id: string; name: string; rootPath: string };
    threads: ThreadListEntry[];
  }>;
}

export function groupThreadsByPet(
  threads: ThreadListEntry[],
  pets: Array<{ id: string; name: string; rootPath: string }>,
  searchQuery: string
): GroupedThreads {
  // 过滤搜索
  const filtered = searchQuery
    ? threads.filter(t =>
        t.preview?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : threads;

  // 按 petId 分组
  const grouped = new Map<string, ThreadListEntry[]>();
  for (const thread of filtered) {
    const key = thread.petId;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(thread);
  }

  const sortedPets = [...pets].sort((a, b) => {
    const byName = petNameCollator.compare(a.name, b.name);
    if (byName !== 0) return byName;
    return a.id.localeCompare(b.id);
  });

  return {
    petGroups: sortedPets.map(ws => ({
      pet: ws,
      threads: grouped.get(ws.id) ?? [],
    })),
  };
}
