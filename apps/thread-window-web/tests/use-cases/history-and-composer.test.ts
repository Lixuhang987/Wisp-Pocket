import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { InputItem } from "../../src/protocol/threadProtocol.ts";
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
    store.getState().enqueueInitialPrompt({petId: "pet-default",
      clientRequestId: "prompt-1",
      userInput: { items: [{ type: "text", id: "text-1", text: "hello" }] },
    });

    store.getState().handleNotification({
      type: "thread.started",
      threadId: "thread-1",
      notificationId: "n1",
      commandId: "prompt-1",
      timestamp,
      payload: {workspaceId:"workspace-default",petId:"pet-default",petRevision:1, rootPath:"/tmp/pet",  preview: "hello" },
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
    store.getState().enqueueInitialPrompt({petId: "pet-default",
      clientRequestId: "prompt-1",
      userInput: { items: [{ type: "text", id: "text-1", text: "hello" }] },
    });
    store.getState().handleNotification({
      type: "thread.started",
      threadId: "thread-1",
      notificationId: "n1",
      commandId: "prompt-1",
      timestamp,
      payload: {workspaceId:"workspace-default",petId:"pet-default",petRevision:1, rootPath:"/tmp/pet",  preview: "hello" },
    });
    store.getState().handleNotification({
      type: "thread.snapshot",
      threadId: "thread-1",
      notificationId: "n2",
      commandId: "resume-1",
      timestamp,
      payload: {workspaceId:"workspace-default",petId:"pet-default",petRevision:1, rootPath:"/tmp/pet", petSnapshot:{petId:"pet-default",revision:1,name:"Default",rolePrompt:"Help"},  messages: [], status: "running" },
    });

    expect(store.getState().threadsById["thread-1"].messages).toEqual([
      { type: "user_message", id: "pending-prompt-1", text: "hello", inputItems: [{ type: "text", id: "text-1", text: "hello" }], pending: true },
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
      payload: {workspaceId:"workspace-default",petId:"pet-default",petRevision:1, rootPath:"/tmp/pet", petSnapshot:{petId:"pet-default",revision:1,name:"Default",rolePrompt:"Help"},
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
      payload: {workspaceId:"workspace-default",petId:"pet-default",petRevision:1, rootPath:"/tmp/pet",  preview: null },
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

    expect(store.getState().history[0]).toMatchObject({petRevision:1, rootPath:"/tmp/pet", status:"idle",
      id: "thread-1",
      preview: "[mock:assistant-ok] live history",
      petId: "pet-default",
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
    expect(store.getState().history[0]).toMatchObject({workspaceId:"workspace-default",petId:"pet-default",petRevision:1, rootPath:"/tmp/pet", status:"idle",
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
      payload: {workspaceId:"workspace-default",petId:"pet-default",petRevision:1, rootPath:"/tmp/pet", petSnapshot:{petId:"pet-default",revision:1,name:"Default",rolePrompt:"Help"},
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
      payload: {workspaceId:"workspace-default",petId:"pet-default",petRevision:1, rootPath:"/tmp/pet", petSnapshot:{petId:"pet-default",revision:1,name:"Default",rolePrompt:"Help"},  status: "idle", messages: [
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
      history: [{workspaceId:"workspace-default",petId:"pet-default",petRevision:1, rootPath:"/tmp/pet", status:"idle",
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

  it("stores pets from pet.listed notifications", () => {
    const store = createThreadWindowStore;

    store.getState().handleNotification({
      type: "pet.listed",
      notificationId: "n-pets",
      commandId: "pet-list-1",
      timestamp,
      payload: {
        pets: [
          {workspaceId:"workspace-1",description:"", rolePrompt:"Help", revision:1, imageRef:{type:"builtin",id:"yachiyo"}, isDefault:false, createdAt:"2026", updatedAt:"2026",  id: "tmp", name: "tmp", rootPath: "/tmp" },
          {workspaceId:"workspace-1",description:"", rolePrompt:"Help", revision:1, imageRef:{type:"builtin",id:"yachiyo"}, isDefault:false, createdAt:"2026", updatedAt:"2026",  id: "handagent-test", name: "handagent-test", rootPath: "/handagent" },
        ],
      },
    });

    expect(store.getState().pets.map((pet) => pet.name)).toEqual([
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
    store.getState().enqueueInitialPrompt({petId: "pet-default",
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

  it("stores permission requests by thread", () => {
    const store = createThreadWindowStore;
    store.getState().ensureThreadState("thread-1");
    store.getState().handleRequest({
      type: "permission.requested",
      requestId: "thread-1:req-1",
      threadId: "thread-1",
      timestamp,
      payload: { toolName: "file.write", toolCallId: "tool-1", arguments: { path: "a.txt" } },
    });

    expect(store.getState().threadsById["thread-1"].permissionRequests).toHaveLength(1);
  });

  it.each([
    ["completed", "idle"],
    ["interrupted", "interrupted"],
    ["failed", "failed"],
  ] as const)("projects a %s turn as %s and clears only that thread's requests", (turnStatus, visibleStatus) => {
    const store = createThreadWindowStore;
    store.getState().enqueueInitialPrompt({petId: "pet-default",
      clientRequestId: "prompt-1",
      userInput: { items: [{ type: "text", id: "text-1", text: "hello" }] },
    });
    store.getState().handleNotification({
      type: "thread.started",
      threadId: "thread-1",
      notificationId: "thread-started",
      commandId: "prompt-1",
      timestamp,
      payload: {workspaceId:"workspace-default",petId:"pet-default",petRevision:1, rootPath:"/tmp/pet",  preview: "hello" },
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
        payload: { toolName: "pet.askUser", toolCallId: "tool-1", arguments: { prompt: "Pick pet" } },
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
      payload: { toolName: "pet.askUser", toolCallId: "tool-1", arguments: { prompt: "Pick pet" } },
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

    store.getState().resolvePermissionRequest("thread-1:req-1");

    expect(store.getState().threadsById["thread-1"].permissionRequests).toEqual([]);
  });
});
