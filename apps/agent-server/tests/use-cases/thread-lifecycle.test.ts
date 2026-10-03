import { EventEmitter, once } from "node:events";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WebSocket } from "ws";
import { describe, expect, it, vi } from "vitest";
import type { AgentMessage } from "@handagent/core/runtime/types/AgentMessage.ts";
import type { AgentRuntimeEvent } from "@handagent/core/runtime/AgentRuntime.ts";
import type { ThreadCommand } from "@handagent/core/protocol/types/ThreadCommand.ts";
import type { ClientResponse } from "@handagent/core/protocol/types/ClientResponse.ts";
import type { ServerRequest } from "@handagent/core/protocol/types/ServerRequest.ts";
import type { AgentActivityEvent } from "@handagent/core/protocol/types/AgentActivity.ts";
import type { FilePermissionPolicy } from "@handagent/core/adapters/filesystem/FilePermissionPolicy.ts";
import type { MCPClient } from "@handagent/core/mcp/MCPClient.ts";
import { ThreadStore } from "@handagent/thread-store/index.ts";
import { DynamicToolAdapter } from "@handagent/core/tools/DynamicToolAdapter.ts";
import { WebSocketDynamicToolBridge } from "../../src/bridges/WebSocketDynamicToolBridge.ts";
import { AgentActivityPublisher } from "../../src/activity/AgentActivityPublisher.ts";
import { ThreadPersistence } from "../../src/thread/ThreadPersistence.ts";
import { ThreadCommandRouter } from "../../src/thread/ThreadCommandRouter.ts";
import { ThreadNotificationPublisher } from "../../src/thread/ThreadNotificationPublisher.ts";
import {
  attachActivitySocketHandlers,
  attachDynamicToolSocketHandlers,
  attachThreadSocketHandlers,
  createMCPClientFromConfig,
  resolveLLMMode,
  startServer,
} from "../../src/server/server.ts";

class FakeSocket extends EventEmitter {
  sent: string[] = [];

  send(raw: string): void {
    this.sent.push(raw);
  }
}

function opSubmit(threadId: string, text: string): ThreadCommand {
  return {
    type: "op.submit",
    threadId,
    commandId: `command-${threadId}-${text}`,
    timestamp: new Date().toISOString(),
    payload: {
      op: {
        type: "user_input",
        opId: `message-${threadId}-${text}`,
        timestamp: new Date().toISOString(),
        payload: {
          items: [{ type: "text", id: `item-${threadId}-${text}`, text }],
        },
      },
    },
  };
}

function permissionResponse(
  requestId: string,
  decision: "allow" | "deny" = "allow",
): ClientResponse {
  return {
    type: "permission.answered",
    requestId,
    timestamp: new Date().toISOString(),
    payload: { decision, scope: "once" },
  };
}

async function emitMessage(
  socket: FakeSocket,
  message: ThreadCommand | ClientResponse,
): Promise<void> {
  socket.emit("message", Buffer.from(JSON.stringify(message)));
  await Promise.resolve();
}

async function emitRawMessage(socket: FakeSocket, raw: string): Promise<void> {
  socket.emit("message", Buffer.from(raw));
  await Promise.resolve();
}

function makeHandlerDependencies(options: {
  commandRouter?: Partial<ThreadCommandRouter>;
  eventPublisher?: ThreadNotificationPublisher;
} = {}) {
  return {
    commandRouter: {
      receive: vi.fn(async () => {}),
      interruptThread: vi.fn(),
      handleResponse: vi.fn(),
      ...options.commandRouter,
    } as unknown as ThreadCommandRouter,
    eventPublisher: options.eventPublisher ?? new ThreadNotificationPublisher(),
  };
}

function stripUserInputItems<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUserInputItems(item)) as T;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const next: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(record)) {
      if (key === "inputItems") {
        continue;
      }
      next[key] = stripUserInputItems(item);
    }
    return next as T;
  }
  return value;
}

function lastSent<T>(socket: FakeSocket): T {
  return JSON.parse(socket.sent.at(-1) ?? "null") as T;
}

async function waitForClose(socket: WebSocket, timeoutMs = 250): Promise<boolean> {
  const close = once(socket, "close").then(() => true);
  const timeout = new Promise<boolean>((resolve) => {
    setTimeout(() => resolve(false), timeoutMs);
  });
  return Promise.race([close, timeout]);
}

