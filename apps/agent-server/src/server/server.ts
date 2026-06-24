import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { extname, join, resolve } from "node:path";
import { homedir } from "node:os";
import { z } from "zod";
import { contentType } from "mime-types";
import type { DynamicToolProviderMessage } from "@handagent/core/protocol/DynamicTool.ts";
import type { ThreadCommand } from "@handagent/core/protocol/ThreadCommand.ts";
import type { ClientResponse } from "@handagent/core/protocol/ClientResponse.ts";
import type { ServerRequest } from "@handagent/core/protocol/ServerRequest.ts";
import type { ThreadNotification } from "@handagent/core/protocol/ThreadNotification.ts";
import type { AgentActivityEvent } from "@handagent/core/protocol/AgentActivity.ts";
import type { AgentEvent } from "@handagent/core/protocol/AgentEvent.ts";
import type { AgentTriggerFireRequest } from "@handagent/core/protocol/AgentTrigger.ts";
import type { AgentTriggerAttention } from "@handagent/core/protocol/AgentTriggerAttention.ts";
import type { Op } from "@handagent/core/protocol/Op.ts";
import type { MCPClient } from "@handagent/core/mcp/MCPClient.ts";
import type { MCPServerConfig, StdioMCPServerConfig, StreamableHttpMCPServerConfig } from "@handagent/core/mcp/MCPConfig.ts";
import { parseMCPConfig } from "@handagent/core/mcp/MCPConfig.ts";
import type { AgentMessage } from "@handagent/core/runtime/AgentMessage.ts";
import { META_TOOL_NAME } from "@handagent/core/tools/MetaToolUseTool.ts";
import { isNotFoundError } from "@handagent/core/utils/nodeErrors.ts";
import { ThreadPersistence } from "../thread/ThreadPersistence.ts";
import {
  AgentManager,
  createSharedAgentStatus,
  type Agent,
} from "../agent/AgentManager.ts";
import { AgentActivityPublisher } from "../activity/AgentActivityPublisher.ts";
import { AgentTriggerAttentionPublisher } from "../thread/AgentTriggerAttentionPublisher.ts";
import { AgentTriggerLaunchService } from "../thread/AgentTriggerLaunchService.ts";
import { ThreadCommandRouter } from "../thread/ThreadCommandRouter.ts";
import { ThreadNotificationPublisher } from "../thread/ThreadNotificationPublisher.ts";
import { ThreadRuntimeOrchestrator } from "../thread/ThreadRuntimeOrchestrator.ts";
import { ThreadStore } from "@handagent/thread-store/index.ts";
import { WebSocketDynamicToolBridge } from "../bridges/WebSocketDynamicToolBridge.ts";
import type { FilePermissionPolicy } from "@handagent/core/permission/FilePermissionPolicy.ts";
import { AgentEventQueue } from "../agent/AgentEventQueue.ts";
import { AgentRequestBroker } from "../agent/AgentRequestBroker.ts";

type ThreadSocket = {
  send(data: string): void;
  on(event: "message", listener: (raw: { toString(): string }) => void): void;
  on(event: "close", listener: () => void): void;
};

let nextConnectionId = 0;

export function attachThreadSocketHandlers(
  socket: ThreadSocket,
  {
    commandRouter,
    eventPublisher,
    permissionPolicy,
    acceptServerRequests = false,
  }: {
    commandRouter: ThreadCommandRouter;
    eventPublisher: ThreadNotificationPublisher;
    permissionPolicy?: FilePermissionPolicy;
    acceptServerRequests?: boolean;
  },
): void {
  const connectionId = `connection-${++nextConnectionId}`;
  const boundThreads = new Set<string>();
  const sendPublished = (outgoing: ThreadNotification | ServerRequest) => {
    socket.send(JSON.stringify(outgoing));
  };
  eventPublisher?.attachConnection(connectionId, sendPublished);
  if (acceptServerRequests) {
    eventPublisher.acceptServerRequests(connectionId);
  }

  socket.on("message", async (raw) => {
    const message = parseSocketMessage(raw);

    if (isClientResponse(message)) {
      await commandRouter.handleResponse(message, connectionId);
      return;
    }

    if (isThreadCommand(message)) {
      if ("threadId" in message && typeof message.threadId === "string") {
        eventPublisher.subscribe(connectionId, message.threadId);
      }

      if ("threadId" in message && typeof message.threadId === "string") {
        boundThreads.add(message.threadId);
      }

      await commandRouter.receive(message, connectionId);
      return;
    }
  });

  socket.on("close", () => {
    eventPublisher.detachConnection(connectionId);
    for (const threadId of boundThreads) {
      void Promise.resolve(commandRouter.interruptThread(threadId)).catch(() => {});
      clearThreadPermissionRules(permissionPolicy, threadId);
    }
    boundThreads.clear();
  });
}

