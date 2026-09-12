import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { InputItem, RuntimeOp } from "../../src/protocol/threadProtocol.ts";
import { createThreadWindowStore } from "../../src/store/threadWindowStore.ts";

const timestamp = "2026-06-06T00:00:00.000Z";

describe("threadWindowStore", () => {
  beforeEach(() => {
    createThreadWindowStore.setState(createThreadWindowStore.getInitialState(), true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates thread state from a started notification and keeps pending initial prompt without active UI state", () => {
    const store = createThreadWindowStore;
    store.getState().enqueueInitialPrompt({
      clientRequestId: "prompt-1",
      userInput: { items: [{ type: "text", id: "text-1", text: "hello" }] },
    });

    store.getState().handleNotification({
      type: "thread.started",
      threadId: "thread-1",
      notificationId: "n1",
      commandId: "prompt-1",
      timestamp,
      payload: { preview: "hello" },
    });

    expect(store.getState().threadsById["thread-1"].pendingInitialPrompt?.userInput.items[0].type).toBe("text");
    expect("activeTabId" in store.getState()).toBe(false);
    expect("tabs" in store.getState()).toBe(false);
  });

  it("ensures cached thread state without selecting a visible thread", () => {
    const store = createThreadWindowStore;

    store.getState().ensureThreadState("thread-1");

    expect(store.getState().threadsById["thread-1"]).toMatchObject({
      threadId: "thread-1",
      title: null,
      status: "idle",
      messages: [],
    });
    expect("activeTabId" in store.getState()).toBe(false);
  });

  it("merges snapshot without dropping pending initial user message", () => {
    const store = createThreadWindowStore;
    store.getState().enqueueInitialPrompt({
      clientRequestId: "prompt-1",
      userInput: { items: [{ type: "text", id: "text-1", text: "hello" }] },
    });
    store.getState().handleNotification({
      type: "thread.started",
      threadId: "thread-1",
      notificationId: "n1",
      commandId: "prompt-1",
      timestamp,
      payload: { preview: "hello" },
    });
    store.getState().handleNotification({
      type: "thread.snapshot",
      threadId: "thread-1",
      notificationId: "n2",
      commandId: "resume-1",
      timestamp,
      payload: { messages: [], status: "running" },
    });

    expect(store.getState().threadsById["thread-1"].messages).toEqual([
      { type: "user_message", id: "pending-prompt-1", text: "hello", inputItems: [], pending: true },
    ]);
  });

  it("keeps structured user input items from snapshot and live recorded notifications", () => {
    const store = createThreadWindowStore;
    const inputItems: InputItem[] = [
      { type: "skill", id: "skill-1", actionId: "review/code", title: "Review", prompt: "Review this code" },
      { type: "text", id: "text-1", text: "focus on regressions" },
      { type: "image", id: "image-1", mimeType: "image/webp", base64: "aW1hZ2U=" },
      { type: "text_selection", id: "selection-1", text: "selected code" },
    ];
    const liveInputItems = inputItems.map((item) => ({ ...item, id: `live-${item.id}` }));
    store.getState().ensureThreadState("thread-1");

    store.getState().handleNotification({
      type: "thread.snapshot",
      threadId: "thread-1",
      notificationId: "snapshot-1",
      timestamp,
      payload: {
        status: "idle",
        messages: [{
          id: "msg-1",
          role: "user",
          text: "focus on regressions",
          inputItems,
          status: "completed",
          createdAt: timestamp,
          updatedAt: timestamp,
        }],
      },
    });

    expect(store.getState().threadsById["thread-1"].messages).toEqual([{
      type: "user_message",
      id: "msg-1",
      text: "focus on regressions",
      inputItems,
    }]);

    store.getState().handleNotification({
      type: "user.message.recorded",
      threadId: "thread-1",
      notificationId: "recorded-1",
      timestamp,
      payload: {
        messageId: "msg-2",
        text: "selected code",
        items: liveInputItems,
      },
    });

    expect(store.getState().threadsById["thread-1"].messages).toEqual([
      { type: "user_message", id: "msg-1", text: "focus on regressions", inputItems },
      { type: "user_message", id: "msg-2", text: "selected code", inputItems: liveInputItems },
    ]);
  });

  it("inserts and updates live threads in history without waiting for a relisted snapshot", () => {
    const store = createThreadWindowStore;

    store.getState().handleNotification({
      type: "thread.started",
      threadId: "thread-1",
      notificationId: "started-1",
      commandId: "start-1",
      timestamp,
      payload: { preview: null },
    });
    store.getState().handleNotification({
      type: "user.message.recorded",
      threadId: "thread-1",
      notificationId: "recorded-1",
      timestamp: "2026-06-06T00:00:01.000Z",
      payload: {
        messageId: "msg-1",
        text: "[mock:assistant-ok] live history",
        items: [{ type: "text", id: "text-1", text: "[mock:assistant-ok] live history" }],
      },
    });

    expect(store.getState().history[0]).toMatchObject({
      id: "thread-1",
      preview: "[mock:assistant-ok] live history",
      workspaceId: null,
      messageCount: 1,
      updatedAt: "2026-06-06T00:00:01.000Z",
    });

    store.getState().handleNotification({
      type: "turn.completed",
      threadId: "thread-1",
      notificationId: "completed-1",
      turnId: "turn-1",
      timestamp: "2026-06-06T00:00:02.000Z",
      payload: { status: "completed" },
    });

    expect(store.getState().history).toHaveLength(1);
    expect(store.getState().history[0]).toMatchObject({
      id: "thread-1",
      preview: "[mock:assistant-ok] live history",
      messageCount: 1,
      updatedAt: "2026-06-06T00:00:02.000Z",
    });
  });

  it("appends interleaved assistant deltas to the same message identity within each thread", () => {
    const store = createThreadWindowStore;
    store.getState().ensureThreadState("thread-1");
    store.getState().handleNotification({
      type: "assistant.delta",
      threadId: "thread-1",
      notificationId: "n3",
      turnId: "turn-1",
      itemId: "assistant-1",
      timestamp,
      payload: { text: "hel" },
    });
    store.getState().handleNotification({
      type: "assistant.delta",
      threadId: "thread-2",
      notificationId: "other-delta",
      turnId: "turn-other",
      itemId: "assistant-1",
      timestamp,
      payload: { text: "another conversation" },
    });
    store.getState().handleNotification({
      type: "assistant.delta",
      threadId: "thread-1",
      notificationId: "n4",
      turnId: "turn-1",
      itemId: "assistant-1",
      timestamp,
      payload: { text: "lo" },
    });

    expect(store.getState().threadsById["thread-1"].messages).toEqual([
      { type: "assistant_message", id: "assistant-1", text: "hello" },
    ]);
    expect(store.getState().threadsById["thread-2"].messages).toEqual([
      { type: "assistant_message", id: "assistant-1", text: "another conversation" },
    ]);
  });

  it("restores tool statuses from history and updates streamed tool results in place", () => {
    const store = createThreadWindowStore;
    const statuses = ["running", "completed", "failed"] as const;
    store.getState().handleNotification({
      type: "thread.snapshot",
      threadId: "thread-1",
      notificationId: "snapshot-tools",
      timestamp,
      payload: {
        status: "running",
        messages: statuses.map((status) => ({
          id: `saved-${status}`,
          role: "tool",
          text: `saved ${status} output`,
          status,
          toolCall: { name: "file.read" },
          createdAt: timestamp,
          updatedAt: timestamp,
        })),
      },
    });
    expect(store.getState().threadsById["thread-1"].messages).toEqual(statuses.map((status) => ({
      type: "tool_call",
      id: `saved-${status}`,
      toolName: "file.read",
      input: null,
      output: `saved ${status} output`,
      status,
    })));

    for (const status of ["completed", "failed"] as const) {
      store.getState().handleNotification({
        type: "tool.started",
        threadId: "thread-1",
        notificationId: `tool-started-${status}`,
        turnId: "turn-1",
        itemId: `live-${status}`,
        timestamp,
        payload: { name: "file.write", input: { path: `${status}.txt` } },
      });
      expect(store.getState().threadsById["thread-1"].messages.at(-1)).toEqual({
        type: "tool_call",
        id: `live-${status}`,
        toolName: "file.write",
        input: JSON.stringify({ path: `${status}.txt` }),
        output: null,
        status: "running",
      });

      store.getState().handleNotification({
        type: "tool.finished",
        threadId: "thread-1",
        notificationId: `tool-finished-${status}`,
        turnId: "turn-1",
        itemId: `live-${status}`,
        timestamp,
        payload: { name: "file.write", output: `${status} output`, status, durationMs: 5 },
      });
      expect(store.getState().threadsById["thread-1"].messages.filter((item) => item.id === `live-${status}`)).toEqual([{
        type: "tool_call",
        id: `live-${status}`,
        toolName: "file.write",
        input: JSON.stringify({ path: `${status}.txt` }),
        output: `${status} output`,
        status,
      }]);
    }
  });

  it("queues composer input while the thread is running without appending a user message", () => {
    const store = createThreadWindowStore;
    store.getState().ensureThreadState("thread-1");
    store.getState().handleNotification({
      type: "turn.started",
      threadId: "thread-1",
      notificationId: "n-running",
      turnId: "turn-1",
      timestamp,
      payload: {},
    });

    store.getState().queueComposerInput("thread-1", {
      type: "user_input",
      opId: "op-1",
      timestamp,
      payload: { items: [{ type: "text", id: "text-2", text: "second" }] },
    });

    const thread = store.getState().threadsById["thread-1"];
    expect(thread.messages).toEqual([]);
    expect(thread.queuedComposerInputs).toEqual([expect.objectContaining({ op: expect.objectContaining({ type: "user_input" }) })]);
    expect(store.getState().takeNextQueuedInputForDispatch("thread-1")).toBeNull();
  });

  it("dispatches queued composer input one item at a time after the thread leaves running", () => {
    const store = createThreadWindowStore;
    store.getState().ensureThreadState("thread-1");
    store.getState().handleNotification({
      type: "turn.started",
      threadId: "thread-1",
      notificationId: "n-running",
      turnId: "turn-1",
      timestamp,
      payload: {},
    });
    store.getState().queueComposerInput("thread-1", {
      type: "user_input",
      opId: "op-1",
      timestamp,
      payload: { items: [{ type: "text", id: "text-2", text: "second" }] },
    });
    store.getState().queueComposerInput("thread-1", {
      type: "user_input",
      opId: "op-2",
      timestamp,
      payload: { items: [{ type: "text", id: "text-3", text: "third" }] },
    });
    store.getState().handleNotification({
      type: "turn.completed",
      threadId: "thread-1",
      notificationId: "n-completed-1",
      turnId: "turn-1",
      timestamp,
      payload: { status: "completed" },
    });

    const firstDispatch = store.getState().takeNextQueuedInputForDispatch("thread-1");
    expect(firstDispatch?.op.type).toBe("user_input");
    expect(store.getState().takeNextQueuedInputForDispatch("thread-1")).toBeNull();

    store.getState().handleNotification({
      type: "turn.started",
      threadId: "thread-1",
      notificationId: "n-running-2",
      turnId: "turn-2",
      timestamp,
      payload: {},
    });
    store.getState().handleNotification({
      type: "turn.completed",
      threadId: "thread-1",
      notificationId: "n-completed-2",
      turnId: "turn-2",
      timestamp,
      payload: { status: "completed" },
    });

    const pendingDispatch = store.getState().takeNextQueuedInputForDispatch("thread-1");
    expect(pendingDispatch?.op.type).toBe("user_input");
    expect(store.getState().threadsById["thread-1"].queuedComposerInputs).toEqual([]);
  });

  it("removes a queued composer input by index", () => {
    const store = createThreadWindowStore;
    store.getState().ensureThreadState("thread-1");
    store.getState().queueComposerInput("thread-1", {
      type: "user_input",
      opId: "op-1",
      timestamp,
      payload: { items: [{ type: "text", id: "text-1", text: "first" }] },
    });
    store.getState().queueComposerInput("thread-1", {
      type: "user_input",
      opId: "op-2",
      timestamp,
      payload: { items: [{ type: "text", id: "text-2", text: "second" }] },
    });

    store.getState().removeQueuedComposerInput("thread-1", 0);

    expect(store.getState().threadsById["thread-1"].queuedComposerInputs).toHaveLength(1);
  });

  it("holds queued composer input while a submitted input is waiting for turn start", () => {
    const store = createThreadWindowStore;
    store.getState().ensureThreadState("thread-1");

    store.getState().markComposerInputDispatchPending("thread-1");
    store.getState().queueComposerInput("thread-1", {
      type: "user_input",
      opId: "op-2",
      timestamp,
      payload: { items: [{ type: "text", id: "text-2", text: "second" }] },
    });

    expect(store.getState().takeNextQueuedInputForDispatch("thread-1")).toBeNull();

    store.getState().handleNotification({
      type: "turn.started",
      threadId: "thread-1",
      notificationId: "n-running",
      turnId: "turn-1",
      timestamp,
      payload: {},
    });
    store.getState().handleNotification({
      type: "turn.completed",
      threadId: "thread-1",
      notificationId: "n-completed",
      turnId: "turn-1",
      timestamp,
      payload: { status: "completed" },
    });

    expect(store.getState().takeNextQueuedInputForDispatch("thread-1")?.op.type).toBe("user_input");
  });

  it("keeps interleaved composer queues isolated through pending dispatch, deletion, and successive turns", () => {
    const store = createThreadWindowStore;
    const inputOp = (opId: string): RuntimeOp => ({
      type: "user_input",
      opId,
      timestamp,
      payload: {
        items: [
          { type: "text", id: `${opId}-text`, text: opId },
          { type: "image", id: `${opId}-image`, mimeType: "image/png", base64: "aW1hZ2U=" },
        ],
      },
    });
    const startTurn = (threadId: string, turnId: string) => store.getState().handleNotification({
      type: "turn.started",
      threadId,
      notificationId: `${turnId}-started`,
      turnId,
      timestamp,
      payload: {},
    });
    const completeTurn = (threadId: string, turnId: string) => store.getState().handleNotification({
      type: "turn.completed",
      threadId,
      notificationId: `${turnId}-completed`,
      turnId,
      timestamp,
      payload: { status: "completed" },
    });
    const queuedIds = (threadId: string) => store.getState().threadsById[threadId].queuedComposerInputs.map(({ op }) => op.opId);

    store.getState().ensureThreadState("thread-a");
    store.getState().markComposerInputDispatchPending("thread-a");
    store.getState().queueComposerInput("thread-a", inputOp("a-next"));
    store.getState().queueComposerInput("thread-a", inputOp("a-cancelled"));
    store.getState().queueComposerInput("thread-a", inputOp("a-last"));
    startTurn("thread-b", "b-turn-1");
    store.getState().queueComposerInput("thread-b", inputOp("b-next"));
    store.getState().queueComposerInput("thread-b", inputOp("b-last"));
    store.getState().removeQueuedComposerInput("thread-a", 1);

    expect(queuedIds("thread-a")).toEqual(["a-next", "a-last"]);
    expect(queuedIds("thread-b")).toEqual(["b-next", "b-last"]);
    expect(store.getState().threadsById["thread-a"].status).toBe("idle");
    expect(store.getState().takeNextQueuedInputForDispatch("thread-a")).toBeNull();
    expect(store.getState().takeNextQueuedInputForDispatch("thread-b")).toBeNull();

    completeTurn("thread-b", "b-turn-1");
    expect(store.getState().takeNextQueuedInputForDispatch("thread-b")?.op.opId).toBe("b-next");
    expect(store.getState().takeNextQueuedInputForDispatch("thread-b")).toBeNull();
    expect(store.getState().takeNextQueuedInputForDispatch("thread-a")).toBeNull();

    startTurn("thread-a", "a-turn-1");
    startTurn("thread-b", "b-turn-2");
    expect(store.getState().takeNextQueuedInputForDispatch("thread-a")).toBeNull();
    expect(store.getState().takeNextQueuedInputForDispatch("thread-b")).toBeNull();
    completeTurn("thread-a", "a-turn-1");
    const queuedBeforeDispatch = store.getState().threadsById["thread-a"].queuedComposerInputs;
    const expectedQueued = structuredClone(queuedBeforeDispatch);
    const threadBBeforeDispatch = store.getState().threadsById["thread-b"];
    const dispatched = store.getState().takeNextQueuedInputForDispatch("thread-a");
    expect(dispatched?.op.opId).toBe("a-next");
    if (dispatched?.op.type !== "user_input") throw new Error("Expected a queued user input");

    dispatched.op.opId = "changed-by-sender";
    dispatched.op.payload.items[0].id = "changed-text-id";
    dispatched.op.payload.items.push({ type: "text", id: "sender-only", text: "sender copy" });

    expect(queuedBeforeDispatch).toEqual(expectedQueued);
    expect(queuedIds("thread-a")).toEqual(["a-last"]);
    expect(store.getState().threadsById["thread-b"]).toEqual(threadBBeforeDispatch);
    expect(store.getState().takeNextQueuedInputForDispatch("thread-a")).toBeNull();

    completeTurn("thread-b", "b-turn-2");
    expect(store.getState().takeNextQueuedInputForDispatch("thread-b")?.op.opId).toBe("b-last");
    expect(store.getState().takeNextQueuedInputForDispatch("thread-a")).toBeNull();
    startTurn("thread-a", "a-turn-2");
    expect(store.getState().takeNextQueuedInputForDispatch("thread-a")).toBeNull();
    completeTurn("thread-a", "a-turn-2");
    expect(store.getState().takeNextQueuedInputForDispatch("thread-a")?.op.opId).toBe("a-last");
    expect(queuedIds("thread-a")).toEqual([]);
    expect(queuedIds("thread-b")).toEqual([]);
    expect(store.getState().threadsById["thread-a"].messages).toEqual([]);
    expect(store.getState().threadsById["thread-b"].messages).toEqual([]);
  });

  it("does not append duplicate assistant delta notifications", () => {
    const store = createThreadWindowStore;
    store.getState().ensureThreadState("thread-1");

    const notification = {
      type: "assistant.delta" as const,
      threadId: "thread-1",
      notificationId: "n3",
      turnId: "turn-1",
      itemId: "assistant-1",
      timestamp,
      payload: { text: "hel" },
    };

    store.getState().handleNotification(notification);
    store.getState().handleNotification(notification);

    expect((store.getState().threadsById["thread-1"].messages[0] as any).text).toBe("hel");
  });

  it("only removes history and thread state when delete status is deleted", () => {
    const store = createThreadWindowStore;
    store.setState({
      history: [{
        id: "thread-1",
        preview: "hello",
        createdAt: timestamp,
        updatedAt: timestamp,
        messageCount: 1,
      }],
    });
    store.getState().ensureThreadState("thread-1");

    store.getState().handleNotification({
      type: "thread.deleted",
      notificationId: "n-delete-1",
      commandId: "delete-1",
      timestamp,
      payload: { targetThreadId: "thread-1", status: "not_found" },
    });

    expect(store.getState().history.map((item) => item.id)).toEqual(["thread-1"]);
    expect(store.getState().threadsById["thread-1"]).toBeDefined();

    store.getState().handleNotification({
      type: "thread.deleted",
      notificationId: "n-delete-2",
      commandId: "delete-2",
      timestamp,
      payload: { targetThreadId: "thread-1", status: "deleted" },
    });

    expect(store.getState().history).toEqual([]);
    expect(store.getState().threadsById["thread-1"]).toBeUndefined();
  });

  it("stores workspaces from workspace.listed notifications", () => {
    const store = createThreadWindowStore;

    store.getState().handleNotification({
      type: "workspace.listed",
      notificationId: "n-workspaces",
      commandId: "workspace-list-1",
      timestamp,
      payload: {
        workspaces: [
          { id: "tmp", name: "tmp", rootPath: "/tmp" },
          { id: "handagent-test", name: "handagent-test", rootPath: "/handagent" },
        ],
      },
    });

    expect(store.getState().workspaces.map((workspace) => workspace.name)).toEqual([
      "tmp",
      "handagent-test",
    ]);
  });

  it("toggles workspace expansion ids", () => {
    const store = createThreadWindowStore;

    expect(store.getState().expandedWorkspaceIds.has("default")).toBe(false);

    store.getState().toggleWorkspaceExpanded("default");
    expect(store.getState().expandedWorkspaceIds.has("default")).toBe(true);

    store.getState().toggleWorkspaceExpanded("default");
    expect(store.getState().expandedWorkspaceIds.has("default")).toBe(false);
  });

  it("persists workspace expansion ids when they change", () => {
    const setItem = vi.fn();
    vi.stubGlobal("window", { localStorage: { setItem } });

    const store = createThreadWindowStore;
    store.getState().toggleWorkspaceExpanded("default");

    expect(setItem).toHaveBeenCalledWith(
      "handAgent.threadWindow.expandedWorkspaceIds",
      JSON.stringify({
        state: { expandedWorkspaceIds: ["default"] },
        version: 0,
      }),
    );

    vi.unstubAllGlobals();
  });

  it("clears pending initial prompt and exposes window error when thread error has only commandId", () => {
    const store = createThreadWindowStore;
    store.getState().enqueueInitialPrompt({
      clientRequestId: "prompt-1",
      userInput: {
        items: [{ type: "text", id: "text-1", text: "hello" }],
      },
    });

    store.getState().handleNotification({
      type: "thread.error",
      notificationId: "n-error-1",
      commandId: "prompt-1",
      timestamp,
      payload: { message: "failed before thread creation" },
    });

    expect(store.getState().pendingInitialPrompts["prompt-1"]).toBeUndefined();
    expect(store.getState().windowErrorMessage).toBe("failed before thread creation");
  });

  it("stores permission and workspace requests by thread", () => {
    const store = createThreadWindowStore;
    store.getState().ensureThreadState("thread-1");
    store.getState().handleRequest({
      type: "permission.requested",
      requestId: "thread-1:req-1",
      threadId: "thread-1",
      timestamp,
      payload: { toolName: "file.write", toolCallId: "tool-1", arguments: { path: "a.txt" } },
    });
    store.getState().handleRequest({
      type: "workspace.requested",
      requestId: "thread-1:req-2",
      threadId: "thread-1",
      timestamp,
      payload: { prompt: "Pick", candidates: [] },
    });

    expect(store.getState().threadsById["thread-1"].permissionRequests).toHaveLength(1);
    expect(store.getState().threadsById["thread-1"].workspaceRequests).toHaveLength(1);
  });

  it.each([
    ["completed", "idle"],
    ["interrupted", "interrupted"],
    ["failed", "failed"],
  ] as const)("projects a %s turn as %s and clears only that thread's requests", (turnStatus, visibleStatus) => {
    const store = createThreadWindowStore;
    store.getState().enqueueInitialPrompt({
      clientRequestId: "prompt-1",
      userInput: { items: [{ type: "text", id: "text-1", text: "hello" }] },
    });
    store.getState().handleNotification({
      type: "thread.started",
      threadId: "thread-1",
      notificationId: "thread-started",
      commandId: "prompt-1",
      timestamp,
      payload: { preview: "hello" },
    });
    for (const threadId of ["thread-1", "thread-2"]) {
      store.getState().handleNotification({
        type: "turn.started",
        threadId,
        notificationId: `${threadId}-turn-started`,
        turnId: `${threadId}-turn`,
        timestamp,
        payload: {},
      });
      store.getState().handleRequest({
        type: "permission.requested",
        requestId: `${threadId}:permission`,
        threadId,
        timestamp,
        payload: { toolName: "workspace.askUser", toolCallId: "tool-1", arguments: { prompt: "Pick workspace" } },
      });
      store.getState().handleRequest({
        type: "workspace.requested",
        requestId: `${threadId}:workspace`,
        threadId,
        timestamp,
        payload: { prompt: "Pick", candidates: [] },
      });
    }
    const otherThread = store.getState().threadsById["thread-2"];

    store.getState().handleNotification({
      type: "turn.completed",
      threadId: "thread-1",
      notificationId: "n-completed",
      turnId: "thread-1-turn",
      timestamp,
      payload: { status: turnStatus },
    });

    expect(store.getState().threadsById["thread-1"]).toMatchObject({
      status: visibleStatus,
      pendingInitialPrompt: null,
      permissionRequests: [],
      workspaceRequests: [],
    });
    expect(store.getState().threadsById["thread-2"]).toEqual(otherThread);
  });

  it.each(["idle", "interrupted", "failed"] as const)("clears pending requests when thread status changes to %s", (status) => {
    const store = createThreadWindowStore;
    store.getState().ensureThreadState("thread-1");
    store.getState().handleRequest({
      type: "permission.requested",
      requestId: "thread-1:req-1",
      threadId: "thread-1",
      timestamp,
      payload: { toolName: "workspace.askUser", toolCallId: "tool-1", arguments: { prompt: "Pick workspace" } },
    });
    store.getState().handleRequest({
      type: "workspace.requested",
      requestId: "thread-1:req-2",
      threadId: "thread-1",
      timestamp,
      payload: { prompt: "Pick", candidates: [] },
    });

    store.getState().handleNotification({
      type: "thread.status.changed",
      threadId: "thread-1",
      notificationId: "n-status",
      timestamp,
      payload: { value: status },
    });

    expect(store.getState().threadsById["thread-1"]).toMatchObject({
      status,
      permissionRequests: [],
      workspaceRequests: [],
    });
  });

  it("removes answered requests through explicit store actions", () => {
    const store = createThreadWindowStore;
    store.getState().ensureThreadState("thread-1");
    store.getState().handleRequest({
      type: "permission.requested",
      requestId: "thread-1:req-1",
      threadId: "thread-1",
      timestamp,
      payload: { toolName: "file.write", toolCallId: "tool-1", arguments: { path: "a.txt" } },
    });
    store.getState().handleRequest({
      type: "workspace.requested",
      requestId: "thread-1:req-2",
      threadId: "thread-1",
      timestamp,
      payload: { prompt: "Pick", candidates: [] },
    });

    store.getState().resolvePermissionRequest("thread-1:req-1");
    store.getState().resolveWorkspaceRequest("thread-1:req-2");

    expect(store.getState().threadsById["thread-1"].permissionRequests).toEqual([]);
    expect(store.getState().threadsById["thread-1"].workspaceRequests).toEqual([]);
  });
});