describe("dynamic tool declaration refresh", () => {
  it("keeps a saved automation call pending until its provider reports the actual result", async () => {
    vi.useFakeTimers();
    const socket = new FakeSocket();
    const bridge = new WebSocketDynamicToolBridge();
    try {
      attachDynamicToolSocketHandlers(socket, { bridge });
      socket.emit("message", Buffer.from(JSON.stringify({ channel: "dynamic_tools", type: "provider_hello", clientId: "swift-host", tools: [] })));
      const tool = new DynamicToolAdapter({
        clientId: "swift-host", namespace: "automation", name: "run", description: "Run saved policy",
        inputSchema: { type: "object" },
      }, bridge);
      let settled = false;
      const result = tool.call({ policyId: "waiting-policy" }, { threadId: "long-thread", turnId: "long-turn", toolCallId: "long-run" });
      const observed = result.then((value) => { settled = true; return value; }, (error) => { settled = true; throw error; });
      const success = expect(observed).resolves.toMatchObject({ callId: "long-run", success: true });
      await vi.advanceTimersByTimeAsync(17_000);
      expect(settled).toBe(false);
      const request = lastSent<{ payload: { callId: string } }>(socket);
      socket.emit("message", Buffer.from(JSON.stringify({
        channel: "dynamic_tools", type: "tool_call_response",
        payload: { callId: request.payload.callId, success: true, contentItems: [{ type: "inputText", text: '{"run":{"status":"completed"}}' }] },
      })));
      await success;
    } finally {
      bridge.close();
      vi.useRealTimers();
    }
  });

  it("preserves an in-flight call when the same provider updates its tools", async () => {
    const socket = new FakeSocket();
    const bridge = new WebSocketDynamicToolBridge();
    attachDynamicToolSocketHandlers(socket, { bridge });
    const receive = (message: unknown) => socket.emit("message", Buffer.from(JSON.stringify(message)));
    receive({ channel: "dynamic_tools", type: "provider_hello", clientId: "swift-host", tools: [] });
    const response = bridge.call({
      clientId: "swift-host", threadId: "thread-refresh", turnId: "turn-refresh", callId: "run-refresh",
      namespace: "automation", tool: "run", arguments: { policyId: "saved-policy" },
    });
    expect(lastSent(socket)).toMatchObject({ type: "tool_call_request", payload: { callId: "run-refresh" } });
    receive({
      channel: "dynamic_tools", type: "provider_hello", clientId: "swift-host",
      tools: [{ clientId: "swift-host", namespace: "automation", name: "run", description: "Run saved policy", inputSchema: { type: "object" } }],
    });
    const refreshedTools = bridge.availableTools();
    receive({
      channel: "dynamic_tools", type: "tool_call_response",
      payload: { callId: "run-refresh", success: true, contentItems: [{ type: "inputText", text: "completed" }] },
    });
    await expect(response).resolves.toMatchObject({ callId: "run-refresh", success: true });
    expect(refreshedTools).toMatchObject([{ clientId: "swift-host", namespace: "automation", name: "run" }]);
    receive({ channel: "dynamic_tools", type: "provider_hello", clientId: "swift-host", tools: [] });
    expect(bridge.availableTools()).toEqual([]);
    socket.emit("close");
    await expect(bridge.call({
      clientId: "swift-host", threadId: "thread-refresh", turnId: "turn-refresh", callId: "after-close",
      namespace: "automation", tool: "history", arguments: {},
    })).rejects.toThrow("offline");
  });

  it("keeps the replacement provider's declarations and calls when an old socket refreshes", async () => {
    const bridge = new WebSocketDynamicToolBridge();
    const oldSocket = new FakeSocket();
    const newSocket = new FakeSocket();
    const hello = (name: string) => Buffer.from(JSON.stringify({
      channel: "dynamic_tools", type: "provider_hello", clientId: "swift-host",
      tools: [{ clientId: "swift-host", namespace: "host", name, description: name, inputSchema: { type: "object" } }],
    }));
    attachDynamicToolSocketHandlers(oldSocket, { bridge });
    attachDynamicToolSocketHandlers(newSocket, { bridge });
    try {
      oldSocket.emit("message", hello("old"));
      newSocket.emit("message", hello("current"));
      oldSocket.emit("message", hello("stale-refresh"));
      expect(bridge.availableTools()).toMatchObject([{ name: "current" }]);
      const result = bridge.call({
        clientId: "swift-host", threadId: "thread", turnId: "turn", callId: "current-call",
        namespace: "host", tool: "current", arguments: {},
      });
      expect(lastSent(newSocket)).toMatchObject({ type: "tool_call_request", payload: { callId: "current-call" } });
      oldSocket.emit("close");
      newSocket.emit("message", Buffer.from(JSON.stringify({
        channel: "dynamic_tools", type: "tool_call_response",
        payload: { callId: "current-call", success: true, contentItems: [{ type: "inputText", text: "current" }] },
      })));
      await expect(result).resolves.toMatchObject({ callId: "current-call", success: true });
    } finally {
      bridge.close();
    }
  });
});