export function attachDynamicToolSocketHandlers(
  socket: ThreadSocket,
  {
    bridge,
  }: {
    bridge?: WebSocketDynamicToolBridge;
  },
): void {
  let providerToken: number | null = null;
  const sendDynamicToolMessage = (outgoing: DynamicToolProviderMessage) => {
    socket.send(JSON.stringify(outgoing));
  };

  socket.on("message", (raw) => {
    const message = parseSocketMessage(raw);
    if (!isDynamicToolProviderMessage(message)) {
      return;
    }

    if (message.type === "provider_hello" && bridge) {
      providerToken = bridge.attach(message.clientId, sendDynamicToolMessage);
    } else if (message.type === "tool_call_response") {
      bridge?.handleResponse(message.payload, providerToken);
    }
  });

  socket.on("close", () => {
    if (providerToken !== null && bridge) {
      bridge.detach(providerToken);
    }
  });
}

export function attachActivitySocketHandlers(
  socket: ThreadSocket,
  {
    activityPublisher,
  }: {
    activityPublisher: AgentActivityPublisher;
  },
): void {
  const connectionId = `activity-${++nextConnectionId}`;
  const sendActivity = (outgoing: AgentActivityEvent) => {
    socket.send(JSON.stringify(outgoing));
  };

  activityPublisher.attachConnection(connectionId, sendActivity);

  socket.on("close", () => {
    activityPublisher.detachConnection(connectionId);
  });
}

export function attachAgentTriggerAttentionSocketHandlers(
  socket: ThreadSocket,
  {
    attentionPublisher,
  }: {
    attentionPublisher: AgentTriggerAttentionPublisher;
  },
): void {
  const connectionId = `agent-trigger-attention-${++nextConnectionId}`;
  attentionPublisher.attachConnection(connectionId, (outgoing) => {
    socket.send(JSON.stringify(outgoing));
  });
  socket.on("close", () => {
    attentionPublisher.detachConnection(connectionId);
  });
}

function isDynamicToolProviderMessage(
  message: unknown,
): message is DynamicToolProviderMessage {
  return DynamicToolProviderMessageSchema.safeParse(message).success;
}

function isThreadCommand(message: unknown): message is ThreadCommand {
  return ThreadCommandSchema.safeParse(message).success;
}

function isClientResponse(message: unknown): message is ClientResponse {
  return ClientResponseSchema.safeParse(message).success;
}

function parseSocketMessage(raw: { toString(): string }): unknown {
  try {
    return JSON.parse(raw.toString()) as unknown;
  } catch {
    return undefined;
  }
}

const InputItemSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("text"),
    id: z.string(),
    text: z.string(),
  }),
  z.object({
    type: z.literal("text_selection"),
    id: z.string(),
    text: z.string(),
  }),
  z.object({
    type: z.literal("image"),
    id: z.string(),
    mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]),
    base64: z.string(),
  }),
  z.object({
    type: z.literal("skill"),
    id: z.string(),
    actionId: z.string(),
    title: z.string(),
    prompt: z.string(),
  }),
]);

const UserInputOpSchema = z.object({
  type: z.literal("user_input"),
  opId: z.string(),
  timestamp: z.string(),
  payload: z.object({
    items: z.array(InputItemSchema).min(1),
  }),
});

const InterruptOpSchema = z.object({
  type: z.literal("interrupt"),
  opId: z.string(),
  timestamp: z.string(),
  payload: z.object({
    reason: z.enum(["user", "system"]),
  }),
});

