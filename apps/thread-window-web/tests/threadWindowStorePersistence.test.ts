import { afterEach, describe, expect, it, vi } from "vitest";

describe("threadWindowStore workspace expansion persistence", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("loads persisted workspace expansion ids when the store initializes", async () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: vi.fn(() => JSON.stringify(["default", "qa-workspace"])),
        setItem: vi.fn(),
      },
    });

    const { createThreadWindowStore } = await import("../src/store/threadWindowStore.ts");

    expect(Array.from(createThreadWindowStore.getState().expandedWorkspaceIds)).toEqual([
      "default",
      "qa-workspace",
    ]);
  });

  it("round-trips workspace expansion while rebuilding transient thread and input state", async () => {
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
    store.getState().toggleWorkspaceExpanded("default");
    store.getState().toggleWorkspaceExpanded("qa-workspace");
    store.getState().toggleWorkspaceExpanded("default");
    store.getState().setSearchQuery("unfinished search");
    store.getState().setConnectionState("connected");
    store.getState().setWorkspaces([{ id: "qa-workspace", name: "QA", rootPath: "/qa" }]);
    store.getState().enqueueInitialPrompt({
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

    expect(Array.from(storedValues.keys())).toEqual(["handAgent.threadWindow.expandedWorkspaceIds"]);
    expect(JSON.parse(storedValues.get("handAgent.threadWindow.expandedWorkspaceIds")!)).toEqual({
      state: { expandedWorkspaceIds: ["qa-workspace"] },
      version: 0,
    });

    vi.resetModules();
    const { createThreadWindowStore: reopenedStore } = await import("../src/store/threadWindowStore.ts");

    expect(Array.from(reopenedStore.getState().expandedWorkspaceIds)).toEqual(["qa-workspace"]);
    expect(reopenedStore.getState()).toMatchObject({
      connectionState: "disconnected",
      searchQuery: "",
      threadsById: {},
      pendingInitialPrompts: {},
      history: [],
      workspaces: [],
    });
  });
});
