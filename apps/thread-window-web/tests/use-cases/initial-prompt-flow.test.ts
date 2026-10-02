import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  encodePermissionAnswer,
  type InitialPromptPayload,
  type ServerRequest,
  type ThreadNotification,
} from "../../src/protocol/threadProtocol.ts";
import { createThreadWindowStore } from "../../src/store/threadWindowStore.ts";
import { ThreadSocketClient } from "../../src/thread/threadSocketClient.ts";
import { ThreadInputController } from "../../src/thread/threadInputController.ts";

const timestamp = "2026-06-06T00:00:00.000Z";

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 3;

  sent: string[] = [];
  readyState = FakeWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;

  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this);
  }

  send(message: string): void {
    this.sent.push(message);
  }

  close(): void {
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.();
  }

  open(): void {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
  }

  receive(message: ThreadNotification | ServerRequest): void {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
}

function createInputClient(options: ConstructorParameters<typeof ThreadSocketClient>[0]) {
  const client = new ThreadSocketClient({
    ...options,
    onNotification: (notification) => inputs.handleNotification(notification),
  });
  const inputs = new ThreadInputController({
    getState: createThreadWindowStore.getState,
    client,
    now: options.now,
    onNotification: options.onNotification,
  });
  return { client, inputs };
}

function connectStoreClient(onNotification?: (notification: ThreadNotification) => void) {
  let commandSequence = 0;
  const { client, inputs } = createInputClient({
    url: "ws://127.0.0.1:4317/api/thread",
    WebSocketImpl: FakeWebSocket,
    now: () => timestamp,
    id: () => `command-${++commandSequence}`,
    onConnectionState: (state) => createThreadWindowStore.getState().setConnectionState(state),
    onNotification: (notification) => onNotification?.(notification),
    onRequest: (request) => createThreadWindowStore.getState().handleRequest(request),
  });
  client.connect();
  return { client, inputs, socket: FakeWebSocket.instances.at(-1)! };
}