const RuntimeOpSchema = z.discriminatedUnion("type", [UserInputOpSchema, InterruptOpSchema]);

const DynamicToolIdentifierSchema = z
  .string()
  .min(1)
  .regex(/^[A-Za-z0-9_-]+$/);

const DynamicToolSpecSchema = z.object({
  clientId: z.string().min(1),
  namespace: DynamicToolIdentifierSchema.optional(),
  name: DynamicToolIdentifierSchema,
  description: z.string().min(1),
  inputSchema: z.record(z.string(), z.unknown()),
  deferLoading: z.boolean().optional(),
});

const DynamicToolsSchema = z.array(DynamicToolSpecSchema).superRefine((tools, ctx) => {
  const seen = new Set<string>();
  for (const [index, tool] of tools.entries()) {
    if (tool.namespace === "mcp" || tool.namespace === "use_tools") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [index, "namespace"],
        message: `Reserved dynamic tool namespace: ${tool.namespace}`,
      });
    }

    const key = `${tool.namespace ?? ""}/${tool.name}`;
    if (seen.has(key)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [index, "name"],
        message: `Duplicate dynamic tool: ${tool.namespace ? `${tool.namespace}.` : ""}${tool.name}`,
      });
    }
    seen.add(key);
  }
});

const AgentTriggerFireRequestSchema = z.object({
  triggerInstanceId: z.string(),
  threadTitleHint: z.string().nullable(),
  userInput: z.object({
    items: z.array(InputItemSchema).min(1),
  }),
  notificationPolicy: z.object({
    mode: z.enum(["silent", "on_failure", "on_attention"]),
  }),
  sourceEvent: z.object({
    triggerInstanceId: z.string(),
    providerKind: z.string(),
    occurredAt: z.string(),
    summary: z.string(),
    payload: z.record(z.string(), z.unknown()),
  }),
}) satisfies z.ZodType<AgentTriggerFireRequest>;

const ThreadCommandSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("thread.start"),
    commandId: z.string(),
    timestamp: z.string(),
    payload: z.object({
      workspaceId: z.string().nullable(),
      dynamicTools: DynamicToolsSchema.optional(),
    }),
  }),
  z.object({
    type: z.literal("thread.resume"),
    threadId: z.string(),
    commandId: z.string(),
    timestamp: z.string(),
  }),
  z.object({
    type: z.literal("thread.list"),
    commandId: z.string(),
    timestamp: z.string(),
  }),
  z.object({
    type: z.literal("thread.delete"),
    commandId: z.string(),
    timestamp: z.string(),
    payload: z.object({ targetThreadId: z.string() }),
  }),
  z.object({
    type: z.literal("op.submit"),
    threadId: z.string(),
    commandId: z.string(),
    timestamp: z.string(),
    payload: z.object({ op: RuntimeOpSchema }),
  }),
  z.object({
    type: z.literal("workspace.list"),
    commandId: z.string(),
    timestamp: z.string(),
  }),
]) satisfies z.ZodType<ThreadCommand>;

const ClientResponseSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("permission.answered"),
    requestId: z.string(),
    timestamp: z.string(),
    payload: z.object({
      decision: z.enum(["allow", "deny"]),
      scope: z.enum(["once", "thread", "always"]).optional(),
      reason: z.string().optional(),
    }),
  }),
  z.object({
    type: z.literal("workspace.answered"),
    requestId: z.string(),
    timestamp: z.string(),
    payload: z.object({
      workspaceId: z.string().optional(),
      cancelled: z.boolean().optional(),
    }),
  }),
]) satisfies z.ZodType<ClientResponse>;

const DynamicToolResponseContentItemSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("inputText"),
    text: z.string(),
  }),
  z.object({
    type: z.literal("inputImage"),
    imageUrl: z.string(),
  }),
]);

