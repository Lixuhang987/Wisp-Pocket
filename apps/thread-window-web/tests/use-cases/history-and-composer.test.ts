import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
          inputItems: [
            { type: "skill", id: "skill-1", actionId: "review/code", title: "Review", prompt: "Review this code" },
            { type: "text", id: "text-1", text: "focus on regressions" },
          ],
          status: "completed",
          createdAt: timestamp,
          updatedAt: timestamp,
        }],
      },
    });

    expect((store.getState().threadsById["thread-1"].messages[0] as any).inputItems).toEqual([
      { type: "skill", id: "skill-1", actionId: "review/code", title: "Review", prompt: "Review this code" },
      { type: "text", id: "text-1", text: "focus on regressions" },
    ]);

    store.getState().handleNotification({
      type: "user.message.recorded",
      threadId: "thread-1",
      notificationId: "recorded-1",
      timestamp,
      payload: {
        messageId: "msg-2",
        text: "selected code",
        items: [
          { type: "text_selection", id: "selection-1", text: "selected code" },
        ],
      },
    });

    expect((store.getState().threadsById["thread-1"].messages.at(-1) as any)?.inputItems).toEqual([
      { type: "text_selection", id: "selection-1", text: "selected code" },
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

  it("appends assistant delta and tool events", () => {
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
      threadId: "thread-1",
      notificationId: "n4",
      turnId: "turn-1",
      itemId: "assistant-1",
      timestamp,
      payload: { text: "lo" },
    });

    expect((store.getState().threadsById["thread-1"].messages[0] as any).text).toBe("hello");
  });

  it("keeps every received input pending until its own turn starts", () => {
    const store = createThreadWindowStore;
    store.getState().ensureThreadState("thread-1");
    store.getState().handleNotification({ type: "turn.started", threadId: "thread-1", notificationId: "running", turnId: "first", timestamp, payload: {} });
    for (const id of ["second", "third"]) {
      store.getState().handleNotification({
        type: "user.message.recorded", threadId: "thread-1", notificationId: id, timestamp,
        payload: { messageId: id, text: id, pending: true, items: [{ type: "text", id, text: id }] },
      });
    }
    expect(store.getState().threadsById["thread-1"].messages).toMatchObject([
      { id: "second", pending: true }, { id: "third", pending: true },
    ]);
    store.getState().handleNotification({ type: "turn.completed", threadId: "thread-1", notificationId: "done", turnId: "first", timestamp, payload: { status: "completed" } });
    store.getState().handleNotification({ type: "turn.started", threadId: "thread-1", notificationId: "start-second", turnId: "second", timestamp, payload: {} });
    expect(store.getState().threadsById["thread-1"].messages).toMatchObject([
      { id: "second", pending: false }, { id: "third", pending: true },
    ]);
  });

  it("restores pending inputs and unexpired questions from authoritative snapshots", () => {
    const store = createThreadWindowStore;
    store.getState().handleNotification({
      type: "thread.snapshot", threadId: "thread-1", notificationId: "restored", timestamp,
      payload: { status: "idle", messages: [
        { id: "question", role: "assistant", text: "怎么处理？", suggestedReplies: ["整理摘要"], awaitingReply: true, status: "completed", createdAt: timestamp, updatedAt: timestamp },
        { id: "queued", role: "user", text: "补充", pending: true, status: "completed", createdAt: timestamp, updatedAt: timestamp },
      ] },
    });
    expect(store.getState().threadsById["thread-1"].messages).toMatchObject([
      { id: "question", suggestedReplies: ["整理摘要"], awaitingReply: true }, { id: "queued", pending: true },
    ]);
  });

  it("uses server resolution to clear the same request in every view", () => {
    const store = createThreadWindowStore;
    store.getState().handleRequest({ type: "permission.requested", threadId: "thread-1", requestId: "req", timestamp,
      payload: { toolName: "file.write", toolCallId: "tool", arguments: {} } });
    store.getState().handleNotification({ type: "request.resolved", threadId: "thread-1", notificationId: "resolved", timestamp, payload: { requestId: "req" } });
    expect(store.getState().threadsById["thread-1"].permissionRequests).toEqual([]);
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

  it("clears pending requests when a completed turn settles back to idle", () => {
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
      type: "turn.completed",
      threadId: "thread-1",
      notificationId: "n-completed",
      turnId: "turn-1",
      timestamp,
      payload: { status: "completed" },
    });

    expect(store.getState().threadsById["thread-1"]).toMatchObject({
      status: "idle",
      permissionRequests: [],
      workspaceRequests: [],
    });
  });

  it("clears pending requests when thread status changes to a non-running terminal state", () => {
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
      payload: { value: "idle" },
    });

    expect(store.getState().threadsById["thread-1"]).toMatchObject({
      status: "idle",
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
