import type { PersistOptions, PersistStorage, StorageValue } from "zustand/middleware";

const EXPANDED_WORKSPACE_IDS_STORAGE_KEY = "handAgent.threadWindow.expandedPetIds";

export type WindowPreferences = {
  expandedPetIds: Set<string>;
  searchQuery: string;
  togglePetExpanded(petId: string): void;
  setSearchQuery(query: string): void;
};

type PersistedWindowPreferences = { expandedPetIds: string[] };
type PreferenceUpdate = Partial<WindowPreferences> | ((state: WindowPreferences) => Partial<WindowPreferences>);

export function createWindowPreferences(set: (update: PreferenceUpdate) => void): WindowPreferences {
  return {
    expandedPetIds: new Set(),
    searchQuery: "",
    togglePetExpanded(petId) {
      set((state) => {
        const expandedPetIds = new Set(state.expandedPetIds);
        if (expandedPetIds.has(petId)) {
          expandedPetIds.delete(petId);
        } else {
          expandedPetIds.add(petId);
        }
        return { expandedPetIds };
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
    storage: createExpandedPetIdsStorage(),
    partialize: (state) => ({ expandedPetIds: Array.from(state.expandedPetIds) }),
    merge: (persistedState, currentState) => {
      const persisted = persistedState as Partial<PersistedWindowPreferences> | undefined;
      return {
        ...currentState,
        expandedPetIds: new Set(
          persisted?.expandedPetIds?.filter((value): value is string => typeof value === "string") ?? [],
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

function createExpandedPetIdsStorage(): PersistStorage<PersistedWindowPreferences> {
  return {
    getItem(name) {
      const storage = getLocalStorage();
      if (!storage) return null;
      try {
        const rawValue = storage.getItem(name);
        if (!rawValue) return null;
        const parsed = JSON.parse(rawValue) as unknown;
        if (Array.isArray(parsed)) {
          return { state: { expandedPetIds: parsed.filter((value): value is string => typeof value === "string") } };
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
  return typeof state === "object" && state !== null && "expandedPetIds" in state;
}