const DynamicToolProviderMessageSchema = z.discriminatedUnion("type", [
  z.object({
    channel: z.literal("dynamic_tools"),
    type: z.literal("provider_hello"),
    clientId: z.string().min(1),
    tools: DynamicToolsSchema,
  }),
  z.object({
    channel: z.literal("dynamic_tools"),
    type: z.literal("tool_call_request"),
    payload: z.object({
      clientId: z.string().min(1),
      threadId: z.string(),
      turnId: z.string(),
      callId: z.string(),
      namespace: DynamicToolIdentifierSchema.optional(),
      tool: DynamicToolIdentifierSchema,
      arguments: z.unknown(),
    }),
  }),
  z.object({
    channel: z.literal("dynamic_tools"),
    type: z.literal("tool_call_response"),
    payload: z.object({
      callId: z.string(),
      success: z.boolean(),
      contentItems: z.array(DynamicToolResponseContentItemSchema),
    }),
  }),
]) satisfies z.ZodType<DynamicToolProviderMessage>;

export async function startServer({
  commandRouter,
  eventPublisher,
  activityPublisher,
  agentTriggerAttentionPublisher,
  agentTriggerLaunchService,
  dynamicToolBridge,
  permissionPolicy,
  staticFilesDir,
  port = 4317,
}: {
  commandRouter: ThreadCommandRouter;
  eventPublisher: ThreadNotificationPublisher;
  activityPublisher?: AgentActivityPublisher;
  agentTriggerAttentionPublisher?: AgentTriggerAttentionPublisher;
  agentTriggerLaunchService?: AgentTriggerLaunchService;
  dynamicToolBridge?: WebSocketDynamicToolBridge;
  permissionPolicy?: FilePermissionPolicy;
  staticFilesDir?: string;
  port?: number;
}) {
  const { createServer } = await import("node:http");
  const { WebSocketServer } = await import("ws");
  const threadWebSocketServer = new WebSocketServer({ noServer: true });
  const dynamicToolWebSocketServer = new WebSocketServer({ noServer: true });
  const activityWebSocketServer = new WebSocketServer({ noServer: true });
  const agentTriggerAttentionWebSocketServer = new WebSocketServer({ noServer: true });
  const server = createServer((request, response) => {
    void handleHTTPRequest(request, response, {
      staticFilesDir,
      agentTriggerLaunchService,
    });
  });

  threadWebSocketServer.on("connection", (socket, request) => {
    attachThreadSocketHandlers(socket, {
      commandRouter,
      eventPublisher,
      permissionPolicy,
      acceptServerRequests: request.url?.includes("acceptServerRequests=1") ?? false,
    });
  });

  dynamicToolWebSocketServer.on("connection", (socket) => {
    attachDynamicToolSocketHandlers(socket, { bridge: dynamicToolBridge });
  });

  activityWebSocketServer.on("connection", (socket) => {
    if (!activityPublisher) {
      socket.close();
      return;
    }
    attachActivitySocketHandlers(socket, { activityPublisher });
  });

  agentTriggerAttentionWebSocketServer.on("connection", (socket) => {
    if (!agentTriggerAttentionPublisher) {
      socket.close();
      return;
    }
    attachAgentTriggerAttentionSocketHandlers(socket, {
      attentionPublisher: agentTriggerAttentionPublisher,
    });
  });

  server.on("upgrade", (request, socket, head) => {
    const path = request.url?.split("?")[0];
    if (path === "/api/activity") {
      activityWebSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
        activityWebSocketServer.emit("connection", webSocket, request);
      });
      return;
    }

    if (path === "/api/agent-trigger/attention") {
      agentTriggerAttentionWebSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
        agentTriggerAttentionWebSocketServer.emit("connection", webSocket, request);
      });
      return;
    }

    if (path === "/api/dynamic-tools") {
      dynamicToolWebSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
        dynamicToolWebSocketServer.emit("connection", webSocket, request);
      });
      return;
    }

    if (path === "/api/thread") {
      threadWebSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
        threadWebSocketServer.emit("connection", webSocket, request);
      });
      return;
    }

    socket.destroy();
  });

  await new Promise<void>((resolveStart, rejectStart) => {
    const onError = (error: Error) => {
      server.off("listening", onListening);
      rejectStart(error);
    };
    const onListening = () => {
      server.off("error", onError);
      resolveStart();
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, "127.0.0.1");
  });

  return server;
}