describe("Thread input and socket flows", () => {
  beforeEach(() => {
    FakeWebSocket.instances = [];
    createThreadWindowStore.setState(createThreadWindowStore.getInitialState(), true);
  });

  it("connects, lists pets and threads, and dispatches inbound notifications without recovery requests", () => {
    const events: string[] = [];
    const { client } = createInputClient({
      url: "ws://127.0.0.1:4317/api/thread",
      WebSocketImpl: FakeWebSocket as never,
      now: () => "2026-06-06T00:00:00.000Z",
      id: vi.fn()
        .mockReturnValueOnce("pet-list-1")
        .mockReturnValueOnce("list-1")
        .mockReturnValueOnce("page-2")
        .mockReturnValue("resume-51"),
      onConnectionState: (state) => events.push(`state:${state}`),
      onNotification: (notification) => events.push(notification.type),
      onRequest: (request) => events.push(request.type),
    });

    client.connect();
    const socket = FakeWebSocket.instances[0];
    socket.open();
    socket.onmessage?.({
      data: JSON.stringify({
        type: "thread.listed",
        notificationId: "n1",
        timestamp: "2026-06-06T00:00:00.000Z",
        payload: { threads: [] },
      }),
    });

    expect(events).toEqual(["state:connecting", "state:connected", "thread.listed"]);
    expect(socket.sent.map((raw) => JSON.parse(raw))).toMatchObject([
      { type: "pet.list", commandId: "pet-list-1" },
      { type: "thread.list", commandId: "list-1" },
    ]);
    expect(socket.sent.map((raw) => JSON.parse(raw)).some((command) => command.type === "thread.resume")).toBe(false);

    const entry = (id: string) => ({
      id, petId: "pet-a", petRevision: 1, rootPath: "/tmp", status: "idle" as const,
      preview: id, messageCount: 1, createdAt: timestamp, updatedAt: timestamp,
    });
    socket.receive({ type: "thread.listed", notificationId: "page-1", timestamp, payload: {
      threads: Array.from({ length: 50 }, (_, i) => entry(`thread-${i}`)), nextCursor: "page-2",
    } });
    expect(JSON.parse(socket.sent.at(-1)!)).toMatchObject({ type: "thread.list", payload: { cursor: "page-2" } });
    socket.receive({ type: "thread.listed", notificationId: "page-2", timestamp, payload: { threads: [entry("old-51")] } });
    expect(createThreadWindowStore.getState().history).toHaveLength(51);
    expect(createThreadWindowStore.getState().history.find(thread => thread.preview === "old-51")?.petId).toBe("pet-a");
    client.resumeThread("old-51");
    expect(JSON.parse(socket.sent.at(-1)!)).toMatchObject({ type: "thread.resume", threadId: "old-51" });
    client.disconnect();
  });

  it("sends initial prompt as thread.start then resumes and starts the turn after thread.started", () => {
    const { client, inputs } = createInputClient({
      url: "ws://127.0.0.1:4317/api/thread",
      WebSocketImpl: FakeWebSocket as never,
      now: () => "2026-06-06T00:00:00.000Z",
      id: vi.fn()
        .mockReturnValueOnce("pet-list-1")
        .mockReturnValueOnce("list-1")
        .mockReturnValueOnce("resume-1")
        .mockReturnValueOnce("input-1"),
      onConnectionState: () => {},
      onNotification: () => {},
      onRequest: () => {},
    });

    client.connect();
    const socket = FakeWebSocket.instances[0];
    socket.open();
    inputs.startInitialPrompt({petId: "pet-default",
      clientRequestId: "prompt-1",
      userInput: {
        items: [{ type: "text", id: "text-1", text: "hello" }],
      },
    });
    socket.onmessage?.({
      data: JSON.stringify({
        type: "thread.started",
        threadId: "thread-1",
        notificationId: "n1",
        commandId: "prompt-1",
        timestamp: "2026-06-06T00:00:00.000Z",
        payload: {petId:"pet-default", petRevision:1, rootPath:"/tmp/pet",  preview: "hello" },
      }),
    });

    expect(socket.sent.map((raw) => JSON.parse(raw))).toMatchObject([
      { type: "pet.list", commandId: "pet-list-1" },
      { type: "thread.list", commandId: "list-1" },
      { type: "thread.start", commandId: "prompt-1", payload: { petId: "pet-default" } },
      { type: "thread.resume", threadId: "thread-1", commandId: "resume-1" },
      { type: "op.submit", threadId: "thread-1", commandId: "input-1", payload: { op: { type: "user_input", opId: "prompt-1", payload: { items: [{ type: "text", id: "text-1", text: "hello" }] } } } },
    ]);
    const startCommand = socket.sent.map((raw) => JSON.parse(raw)).find((command) => command.type === "thread.start");
    expect(startCommand.payload).not.toHaveProperty("dynamicTools");
  });

  it("keeps interleaved initial prompts associated through creation, snapshot, and recorded input", () => {
    const store = createThreadWindowStore;
    const promptA: InitialPromptPayload = {petId: "pet-default",
      clientRequestId: "prompt-a",
      userInput: {
        items: [
          { type: "text", id: "text-a", text: "focus on regressions" },
          { type: "image", id: "image-a", mimeType: "image/png", base64: "aW1hZ2UtYQ==" },
          { type: "skill", id: "skill-a", actionId: "review/code", title: "Review", prompt: "Review this code" },
          { type: "text_selection", id: "selection-a", text: "selected code" },
        ],
      },
    };
    const promptB: InitialPromptPayload = {petId: "pet-default",
      clientRequestId: "prompt-b",
      userInput: { items: [{ type: "text", id: "text-b", text: "another question" }] },
    };
    const observedPrompts: Array<{ threadId: string; prompt: InitialPromptPayload | null }> = [];
    const { inputs, socket } = connectStoreClient((notification) => {
      if (notification.type !== "thread.started") return;
      observedPrompts.push({
        threadId: notification.threadId,
        prompt: store.getState().threadsById[notification.threadId].pendingInitialPrompt,
      });
      expect(socket.sent.map((raw) => JSON.parse(raw)).filter((message) => (
        message.threadId === notification.threadId
      ))).toEqual([]);
    });
    socket.open();

    for (const prompt of [promptA, promptB]) {
      inputs.startInitialPrompt(prompt);
    }
    socket.receive({
      type: "thread.started",
      threadId: "thread-b",
      notificationId: "started-b",
      commandId: "prompt-b",
      timestamp,
      payload: {petId:"pet-default", petRevision:1, rootPath:"/tmp/pet",  preview: "another question" },
    });
    socket.receive({
      type: "thread.snapshot",
      threadId: "thread-b",
      notificationId: "snapshot-b",
      timestamp,
      payload: {petId:"pet-default", petRevision:1, rootPath:"/tmp/pet", petSnapshot:{petId:"pet-default",revision:1,name:"Default",rolePrompt:"Help"},  messages: [], status: "running" },
    });
    socket.receive({
      type: "thread.started",
      threadId: "thread-a",
      notificationId: "started-a",
      commandId: "prompt-a",
      timestamp,
      payload: {petId:"pet-default", petRevision:1, rootPath:"/tmp/pet",  preview: "focus on regressions" },
    });
    socket.receive({
      type: "thread.snapshot",
      threadId: "thread-a",
      notificationId: "snapshot-a",
      timestamp,
      payload: {petId:"pet-default", petRevision:1, rootPath:"/tmp/pet", petSnapshot:{petId:"pet-default",revision:1,name:"Default",rolePrompt:"Help"},  messages: [], status: "running" },
    });

    expect(observedPrompts).toEqual([
      { threadId: "thread-b", prompt: promptB },
      { threadId: "thread-a", prompt: promptA },
    ]);
    expect(socket.sent.map((raw) => JSON.parse(raw)).slice(2)).toMatchObject([
      { type: "thread.start", commandId: "prompt-a" },
      { type: "thread.start", commandId: "prompt-b" },
      { type: "thread.resume", threadId: "thread-b" },
      { type: "op.submit", threadId: "thread-b", payload: { op: { opId: "prompt-b", payload: promptB.userInput } } },
      { type: "thread.resume", threadId: "thread-a" },
      { type: "op.submit", threadId: "thread-a", payload: { op: { opId: "prompt-a", payload: promptA.userInput } } },
    ]);
    expect(store.getState().threadsById["thread-a"].messages).toEqual([{
      type: "user_message",
      id: "pending-prompt-a",
      text: "focus on regressions\n\n图片附件\n\nReview\n\nselected code",
      inputItems: [],
      pending: true,
    }]);
    const pendingMessagesB = store.getState().threadsById["thread-b"].messages;
    expect(pendingMessagesB).toEqual([{
      type: "user_message",
      id: "pending-prompt-b",
      text: "another question",
      inputItems: [],
      pending: true,
    }]);

    socket.receive({
      type: "user.message.recorded",
      threadId: "thread-a",
      notificationId: "recorded-a",
      timestamp,
      payload: { messageId: "message-a", text: "recorded review input", items: promptA.userInput.items },
    });

    expect(store.getState().threadsById["thread-a"].messages).toEqual([{
      type: "user_message",
      id: "message-a",
      text: "recorded review input",
      inputItems: promptA.userInput.items,
    }]);
    expect(store.getState().threadsById["thread-b"].messages).toEqual(pendingMessagesB);

    socket.receive({
      type: "user.message.recorded",
      threadId: "thread-b",
      notificationId: "recorded-b",
      timestamp,
      payload: { messageId: "message-b", text: "another question", items: promptB.userInput.items },
    });

    expect(store.getState().threadsById["thread-b"].messages).toEqual([{
      type: "user_message",
      id: "message-b",
      text: "another question",
      inputItems: promptB.userInput.items,
    }]);
  });

  it("does not include dynamic tools when starting an initial prompt thread", () => {
    const { client, inputs } = createInputClient({
      url: "ws://127.0.0.1:4317/api/thread",
      WebSocketImpl: FakeWebSocket as never,
      now: () => "2026-06-06T00:00:00.000Z",
      id: vi.fn()
        .mockReturnValueOnce("pet-list-1")
        .mockReturnValueOnce("list-1"),
      onConnectionState: () => {},
      onNotification: () => {},
      onRequest: () => {},
    });

    client.connect();
    const socket = FakeWebSocket.instances[0];
    socket.open();
    inputs.startInitialPrompt({petId: "pet-default",
      clientRequestId: "prompt-1",
      userInput: {
        items: [{ type: "text", id: "text-1", text: "hello" }],
      },
    });

    const startCommand = socket.sent.map((raw) => JSON.parse(raw)).find((command) => command.type === "thread.start");
    expect(startCommand).toEqual({
      type: "thread.start",
      commandId: "prompt-1",
      timestamp: "2026-06-06T00:00:00.000Z",
      payload: { petId: "pet-default" },
    });
  });

  it("marks unexpected close as disconnected without opening another socket or sending recovery commands", () => {
    vi.useFakeTimers();
    try {
      const events: string[] = [];
      const client = new ThreadSocketClient({
        url: "ws://127.0.0.1:4317/api/thread",
        WebSocketImpl: FakeWebSocket as never,
        now: () => "2026-06-06T00:00:00.000Z",
        id: () => "cmd-1",
        onConnectionState: (state) => events.push(state),
        onNotification: () => {},
        onRequest: () => {},
      });

      client.connect();
      const socket = FakeWebSocket.instances[0];
      socket.open();
      socket.sent = [];
      socket.onclose?.();
      vi.advanceTimersByTime(5_000);

      expect(events).toEqual(["connecting", "connected", "disconnected"]);
      expect(FakeWebSocket.instances).toHaveLength(1);
      expect(socket.sent).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("ignores malformed inbound messages without dispatching callbacks", () => {
    const onNotification = vi.fn();
    const onRequest = vi.fn();
    const client = new ThreadSocketClient({
      url: "ws://127.0.0.1:4317/api/thread",
      WebSocketImpl: FakeWebSocket as never,
      onConnectionState: () => {},
      onNotification,
      onRequest,
    });

    client.connect();
    const socket = FakeWebSocket.instances[0];

    expect(() => {
      socket.onmessage?.({ data: "not-json" });
      socket.onmessage?.({ data: JSON.stringify({ type: "thread.listed" }) });
      socket.onmessage?.({ data: JSON.stringify({ type: "unknown" }) });
    }).not.toThrow();
    expect(onNotification).not.toHaveBeenCalled();
    expect(onRequest).not.toHaveBeenCalled();
  });

  it("keeps connect idempotent while connecting or connected", () => {
    const client = new ThreadSocketClient({
      url: "ws://127.0.0.1:4317/api/thread",
      WebSocketImpl: FakeWebSocket as never,
      now: () => "2026-06-06T00:00:00.000Z",
      id: vi.fn()
        .mockReturnValueOnce("pet-list-1")
        .mockReturnValueOnce("list-1"),
      onConnectionState: () => {},
      onNotification: () => {},
      onRequest: () => {},
    });

    client.connect();
    client.connect();
    expect(FakeWebSocket.instances).toHaveLength(1);

    const socket = FakeWebSocket.instances[0];
    socket.open();
    client.connect();

    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(socket.sent.map((raw) => JSON.parse(raw))).toMatchObject([
      { type: "pet.list", commandId: "pet-list-1" },
      { type: "thread.list", commandId: "list-1" },
    ]);
  });

  it("queues initial prompt commands before open and flushes them on open", () => {
    const { client, inputs } = createInputClient({
      url: "ws://127.0.0.1:4317/api/thread",
      WebSocketImpl: FakeWebSocket as never,
      now: () => "2026-06-06T00:00:00.000Z",
      id: vi.fn()
        .mockReturnValueOnce("pet-list-1")
        .mockReturnValueOnce("list-1")
        .mockReturnValueOnce("resume-1")
        .mockReturnValueOnce("input-1"),
      onConnectionState: () => {},
      onNotification: () => {},
      onRequest: () => {},
    });

    client.connect();
    const socket = FakeWebSocket.instances[0];

    expect(() => inputs.startInitialPrompt({petId: "pet-default",
      clientRequestId: "prompt-1",
      userInput: {
        items: [{ type: "text", id: "text-1", text: "hello before open" }],
      },
    })).not.toThrow();
    expect(socket.sent).toEqual([]);

    socket.open();
    socket.onmessage?.({
      data: JSON.stringify({
        type: "thread.started",
        threadId: "thread-1",
        notificationId: "n1",
        commandId: "prompt-1",
        timestamp: "2026-06-06T00:00:00.000Z",
        payload: {petId:"pet-default", petRevision:1, rootPath:"/tmp/pet",  preview: "hello before open" },
      }),
    });

    expect(socket.sent.map((raw) => JSON.parse(raw))).toMatchObject([
      { type: "thread.start", commandId: "prompt-1", payload: { petId: "pet-default" } },
      { type: "pet.list", commandId: "pet-list-1" },
      { type: "thread.list", commandId: "list-1" },
      { type: "thread.resume", threadId: "thread-1", commandId: "resume-1" },
      { type: "op.submit", threadId: "thread-1", commandId: "input-1", payload: { op: { type: "user_input", opId: "prompt-1", payload: { items: [{ type: "text", id: "text-1", text: "hello before open" }] } } } },
    ]);
  });

  it("submits idle, running and waiting-reply inputs immediately and projects backend pending per Thread", () => {
    const store = createThreadWindowStore;
    const { inputs, socket } = connectStoreClient();
    socket.open();
    socket.sent = [];
    store.getState().ensureThreadState("thread-a");
    store.getState().ensureThreadState("thread-b");
    const input = (text: string) => ({ items: [{ type: "text" as const, id: text, text }] });
    const sentInputs = () => socket.sent.map((raw) => JSON.parse(raw)).map((command) => ({
      type: command.type,
      threadId: command.threadId,
      text: command.payload.op.payload.items[0].text,
    }));
    const firstInput = input("first");
    inputs.submitComposerInput("thread-a", firstInput);
    firstInput.items[0].text = "edited after submission";
    inputs.submitComposerInput("thread-a", input("second"));
    socket.receive({
      type: "turn.started", threadId: "thread-a", turnId: "first", notificationId: "started-first", timestamp,
      payload: {},
    });
    inputs.submitComposerInput("thread-a", input("third"));
    inputs.submitComposerInput("thread-b", input("other Thread"));

    expect(sentInputs()).toEqual([
      { type: "op.submit", threadId: "thread-a", text: "first" },
      { type: "op.submit", threadId: "thread-a", text: "second" },
      { type: "op.submit", threadId: "thread-a", text: "third" },
      { type: "op.submit", threadId: "thread-b", text: "other Thread" },
    ]);
    expect(store.getState().threadsById["thread-a"]).toMatchObject({ status: "running", messages: [] });
    for (const text of ["second", "third"]) {
      socket.receive({
        type: "user.message.recorded", threadId: "thread-a", notificationId: `recorded-${text}`, timestamp,
        payload: { messageId: text, text, items: input(text).items, pending: true },
      });
    }
    expect(store.getState().threadsById["thread-a"].messages).toMatchObject([
      { id: "second", text: "second", pending: true },
      { id: "third", text: "third", pending: true },
    ]);
    socket.receive({
      type: "turn.completed", threadId: "thread-a", turnId: "first", notificationId: "completed-first", timestamp,
      payload: { status: "completed" },
    });
    socket.receive({
      type: "turn.started", threadId: "thread-a", turnId: "second", notificationId: "started-second", timestamp,
      payload: {},
    });
    expect(store.getState().threadsById["thread-a"].messages).toMatchObject([
      { id: "second", pending: false }, { id: "third", pending: true },
    ]);
    expect(store.getState().threadsById["thread-b"].messages).toEqual([]);
    expect(sentInputs()).toHaveLength(4);

    socket.receive({
      type: "assistant.delta", threadId: "thread-a", turnId: "second", itemId: "question", notificationId: "question", timestamp,
      payload: { text: "怎么处理？", suggestedReplies: ["请整理"], awaitingReply: true },
    });
    inputs.submitComposerInput("thread-a", input("请整理"));
    expect(sentInputs().at(-1)).toEqual({ type: "op.submit", threadId: "thread-a", text: "请整理" });
    socket.receive({
      type: "user.message.recorded", threadId: "thread-a", notificationId: "recorded-reply", timestamp,
      payload: { messageId: "reply", text: "请整理", items: input("请整理").items },
    });
    expect(store.getState().threadsById["thread-a"].messages.find((message) => message.id === "question")).toMatchObject({
      awaitingReply: false,
    });
  });

  it("flushes mixed commands and client responses in order before the initial list requests", () => {
    const { client, socket } = connectStoreClient();
    client.resumeThread("history-thread");
    client.sendRaw(encodePermissionAnswer({
      requestId: "history-thread:permission",
      timestamp,
      decision: "allow",
      scope: "once",
    }));
    client.submitOp("other-thread", {
      type: "user_input",
      opId: "queued-input",
      timestamp,
      payload: { items: [{ type: "text", id: "queued-text", text: "before open" }] },
    });

    expect(socket.sent).toEqual([]);
    socket.open();

    expect(createThreadWindowStore.getState().connectionState).toBe("connected");
    expect(socket.sent.map((raw) => JSON.parse(raw))).toEqual([
      { type: "thread.resume", threadId: "history-thread", commandId: "command-1", timestamp },
      {
        type: "permission.answered",
        requestId: "history-thread:permission",
        timestamp,
        payload: { decision: "allow", scope: "once" },
      },
      {
        type: "op.submit",
        threadId: "other-thread",
        commandId: "command-2",
        timestamp,
        payload: {
          op: {
            type: "user_input",
            opId: "queued-input",
            timestamp,
            payload: { items: [{ type: "text", id: "queued-text", text: "before open" }] },
          },
        },
      },
      { type: "pet.list", commandId: "command-3", timestamp },
      { type: "thread.list", commandId: "command-4", timestamp },
    ]);
  });

  it("sends explicit request answers and limits answered or failed panel cleanup to the owning thread", () => {
    const store = createThreadWindowStore;
    const { client, socket } = connectStoreClient();
    socket.open();
    socket.sent = [];
    const candidate = { id: "project", name: "Project", description: "/project", isDefault: false };
    const requestPanels = (threadId: string, suffix: string) => {
      socket.receive({
        type: "permission.requested",
        requestId: `${threadId}:permission-${suffix}`,
        threadId,
        timestamp,
        payload: { toolName: "file.write", toolCallId: `tool-${suffix}`, arguments: { path: `${threadId}.txt` } },
      });
    };
    requestPanels("thread-a", "1");
    requestPanels("thread-b", "1");

    expect(store.getState().threadsById["thread-a"]).toMatchObject({
      permissionRequests: [{
        id: "thread-a:permission-1",
        toolName: "file.write",
        toolCallId: "tool-1",
        argumentsJSON: JSON.stringify({ path: "thread-a.txt" }),
      }],
    });
    const threadB = store.getState().threadsById["thread-b"];
    expect(threadB).toMatchObject({
      permissionRequests: [{ id: "thread-b:permission-1" }],
    });

    client.sendRaw(encodePermissionAnswer({
      requestId: "thread-a:permission-1",
      timestamp,
      decision: "allow",
      scope: "always",
    }));
    store.getState().resolvePermissionRequest("thread-a:permission-1");
    expect(store.getState().threadsById["thread-a"]).toMatchObject({
      permissionRequests: [],
    });
    expect(store.getState().threadsById["thread-a"]).toMatchObject({
      permissionRequests: [],
    });
    expect(store.getState().threadsById["thread-b"]).toEqual(threadB);
    expect(socket.sent.map((raw) => JSON.parse(raw))).toEqual([
      {
        type: "permission.answered",
        requestId: "thread-a:permission-1",
        timestamp,
        payload: { decision: "allow", scope: "always" },
      },
    ]);

    requestPanels("thread-a", "2");
    socket.receive({
      type: "thread.error",
      threadId: "thread-a",
      notificationId: "error-a",
      timestamp,
      payload: { message: "tool execution failed" },
    });

    expect(store.getState().threadsById["thread-a"]).toMatchObject({
      status: "failed",
      errorMessage: "tool execution failed",
      permissionRequests: [],
    });
    expect(store.getState().threadsById["thread-b"]).toEqual(threadB);
  });

  it("clears queued messages on manual disconnect without reconnecting", () => {
    vi.useFakeTimers();
    try {
      const events: string[] = [];
      const client = new ThreadSocketClient({
        url: "ws://127.0.0.1:4317/api/thread",
        WebSocketImpl: FakeWebSocket as never,
        now: () => "2026-06-06T00:00:00.000Z",
        id: () => "cmd-1",
        onConnectionState: (state) => events.push(state),
        onNotification: () => {},
        onRequest: () => {},
      });

      client.connect();
      const socket = FakeWebSocket.instances[0];
      client.submitOp("thread-1", {
        type: "user_input",
        opId: "queued-1",
        timestamp: "2026-06-06T00:00:00.000Z",
        payload: { items: [{ type: "text", id: "text-1", text: "queued before open" }] },
      });
      socket.onclose?.();
      client.disconnect();
      vi.advanceTimersByTime(25);

      expect(FakeWebSocket.instances).toHaveLength(1);
      expect(socket.sent).toEqual([]);
      expect(events.at(-1)).toBe("disconnected");
    } finally {
      vi.useRealTimers();
    }
  });

  it("clears pending initial prompt on matching thread error and ignores later started with same command id", () => {
    const { client, inputs } = createInputClient({
      url: "ws://127.0.0.1:4317/api/thread",
      WebSocketImpl: FakeWebSocket as never,
      now: () => "2026-06-06T00:00:00.000Z",
      id: vi.fn()
        .mockReturnValueOnce("pet-list-1")
        .mockReturnValueOnce("list-1")
        .mockReturnValueOnce("resume-1")
        .mockReturnValueOnce("input-1"),
      onConnectionState: () => {},
      onNotification: () => {},
      onRequest: () => {},
    });

    client.connect();
    const socket = FakeWebSocket.instances[0];
    socket.open();
    inputs.startInitialPrompt({petId: "pet-default",
      clientRequestId: "prompt-1",
      userInput: {
        items: [{ type: "text", id: "text-1", text: "hello" }],
      },
    });

    socket.onmessage?.({
      data: JSON.stringify({
        type: "thread.started",
        threadId: "thread-other",
        notificationId: "n-other-started",
        commandId: "prompt-other",
        timestamp: "2026-06-06T00:00:00.000Z",
        payload: {petId:"pet-default", petRevision:1, rootPath:"/tmp/pet",  preview: "other" },
      }),
    });
    socket.onmessage?.({
      data: JSON.stringify({
        type: "thread.error",
        notificationId: "n-other-error",
        commandId: "prompt-other",
        timestamp: "2026-06-06T00:00:00.000Z",
        payload: { message: "other failed" },
      }),
    });
    socket.onmessage?.({
      data: JSON.stringify({
        type: "thread.error",
        notificationId: "n-error",
        commandId: "prompt-1",
        timestamp: "2026-06-06T00:00:00.000Z",
        payload: { message: "failed" },
      }),
    });
    socket.onmessage?.({
      data: JSON.stringify({
        type: "thread.started",
        threadId: "thread-1",
        notificationId: "n-late-started",
        commandId: "prompt-1",
        timestamp: "2026-06-06T00:00:00.000Z",
        payload: {petId:"pet-default", petRevision:1, rootPath:"/tmp/pet",  preview: "hello" },
      }),
    });

    const sent = socket.sent.map((raw) => JSON.parse(raw));
    expect(sent).toMatchObject([
      { type: "pet.list", commandId: "pet-list-1" },
      { type: "thread.list", commandId: "list-1" },
      { type: "thread.start", commandId: "prompt-1", payload: { petId: "pet-default" } },
    ]);
    expect(sent.some((command) => command.type === "input.submit")).toBe(false);
    expect(sent.some((command) => command.type === "thread.resume" && command.threadId === "thread-1")).toBe(false);
  });

  it("rejects duplicate initial prompt clientRequestId without overwriting pending prompt", () => {
    const { client, inputs } = createInputClient({
      url: "ws://127.0.0.1:4317/api/thread",
      WebSocketImpl: FakeWebSocket as never,
      now: () => "2026-06-06T00:00:00.000Z",
      id: vi.fn()
        .mockReturnValueOnce("pet-list-1")
        .mockReturnValueOnce("list-1")
        .mockReturnValueOnce("resume-1")
        .mockReturnValueOnce("input-1"),
      onConnectionState: () => {},
      onNotification: () => {},
      onRequest: () => {},
    });

    client.connect();
    const socket = FakeWebSocket.instances[0];
    socket.open();
    inputs.startInitialPrompt({petId: "pet-default",
      clientRequestId: "prompt-1",
      userInput: {
        items: [{ type: "text", id: "text-1", text: "first" }],
      },
    });

    expect(() => inputs.startInitialPrompt({petId: "pet-default",
      clientRequestId: "prompt-1",
      userInput: {
        items: [{ type: "text", id: "text-2", text: "second" }],
      },
    })).toThrow(/already pending/);

    socket.onmessage?.({
      data: JSON.stringify({
        type: "thread.started",
        threadId: "thread-1",
        notificationId: "n1",
        commandId: "prompt-1",
        timestamp: "2026-06-06T00:00:00.000Z",
        payload: {petId:"pet-default", petRevision:1, rootPath:"/tmp/pet",  preview: "first" },
      }),
    });

    expect(socket.sent.map((raw) => JSON.parse(raw))).toMatchObject([
      { type: "pet.list", commandId: "pet-list-1" },
      { type: "thread.list", commandId: "list-1" },
      { type: "thread.start", commandId: "prompt-1", payload: { petId: "pet-default" } },
      { type: "thread.resume", threadId: "thread-1", commandId: "resume-1" },
      {
        type: "op.submit",
        threadId: "thread-1",
        commandId: "input-1",
        payload: {
          op: {
            type: "user_input",
            opId: "prompt-1",
            timestamp: "2026-06-06T00:00:00.000Z",
            payload: { items: [{ type: "text", id: "text-1", text: "first" }] },
          },
        },
      },
    ]);
  });
});