describe("attachThreadSocketHandlers", () => {
  it("only detaches subscriptions when a UI socket closes", async () => {
    const socket = new FakeSocket();
    const { commandRouter, eventPublisher } = makeHandlerDependencies();
    attachThreadSocketHandlers(socket as never, { commandRouter, eventPublisher });
    await emitMessage(socket, opSubmit("Thread-A", "first"));
    socket.emit("close");
    expect(commandRouter.interruptThread).not.toHaveBeenCalled();
  });

  it("routes client responses to the command router instead of bridge handlers", async () => {
    const socket = new FakeSocket();
    const { commandRouter, eventPublisher } = makeHandlerDependencies();

    attachThreadSocketHandlers(socket as never, {
      commandRouter,
      eventPublisher,
    });

    const response = permissionResponse("Thread-A:request-1", "allow");
    await emitMessage(socket, response);

    expect(commandRouter.handleResponse).toHaveBeenCalledWith(
      response,
      expect.any(String),
    );
  });

  it("sends server requests only through request owner connections", async () => {
    const socket = new FakeSocket();
    const swiftSocket = new FakeSocket();
    const { commandRouter, eventPublisher } = makeHandlerDependencies();

    attachThreadSocketHandlers(socket as never, {
      commandRouter,
      eventPublisher,
      acceptServerRequests: true,
    });
    attachThreadSocketHandlers(swiftSocket as never, {
      commandRouter,
      eventPublisher,
    });

    await emitMessage(socket, opSubmit("Thread-A", "first"));
    await emitMessage(swiftSocket, opSubmit("Thread-A", "from swift"));
    eventPublisher.publish({
      type: "permission.requested",
      requestId: "Thread-A:permission-1",
      threadId: "Thread-A",
      timestamp: "2026-06-11T00:00:00.000Z",
      payload: {
        toolName: "file.write",
        toolCallId: "tool-1",
        arguments: { path: "a.txt" },
      },
    });

    const request = lastSent<ServerRequest>(socket);
    expect(request).toMatchObject({
      type: "permission.requested",
      requestId: "Thread-A:permission-1",
      threadId: "Thread-A",
    });
    expect(lastSent<ServerRequest>(swiftSocket)).toBeNull();
  });


  it("ignores non-object and malformed thread socket frames", async () => {
    const socket = new FakeSocket();
    const { commandRouter, eventPublisher } = makeHandlerDependencies();

    attachThreadSocketHandlers(socket as never, {
      commandRouter,
      eventPublisher,
    });

    await emitRawMessage(socket, "null");
    await emitRawMessage(socket, '"thread.start"');
    await emitRawMessage(socket, "true");
    await emitRawMessage(socket, "{not json");

    expect(commandRouter.receive).not.toHaveBeenCalled();
    expect(commandRouter.handleResponse).not.toHaveBeenCalled();

    await emitMessage(socket, opSubmit("Thread-A", "after bad frames"));

    expect(commandRouter.receive).toHaveBeenCalledTimes(1);
  });

  it("ignores thread commands with missing payload shape", async () => {
    const socket = new FakeSocket();
    const { commandRouter, eventPublisher } = makeHandlerDependencies();

    attachThreadSocketHandlers(socket as never, {
      commandRouter,
      eventPublisher,
    });

    await emitRawMessage(socket, JSON.stringify({
      type: "op.submit",
      threadId: "Thread-A",
      commandId: "bad-op",
      timestamp: new Date().toISOString(),
    }));

    expect(commandRouter.receive).not.toHaveBeenCalled();
  });

});