export async function startDefaultServer(port = 4317) {
  const [
    { AgentRuntime },
    { FileWorkspaceRegistry },
    { FilePermissionPolicy },
    { SettingsBackedLLMClient },
    { SettingsBackedToolRegistry },
    { ThreadScopedToolRegistry },
    { MCPServerRegistry },
    { StdioMCPClient },
    { StreamableHttpMCPClient },
    { FileNetworkLogger },
    { FilesystemBlobStore },
    { TurnSummarizer },
    { MockLLMClient },
  ] = await Promise.all([
    import("@handagent/core/runtime/AgentRuntime.ts"),
    import("@handagent/core/workspace/FileWorkspaceRegistry.ts"),
    import("@handagent/core/permission/FilePermissionPolicy.ts"),
    import("../settings/SettingsBackedLLMClient.ts"),
    import("../settings/SettingsBackedToolRegistry.ts"),
    import("../actions/ThreadScopedToolRegistry.ts"),
    import("../actions/MCPServerRegistry.ts"),
    import("@handagent/core/mcp/StdioMCPClient.ts"),
    import("@handagent/core/mcp/StreamableHttpMCPClient.ts"),
    import("@handagent/core/logging/FileNetworkLogger.ts"),
    import("@handagent/core/blob/FilesystemBlobStore.ts"),
    import("@handagent/core/runtime/TurnSummarizer.ts"),
    import("@handagent/core/llm/MockLLMClient.ts"),
  ]);

  const paths = resolveServerPaths();
  const store = new ThreadStore({ dbPath: paths.threadsDbPath });
  const networkLogger = new FileNetworkLogger({ baseDir: paths.logDir });
  const blobStore = new FilesystemBlobStore({ rootPath: paths.blobsDir });
  const mcpConfig = await readMCPConfig(paths.mcpConfigPath);
  const mcpServers = new Map(mcpConfig.servers.map((server) => [server.id, server]));

  const workspaceRegistry = new FileWorkspaceRegistry({
    filePath: paths.workspacesPath,
    defaultRootPath: paths.defaultWorkspaceDir,
  });
  await workspaceRegistry.getDefault();

  const dynamicToolBridge = new WebSocketDynamicToolBridge();
  const requestBroker = new AgentRequestBroker();
  const toolRegistry = new SettingsBackedToolRegistry({
    workspaceRegistry,
    workspaceAskResolver: requestBroker.askWorkspace,
  });
  await toolRegistry.refresh();
  const llmMode = resolveLLMMode();

  const mcpRegistry = new MCPServerRegistry({
    createClient: (serverId: string) => {
      const config = mcpServers.get(serverId);
      if (!config) {
        throw new Error(`Unknown MCP server: ${serverId}`);
      }
      return createMCPClientFromConfig(config, {
        StdioMCPClient,
        StreamableHttpMCPClient,
      });
    },
  });
  const globalMcpServerIds = [...mcpServers.keys()];
  const threadScopedTools = new ThreadScopedToolRegistry(
    {
      builtinRegistry: toolRegistry.registry,
      globalMcpServerIds,
      listMcpTools: (serverId: string) => mcpRegistry.listTools(serverId),
      dynamicToolBridge,
      exposeBuiltinToolsBeforeActivation: llmMode === "mock",
    },
    {
      log: (message: string) => console.warn(message),
    },
  );

  const permissionPolicy = new FilePermissionPolicy({
    filePath: paths.permissionsPath,
    askResolver: requestBroker.askPermission,
  });

  const llmClient = llmMode === "mock"
    ? new MockLLMClient()
    : new SettingsBackedLLMClient({ networkLogger });
  const summarizer = llmMode === "mock"
    ? undefined
    : new TurnSummarizer({
        client: new SettingsBackedLLMClient({ networkLogger, purpose: "summarizer" }),
      blobStore,
    });
  console.log(`[agent-server] llm mode: ${llmMode}`);

  const runtimeByThread = new Map<string, InstanceType<typeof AgentRuntime>>();
  const runtimeForThread = (threadId: string) => {
    let runtime = runtimeByThread.get(threadId);
    if (!runtime) {
      runtime = new AgentRuntime(llmClient, threadScopedTools.registryForThread(threadId), {
        permissionPolicy,
        blobStore,
        turnSummarizer: summarizer,
        onMetaToolActivate: async (activeThreadId) => {
          await threadScopedTools.activate(activeThreadId);
        },
        isThreadActivated: (activeThreadId) => threadScopedTools.isActivated(activeThreadId),
      });
      runtimeByThread.set(threadId, runtime);
    }
    return runtime;
  };
  const persistence = new ThreadPersistence(store, undefined, blobStore);
  const orchestrator = new ThreadRuntimeOrchestrator(
    runtimeForThread,
    persistence,
    undefined,
    async (threadId) => {
      await toolRegistry.refresh();
      const thread = await persistence.getThread(threadId);
      threadScopedTools.setDynamicTools(threadId, thread?.metadata.dynamicTools ?? []);

      if (!threadScopedTools.isActivated(threadId)) {
        const history = await persistence.getMessages(threadId);
        if (historyShowsToolsActivated(history)) {
          await threadScopedTools.activate(threadId);
        }
      }

      await threadScopedTools.refreshForThread(threadId);
    },
  );
  const activityPublisher = new AgentActivityPublisher();
  const agentTriggerAttentionPublisher = new AgentTriggerAttentionPublisher();
  const eventPublisher = new ThreadNotificationPublisher((event) => {
    activityPublisher.observe(event);
    agentTriggerAttentionPublisher.observe(event);
  });
  const agentManager = new AgentManager();
  const createAgent = (threadId: string): Agent => {
    const agentStatus = createSharedAgentStatus();
    const eventQueue = new AgentEventQueue<AgentEvent>();
    const pumpDone = pumpAgentEvents(eventQueue, eventPublisher, agentStatus);
    const publishRuntimeEvent = (event: ThreadNotification) => {
      eventQueue.push(wrapThreadNotificationEvent(event));
    };
    requestBroker.bindThread(threadId, (event) => eventQueue.push(event));

    return {
      tx_sub: {
        async send(op: Op) {
          if (op.type === "client_response") {
            requestBroker.handleOp(op);
            return;
          }

          if (op.type === "interrupt") {
            requestBroker.cancelPendingForThread(threadId);
            await orchestrator.interruptAndWait(threadId, publishRuntimeEvent);
            return;
          }

          await orchestrator.submitInput(
            {
              threadId,
              messageId: op.opId,
              timestamp: op.timestamp,
              payload: op.payload,
            },
            publishRuntimeEvent,
          );
        },
      },
      rx_event: eventQueue,
      agent_status: agentStatus,
      session: { threadId },
      async close() {
        requestBroker.cancelPendingForThread(threadId);
        await orchestrator.interruptAndWait(threadId, publishRuntimeEvent);
        requestBroker.unbindThread(threadId);
        eventQueue.close();
        await pumpDone;
      },
    };
  };
  const commandRouter = new ThreadCommandRouter(
    agentManager,
    persistence,
    eventPublisher,
    undefined,
    (threadId) => {
      threadScopedTools.forgetThread(threadId);
      runtimeByThread.delete(threadId);
    },
    {},
    workspaceRegistry,
    createAgent,
    (threadId, dynamicTools) => {
      threadScopedTools.setDynamicTools(threadId, dynamicTools);
    },
  );
  const agentTriggerLaunchService = new AgentTriggerLaunchService(
    persistence,
    agentManager,
    createAgent,
    eventPublisher,
    agentTriggerAttentionPublisher,
    () => new Date().toISOString(),
    {
      onThreadDynamicTools: (threadId, dynamicTools) => {
        threadScopedTools.setDynamicTools(threadId, dynamicTools);
      },
    },
  );

  return startServer({
    commandRouter,
    eventPublisher,
    activityPublisher,
    agentTriggerAttentionPublisher,
    agentTriggerLaunchService,
    dynamicToolBridge,
    permissionPolicy,
    staticFilesDir: resolveThreadWindowWebDistDir(),
    port,
  });
}

