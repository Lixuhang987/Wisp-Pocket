import { afterEach, describe, expect, it, vi } from "vitest";

describe("threadWindowStore pet expansion persistence", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("loads persisted pet expansion ids when the store initializes", async () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: vi.fn(() => JSON.stringify(["default", "qa-pet"])),
        setItem: vi.fn(),
      },
    });

    const { createThreadWindowStore } = await import("../src/store/threadWindowStore.ts");

    expect(Array.from(createThreadWindowStore.getState().expandedPetIds)).toEqual([
      "default",
      "qa-pet",
    ]);
  });

  it("round-trips pet expansion while rebuilding transient thread and input state", async () => {
    const storedValues = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => storedValues.get(key) ?? null,
        setItem: (key: string, value: string) => storedValues.set(key, value),
        removeItem: (key: string) => storedValues.delete(key),
      },
    });
    const timestamp = "2026-06-06T00:00:00.000Z";
    const { createThreadWindowStore: store } = await import("../src/store/threadWindowStore.ts");
    store.getState().togglePetExpanded("default");
    store.getState().togglePetExpanded("qa-pet");
    store.getState().togglePetExpanded("default");
    store.getState().setSearchQuery("unfinished search");
    store.getState().setConnectionState("connected");
    store.getState().setPets([{description:"", rolePrompt:"Help", revision:1, imageRef:{type:"builtin",id:"yachiyo"}, isDefault:false, createdAt:"2026", updatedAt:"2026",  id: "qa-pet", name: "QA", rootPath: "/qa" }]);
    store.getState().enqueueInitialPrompt({petId: "pet-default",
      clientRequestId: "uncreated-prompt",
      userInput: { items: [{ type: "text", id: "initial-text", text: "pending initial input" }] },
    });
    store.getState().handleNotification({
      type: "user.message.recorded",
      threadId: "thread-1",
      notificationId: "recorded-1",
      timestamp,
      payload: {
        messageId: "message-1",
        text: "existing message",
        items: [{ type: "text", id: "recorded-text", text: "existing message" }],
        pending: true,
      },
    });
    store.getState().handleRequest({
      type: "permission.requested",
      requestId: "thread-1:permission",
      threadId: "thread-1",
      timestamp,
      payload: { toolName: "file.write", toolCallId: "tool-1", arguments: { path: "a.txt" } },
    });

    expect(Array.from(storedValues.keys())).toEqual(["handAgent.threadWindow.expandedPetIds"]);
    expect(JSON.parse(storedValues.get("handAgent.threadWindow.expandedPetIds")!)).toEqual({
      state: { expandedPetIds: ["qa-pet"] },
      version: 0,
    });

    vi.resetModules();
    const { createThreadWindowStore: reopenedStore } = await import("../src/store/threadWindowStore.ts");

    expect(Array.from(reopenedStore.getState().expandedPetIds)).toEqual(["qa-pet"]);
    expect(reopenedStore.getState()).toMatchObject({
      connectionState: "disconnected",
      searchQuery: "",
      threadsById: {},
      pendingInitialPrompts: {},
      history: [],
      pets: [],
    });
  });
});