describe("attachActivitySocketHandlers", () => {
  it("sends a snapshot on activity socket attach and removes subscriber on close", () => {
    const socket = new FakeSocket();
    const publisher = new AgentActivityPublisher(() => "2026-06-08T00:00:00.000Z");

    attachActivitySocketHandlers(socket as never, { activityPublisher: publisher });

    expect(lastSent<AgentActivityEvent>(socket)).toEqual({
      channel: "activity",
      type: "activity.snapshot",
      activeThreadId: null,
      status: "idle",
      latestSummary: null,
      waitingRequest: null,
      error: null,
      updatedAt: "2026-06-08T00:00:00.000Z",
    });

    socket.emit("close");
    publisher.observe({
      type: "turn.started",
      threadId: "thread-1",
      notificationId: "n1",
      turnId: "turn-1",
      timestamp: "2026-06-08T00:00:00.000Z",
      payload: {},
    });

    expect(socket.sent).toHaveLength(1);
  });
});

describe("startServer", () => {
  it.each(["/api/unknown", "/"])(
    "closes sockets on %s without attaching thread or platform handlers",
    async (path) => {
      const commandRouter = {
        receive: vi.fn(async () => {}),
        interruptThread: vi.fn(),
        handleResponse: vi.fn(),
      } as unknown as ThreadCommandRouter;
      const eventPublisher = {
        attachConnection: vi.fn(),
        detachConnection: vi.fn(),
        subscribe: vi.fn(),
        publishToConnection: vi.fn(),
      } as unknown as ThreadNotificationPublisher;
      const bridge = {
        attach: vi.fn(),
        detach: vi.fn(),
        handleResponse: vi.fn(),
      };
      const server = await startServer({
        commandRouter,
        eventPublisher,
        bridge: bridge as never,
        port: 0,
      });
      const address = server.address() as AddressInfo;
      const socket = new WebSocket(`ws://127.0.0.1:${address.port}${path}`);

      try {
        const outcome = await new Promise<"open" | "error">((resolve) => {
          socket.once("open", () => resolve("open"));
          socket.once("error", () => resolve("error"));
        });

        expect(outcome).toBe("error");
        expect(eventPublisher.attachConnection).not.toHaveBeenCalled();
        expect(commandRouter.receive).not.toHaveBeenCalled();
        expect(bridge.attach).not.toHaveBeenCalled();
      } finally {
        if (
          socket.readyState === WebSocket.OPEN ||
          socket.readyState === WebSocket.CONNECTING
        ) {
          socket.terminate();
        }
        server.close();
        await once(server, "close");
      }
    },
  );

  it("serves thread-window static assets over HTTP on the same port", async () => {
    const staticDir = await mkdtemp(join(tmpdir(), "handagent-thread-window-web-"));
    await writeFile(
      join(staticDir, "index.html"),
      "<!doctype html><html><body>thread-window</body></html>",
    );
    await writeFile(join(staticDir, "app.js"), "console.log('ok');");

    const commandRouter = {
      receive: vi.fn(async () => {}),
      interruptThread: vi.fn(),
      handleResponse: vi.fn(),
    } as unknown as ThreadCommandRouter;
    const eventPublisher = {
      attachConnection: vi.fn(),
      detachConnection: vi.fn(),
      subscribe: vi.fn(),
      publishToConnection: vi.fn(),
    } as unknown as ThreadNotificationPublisher;
    const server = await startServer({
      commandRouter,
      eventPublisher,
      staticFilesDir: staticDir,
      port: 0,
    });
    const address = server.address() as AddressInfo;

    try {
      const indexResponse = await fetch(`http://127.0.0.1:${address.port}/thread-window/index.html`);
      expect(indexResponse.status).toBe(200);
      expect(indexResponse.headers.get("content-type")).toContain("text/html");
      expect(await indexResponse.text()).toContain("thread-window");

      const assetResponse = await fetch(`http://127.0.0.1:${address.port}/thread-window/app.js`);
      expect(assetResponse.status).toBe(200);
      expect(assetResponse.headers.get("content-type")).toContain("javascript");
      expect(await assetResponse.text()).toContain("console.log");

      const missingResponse = await fetch(`http://127.0.0.1:${address.port}/thread-window/missing.js`);
      expect(missingResponse.status).toBe(404);
    } finally {
      server.close();
      await once(server, "close");
      await rm(staticDir, { recursive: true, force: true });
    }
  });

  it("routes /api/activity websocket clients to the activity publisher", async () => {
    const activityPublisher = new AgentActivityPublisher(() => "2026-06-08T00:00:00.000Z");
    const server = await startServer({
      ...makeHandlerDependencies(),
      activityPublisher,
      port: 0,
    });
    const address = server.address() as AddressInfo;
    const socket = new WebSocket(`ws://127.0.0.1:${address.port}/api/activity`);

    try {
      const [raw] = await once(socket, "message");
      const snapshot = JSON.parse(raw.toString()) as AgentActivityEvent;
      expect(snapshot.type).toBe("activity.snapshot");
    } finally {
      socket.close();
      server.close();
      await once(server, "close");
    }
  });

  it("closes /api/activity clients when no activity publisher is configured", async () => {
    const commandRouter = {
      receive: vi.fn(async () => {}),
      interruptThread: vi.fn(),
      handleResponse: vi.fn(),
    } as unknown as ThreadCommandRouter;
    const eventPublisher = {
      attachConnection: vi.fn(),
      detachConnection: vi.fn(),
      subscribe: vi.fn(),
      publishToConnection: vi.fn(),
    } as unknown as ThreadNotificationPublisher;
    const bridge = {
      attach: vi.fn(),
      detach: vi.fn(),
      handleResponse: vi.fn(),
    };
    const server = await startServer({
      commandRouter,
      eventPublisher,
      bridge: bridge as never,
      port: 0,
    });
    const address = server.address() as AddressInfo;
    const socket = new WebSocket(`ws://127.0.0.1:${address.port}/api/activity`);

    try {
      const opened = await new Promise<boolean>((resolve) => {
        socket.once("open", () => resolve(true));
        socket.once("error", () => resolve(false));
      });
      expect(opened).toBe(true);
      await expect(waitForClose(socket)).resolves.toBe(true);
      expect(eventPublisher.attachConnection).not.toHaveBeenCalled();
      expect(commandRouter.receive).not.toHaveBeenCalled();
      expect(bridge.attach).not.toHaveBeenCalled();
    } finally {
      if (
        socket.readyState === WebSocket.OPEN ||
        socket.readyState === WebSocket.CONNECTING
      ) {
        socket.terminate();
      }
      server.close();
      await once(server, "close");
    }
  });
});