async function pumpAgentEvents(
  events: AsyncIterable<AgentEvent>,
  publisher: ThreadNotificationPublisher,
  agentStatus: ReturnType<typeof createSharedAgentStatus>,
): Promise<void> {
  for await (const event of events) {
    switch (event.type) {
      case "thread.notification":
        observeAgentStatus(agentStatus, event.payload);
        publisher.publish(event.payload);
        break;
      case "server.request":
        publisher.publish(event.payload);
        break;
    }
  }
}

function wrapThreadNotificationEvent(event: ThreadNotification): AgentEvent {
  return {
    type: "thread.notification",
    eventId: `agent-event-${event.notificationId}`,
    ...("threadId" in event ? { threadId: event.threadId } : {}),
    timestamp: event.timestamp,
    payload: event,
  };
}

function observeAgentStatus(
  agentStatus: ReturnType<typeof createSharedAgentStatus>,
  event: ThreadNotification,
): void {
  if (event.type === "turn.started") {
    agentStatus.set("running");
    return;
  }

  if (event.type === "turn.completed") {
    agentStatus.set(event.payload.status === "completed" ? "idle" : event.payload.status);
    return;
  }

  if (event.type === "thread.status.changed") {
    agentStatus.set(event.payload.value);
  }
}

interface ServerPaths {
  spotDir: string;
  threadsDbPath: string;
  logDir: string;
  blobsDir: string;
  workspacesPath: string;
  defaultWorkspaceDir: string;
  mcpConfigPath: string;
  permissionsPath: string;
}

