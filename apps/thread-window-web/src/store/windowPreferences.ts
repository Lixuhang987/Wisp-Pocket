import type { PersistOptions, PersistStorage, StorageValue } from "zustand/middleware";

const EXPANDED_WORKSPACE_IDS_STORAGE_KEY = "handAgent.threadWindow.expandedWorkspaceIds";

export type WindowPreferences = {
  expandedWorkspaceIds: Set<string>;
  searchQuery: string;
  toggleWorkspaceExpanded(workspaceId: string): void;
  setSearchQuery(query: string): void;
};

type PersistedWindowPreferences = { expandedWorkspaceIds: string[] };
type PreferenceUpdate = Partial<WindowPreferences> | ((state: WindowPreferences) => Partial<WindowPreferences>);

export function createWindowPreferences(set: (update: PreferenceUpdate) => void): WindowPreferences {
  return {
    expandedWorkspaceIds: new Set(),
    searchQuery: "",
    toggleWorkspaceExpanded(workspaceId) {
      set((state) => {
        const expandedWorkspaceIds = new Set(state.expandedWorkspaceIds);
        if (expandedWorkspaceIds.has(workspaceId)) {
          expandedWorkspaceIds.delete(workspaceId);
        } else {
          expandedWorkspaceIds.add(workspaceId);
        }
        return { expandedWorkspaceIds };
      });
    },
    setSearchQuery(query) {
      set({ searchQuery: query });
    },
  };
}

export function windowPreferencePersistence<T extends WindowPreferences>(): PersistOptions<T, PersistedWindowPreferences> {
  return {
    name: EXPANDED_WORKSPACE_IDS_STORAGE_KEY,
    storage: createExpandedWorkspaceIdsStorage(),
    partialize: (state) => ({ expandedWorkspaceIds: Array.from(state.expandedWorkspaceIds) }),
    merge: (persistedState, currentState) => {
      const persisted = persistedState as Partial<PersistedWindowPreferences> | undefined;
      return {
        ...currentState,
        expandedWorkspaceIds: new Set(
          persisted?.expandedWorkspaceIds?.filter((value): value is string => typeof value === "string") ?? [],
        ),
      };
    },
  };
}

function getLocalStorage(): Storage | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function createExpandedWorkspaceIdsStorage(): PersistStorage<PersistedWindowPreferences> {
  return {
    getItem(name) {
      const storage = getLocalStorage();
      if (!storage) return null;
      try {
        const rawValue = storage.getItem(name);
        if (!rawValue) return null;
        const parsed = JSON.parse(rawValue) as unknown;
        if (Array.isArray(parsed)) {
          return { state: { expandedWorkspaceIds: parsed.filter((value): value is string => typeof value === "string") } };
        }
        return isStorageValue(parsed) ? parsed : null;
      } catch {
        return null;
      }
    },
    setItem(name, value) {
      const storage = getLocalStorage();
      if (!storage) return;
      try {
        storage.setItem(name, JSON.stringify(value));
      } catch {
        // Persistence is best-effort; losing it must not block the UI toggle.
      }
    },
    removeItem(name) {
      getLocalStorage()?.removeItem(name);
    },
  };
}

function isStorageValue(value: unknown): value is StorageValue<PersistedWindowPreferences> {
  if (typeof value !== "object" || value === null || !("state" in value)) return false;
  const state = (value as { state?: unknown }).state;
  return typeof state === "object" && state !== null && "expandedWorkspaceIds" in state;
}