describe("resolveLLMMode", () => {
  it("uses mock mode only when HANDAGENT_LLM_MODE is explicitly mock", () => {
    expect(resolveLLMMode({})).toBe("settings");
    expect(resolveLLMMode({ HANDAGENT_LLM_MODE: "settings" })).toBe("settings");
    expect(resolveLLMMode({ HANDAGENT_LLM_MODE: "mock" })).toBe("mock");
  });
});

describe("createMCPClientFromConfig", () => {
  it("routes stdio MCP config to the stdio client", () => {
    const StdioMCPClient = vi.fn(() => makeNoopMCPClient("stdio"));
    const StreamableHttpMCPClient = vi.fn(() => makeNoopMCPClient("http"));

    const client = createMCPClientFromConfig(
      {
        id: "computer_use",
        title: "Computer Use",
        transport: "stdio",
        command: "./Codex Computer Use.app/Contents/SharedSupport/SkyComputerUseClient.app/Contents/MacOS/SkyComputerUseClient",
        args: ["mcp"],
      },
      {
        StdioMCPClient: StdioMCPClient as never,
        StreamableHttpMCPClient: StreamableHttpMCPClient as never,
      },
    );

    expect(client.serverInfo()?.name).toBe("stdio");
    expect(StdioMCPClient).toHaveBeenCalledWith({
      id: "computer_use",
      title: "Computer Use",
      transport: "stdio",
      command: "./Codex Computer Use.app/Contents/SharedSupport/SkyComputerUseClient.app/Contents/MacOS/SkyComputerUseClient",
      args: ["mcp"],
    });
    expect(StreamableHttpMCPClient).not.toHaveBeenCalled();
  });
});

function makeNoopMCPClient(name: string): MCPClient {
  const info = {
    name,
    version: "test",
    protocolVersion: "2025-11-25",
    capabilities: {},
  };
  return {
    async initialize() {
      return info;
    },
    serverInfo() {
      return info;
    },
    async listTools() {
      return [];
    },
    async callTool() {
      return { content: [] };
    },
    async listPrompts() {
      return [];
    },
    async getPrompt() {
      return { messages: [] };
    },
    async listResources() {
      return [];
    },
    async readResource() {
      return { contents: [] };
    },
    async close() {},
  };
}

function testStore(): ThreadStore {
  return new ThreadStore({ dbPath: ":memory:" });
}