function resolveServerPaths(): ServerPaths {
  const spotDir = join(homedir(), ".spotAgent");
  return {
    spotDir,
    threadsDbPath: join(spotDir, "threads.sqlite"),
    logDir: join(spotDir, "log"),
    blobsDir: join(spotDir, "blobs"),
    workspacesPath: join(spotDir, "workspaces.json"),
    defaultWorkspaceDir: join(spotDir, "workspace"),
    mcpConfigPath: join(spotDir, "mcp.json"),
    permissionsPath: join(spotDir, "permissions.json"),
  };
}

export type LLMMode = "settings" | "mock";

export async function readMCPConfig(filePath: string) {
  try {
    return parseMCPConfig(JSON.parse(await readFile(filePath, "utf8")));
  } catch (error) {
    if (isNotFoundError(error)) {
      return { version: 1 as const, servers: [] };
    }
    throw error;
  }
}

export function createMCPClientFromConfig(
  config: MCPServerConfig,
  clients: {
    StdioMCPClient: new (config: StdioMCPServerConfig) => MCPClient;
    StreamableHttpMCPClient: new (
      config: StreamableHttpMCPServerConfig,
    ) => MCPClient;
  },
): MCPClient {
  return config.transport === "stdio"
    ? new clients.StdioMCPClient(config)
    : new clients.StreamableHttpMCPClient(config);
}

export function resolveLLMMode(env: Record<string, string | undefined> = process.env): LLMMode {
  return env.HANDAGENT_LLM_MODE === "mock" ? "mock" : "settings";
}

function resolveThreadWindowWebDistDir(
  env: Record<string, string | undefined> = process.env,
  currentDirectory = process.cwd(),
): string {
  if (env.HANDAGENT_THREAD_WINDOW_WEB_DIST_DIR) {
    return env.HANDAGENT_THREAD_WINDOW_WEB_DIST_DIR;
  }
  return join(currentDirectory, "apps/thread-window-web/dist");
}

function historyShowsToolsActivated(messages: readonly AgentMessage[]): boolean {
  return messages.some((m) => m.role === "tool" && m.name === META_TOOL_NAME);
}

const THREAD_WINDOW_HTTP_PREFIX = "/thread-window";

async function handleHTTPRequest(
  request: {
    method?: string;
    url?: string;
    on(event: "data", listener: (chunk: Buffer) => void): void;
    on(event: "end", listener: () => void): void;
    on(event: "error", listener: (error: Error) => void): void;
  },
  response: {
    statusCode: number;
    setHeader(name: string, value: string): void;
    end(body?: string | Buffer): void;
  },
  options: {
    staticFilesDir?: string;
    agentTriggerLaunchService?: AgentTriggerLaunchService;
  },
): Promise<void> {
  const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
  if (request.method === "POST" && pathname === "/api/agent-trigger/fire") {
    await handleAgentTriggerFireRequest(request, response, options.agentTriggerLaunchService);
    return;
  }

  await handleStaticRequest(request.url ?? "/", response, options.staticFilesDir);
}

async function handleAgentTriggerFireRequest(
  request: {
    on(event: "data", listener: (chunk: Buffer) => void): void;
    on(event: "end", listener: () => void): void;
    on(event: "error", listener: (error: Error) => void): void;
  },
  response: {
    statusCode: number;
    setHeader(name: string, value: string): void;
    end(body?: string | Buffer): void;
  },
  launchService?: AgentTriggerLaunchService,
): Promise<void> {
  if (!launchService) {
    response.statusCode = 503;
    response.end("AgentTrigger launch service unavailable");
    return;
  }

  try {
    const rawBody = await readRequestBody(request);
    const parsedJSON = JSON.parse(rawBody) as unknown;
    const parsedRequest = AgentTriggerFireRequestSchema.safeParse(parsedJSON);
    if (!parsedRequest.success) {
      response.statusCode = 400;
      response.end("Invalid AgentTrigger fire request");
      return;
    }

    const result = await launchService.fire(parsedRequest.data);
    response.statusCode = 202;
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify(result));
  } catch (error) {
    response.statusCode = 500;
    response.end(error instanceof Error ? error.message : "Unknown error");
  }
}

function readRequestBody(request: {
  on(event: "data", listener: (chunk: Buffer) => void): void;
  on(event: "end", listener: () => void): void;
  on(event: "error", listener: (error: Error) => void): void;
}): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    request.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
    request.on("error", reject);
  });
}

async function handleStaticRequest(
  rawURL: string,
  response: {
    statusCode: number;
    setHeader(name: string, value: string): void;
    end(body?: string | Buffer): void;
  },
  staticFilesDir?: string,
): Promise<void> {
  if (!staticFilesDir) {
    response.statusCode = 404;
    response.end("Not Found");
    return;
  }

  const pathname = new URL(rawURL, "http://127.0.0.1").pathname;
  const relativePath = resolveThreadWindowRequestPath(pathname);
  if (!relativePath) {
    response.statusCode = 404;
    response.end("Not Found");
    return;
  }

  const rootDir = resolve(staticFilesDir);
  const targetPath = resolve(rootDir, relativePath);
  if (targetPath !== rootDir && !targetPath.startsWith(`${rootDir}/`)) {
    response.statusCode = 403;
    response.end("Forbidden");
    return;
  }

  try {
    const body = await readFile(targetPath);
    response.statusCode = 200;
    response.setHeader("Content-Type", contentType(extname(targetPath)) || "application/octet-stream");
    response.end(body);
  } catch (error) {
    if (isNotFoundError(error)) {
      response.statusCode = 404;
      response.end("Not Found");
      return;
    }
    response.statusCode = 500;
    response.end("Internal Server Error");
  }
}

function resolveThreadWindowRequestPath(pathname: string): string | null {
  if (pathname === THREAD_WINDOW_HTTP_PREFIX || pathname === `${THREAD_WINDOW_HTTP_PREFIX}/`) {
    return "index.html";
  }
  if (!pathname.startsWith(`${THREAD_WINDOW_HTTP_PREFIX}/`)) {
    return null;
  }
  const rawRelativePath = pathname.slice(THREAD_WINDOW_HTTP_PREFIX.length + 1);
  if (rawRelativePath.length === 0) {
    return "index.html";
  }
  return decodeURIComponent(rawRelativePath);
}


function clearThreadPermissionRules(
  permissionPolicy: FilePermissionPolicy | undefined,
  threadId: string,
): void {
  permissionPolicy?.clearThreadRules(threadId);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.stdin.resume();
  process.stdin.on("end", () => process.exit(0));
  await startDefaultServer();
}
