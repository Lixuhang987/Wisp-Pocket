import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { extname, join, resolve } from "node:path";
import { homedir } from "node:os";
import { z } from "zod";
import { contentType } from "mime-types";
import type { DynamicToolProviderMessage } from "@handagent/core/protocol/types/DynamicTool.ts";
import type { ThreadCommand } from "@handagent/core/protocol/types/ThreadCommand.ts";
import type { ClientResponse } from "@handagent/core/protocol/types/ClientResponse.ts";
import type { ServerRequest } from "@handagent/core/protocol/types/ServerRequest.ts";
import type { ThreadNotification } from "@handagent/core/protocol/types/ThreadNotification.ts";
import type { AgentActivityEvent } from "@handagent/core/protocol/types/AgentActivity.ts";
import type { AgentEvent } from "@handagent/core/protocol/types/AgentEvent.ts";
import type { Op } from "@handagent/core/protocol/types/Op.ts";
import type { MCPClient } from "@handagent/core/mcp/MCPClient.ts";
import type { MCPServerConfig, StdioMCPServerConfig, StreamableHttpMCPServerConfig } from "@handagent/core/mcp/MCPConfig.ts";
import { parseMCPConfig } from "@handagent/core/mcp/MCPConfig.ts";
import type { AgentMessage } from "@handagent/core/runtime/types/AgentMessage.ts";
import type { BlobStore } from "@handagent/core/blob/types/BlobStore.ts";
import { META_TOOL_NAME } from "@handagent/core/tools/MetaToolUseTool.ts";
import { isNotFoundError } from "@handagent/core/utils/nodeErrors.ts";
import { ThreadPersistence } from "../thread/ThreadPersistence.ts";
import { createDefaultReadTools } from "../actions/DefaultReadTools.ts";
import { ThreadRegistry } from "@handagent/core/thread/ThreadRegistry.ts";
import { ThreadTools } from "@handagent/core/thread/ThreadTools.ts";
import * as projection from "../protocol/MessageTranslator.ts";
import { settleWithin } from "@handagent/core/thread/utils/settleWithin.ts";
import { AgentActivityPublisher } from "../activity/AgentActivityPublisher.ts";
import { ThreadCommandRouter } from "../thread/ThreadCommandRouter.ts";
import { ThreadNotificationPublisher } from "../thread/ThreadNotificationPublisher.ts";
import { ThreadStore } from "@handagent/thread-store/index.ts";
import { WebSocketDynamicToolBridge } from "../bridges/WebSocketDynamicToolBridge.ts";
import type { FilePermissionPolicy } from "@handagent/core/adapters/filesystem/FilePermissionPolicy.ts";

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
    acceptServerRequests = false,
    observeRequests = false,
  }: {
    commandRouter: ThreadCommandRouter;
    eventPublisher: ThreadNotificationPublisher;
    acceptServerRequests?: boolean;
    observeRequests?: boolean;
  },
): void {
  const connectionId = `connection-${++nextConnectionId}`;
  const sendPublished = (outgoing: ThreadNotification | ServerRequest) => {
    socket.send(JSON.stringify(outgoing));
  };
  eventPublisher?.attachConnection(connectionId, sendPublished);
  if (acceptServerRequests) {
    eventPublisher.acceptServerRequests(connectionId);
  }

  if (observeRequests) eventPublisher.observeRequests(connectionId);

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

      await commandRouter.receive(message, connectionId);
      return;
    }
    if (message && typeof message === "object" && "commandId" in message && typeof message.commandId === "string") {
      const petCommand = "type" in message && typeof message.type === "string" && message.type.startsWith("pet.");
      eventPublisher.publishToConnection(connectionId, {
        type: petCommand ? "pet.error" : "thread.error", notificationId: crypto.randomUUID(), commandId: message.commandId,
        timestamp: new Date().toISOString(), payload: {code:"invalid_input",message:"命令参数无效，请检查所属桌宠、必填字段及只读文件根。"},
      });
    }
  });

  socket.on("close", () => {
    eventPublisher.detachConnection(connectionId);

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
  let providerClientId: string | null = null;
  const sendDynamicToolMessage = (outgoing: DynamicToolProviderMessage) => {
    socket.send(JSON.stringify(outgoing));
  };

  socket.on("message", (raw) => {
    const message = parseSocketMessage(raw);
    if (!isDynamicToolProviderMessage(message)) {
      return;
    }

    if (message.type === "provider_hello" && bridge) {
      if (providerToken !== null && providerClientId === message.clientId) {
        bridge.updateTools(providerToken, message.tools);
        return;
      }
      if (providerToken !== null) {
        bridge.detach(providerToken);
      }
      providerToken = bridge.attach(message.clientId, sendDynamicToolMessage, message.tools);
      providerClientId = message.clientId;
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

const BinaryInputSourceSchema = z.union([
  z.object({ base64: z.string().max(40 * 1024 * 1024).regex(/^[A-Za-z0-9+/]*={0,2}$/), blobId: z.never().optional() }),
  z.object({ blobId: z.string().regex(/^blob-[A-Za-z0-9-]+$/), base64: z.never().optional() }),
]);

const InputItemSchema = z.union([
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
    name: z.string().optional(),
  }).and(BinaryInputSourceSchema),
  z.object({
    type: z.literal("file_reference"), id: z.string(),
    path: z.string().startsWith("/").min(2).refine(path => !path.includes("\0")),
    name: z.string().trim().min(1), mimeType: z.string().optional(),
  }).strict(),
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

const PetImageRefSchema = z.discriminatedUnion('type',[
  z.object({type:z.literal('builtin'),id:z.literal('yachiyo')}).strict(),
  z.object({type:z.literal('imported'),blobId:z.string(),mimeType:z.enum(['image/png','image/jpeg','image/webp']),width:z.number().int().min(1).max(4096),height:z.number().int().min(1).max(4096)}).strict(),
]);
const ThreadCommandSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("thread.start"),
    commandId: z.string(),
    timestamp: z.string(),
    payload: z.object({
      petId: z.string().min(1),
      dynamicTools: DynamicToolsSchema.optional(),
    }).strict(),
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
    payload: z.object({petId:z.string().optional(),limit:z.number().int().min(1).max(100).optional(),cursor:z.string().optional()}).strict().optional(),
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
  z.object({type:z.literal('pet.list'),commandId:z.string(),timestamp:z.string()}),
  z.object({type:z.literal('pet.create'),commandId:z.string(),timestamp:z.string(),payload:z.object({name:z.string().trim().min(1),description:z.string().optional(),rolePrompt:z.string().trim().min(1),imageRef:PetImageRefSchema,rootPath:z.string().min(1),isDefault:z.boolean().optional()}).strict()}),
  z.object({type:z.literal('pet.update'),commandId:z.string(),timestamp:z.string(),payload:z.object({id:z.string(),expectedRevision:z.number().int().min(1),patch:z.object({name:z.string().trim().min(1).optional(),description:z.string().optional(),rolePrompt:z.string().trim().min(1).optional(),imageRef:PetImageRefSchema.optional(),isDefault:z.boolean().optional()}).strict()}).strict()}),
  z.object({type:z.literal('pet.image.import'),commandId:z.string(),timestamp:z.string(),payload:z.object({mimeType:z.enum(['image/png','image/jpeg','image/webp']),base64:z.string().max(28*1024*1024)}).strict()}),
]) satisfies z.ZodType<ThreadCommand>;

const ClientResponseSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("permission.answered"),
    requestId: z.string(),
    timestamp: z.string(),
    payload: z.object({
      decision: z.enum(["allow", "deny"]),
      scope: z.enum(["once", "always"]).optional(),
      reason: z.string().optional(),
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
  dynamicToolBridge,
  staticFilesDir,
  blobStore,
  port = 4317,
}: {
  commandRouter: ThreadCommandRouter;
  eventPublisher: ThreadNotificationPublisher;
  activityPublisher?: AgentActivityPublisher;
  dynamicToolBridge?: WebSocketDynamicToolBridge;
  staticFilesDir?: string;
  blobStore?: BlobStore;
  port?: number;
}) {
  const { createServer } = await import("node:http");
  const { WebSocketServer } = await import("ws");
  const threadWebSocketServer = new WebSocketServer({ noServer: true });
  const dynamicToolWebSocketServer = new WebSocketServer({ noServer: true });
  const activityWebSocketServer = new WebSocketServer({ noServer: true });
  const server = createServer((request, response) => {
    void handleHTTPRequest(request, response, { staticFilesDir, blobStore });
  });

  threadWebSocketServer.on("connection", (socket, request) => {
    attachThreadSocketHandlers(socket, {
      commandRouter,
      eventPublisher,
      acceptServerRequests: new URL(request.url ?? "/", "http://localhost").searchParams.get("acceptServerRequests") === "1",
      observeRequests: new URL(request.url ?? "/", "http://localhost").searchParams.get("observeRequests") === "1",
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

  server.on("upgrade", (request, socket, head) => {
    const path = request.url?.split("?")[0];
    if (path === "/api/activity") {
      activityWebSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
        activityWebSocketServer.emit("connection", webSocket, request);
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

  const closeHTTP = server.close.bind(server);
  server.close = ((callback?: (error?: Error) => void) => {
    for (const wsServer of [threadWebSocketServer, dynamicToolWebSocketServer, activityWebSocketServer]) {
      for (const client of wsServer.clients) client.terminate();
      wsServer.close();
    }
    return closeHTTP(callback);
  }) as typeof server.close;
  return server;
}

export async function startDefaultServer(port = 4317) {
  const [
    { AgentRuntime },
    { PetRegistry },
    { FilePermissionPolicy },
    { SettingsBackedLLMClient },
    { SettingsBackedToolRegistry },
    { MCPServerRegistry },
    { StdioMCPClient },
    { StreamableHttpMCPClient },
    { FileNetworkLogger },
    { FilesystemBlobStore },
    { TurnSummarizer },
    { MockLLMClient },
    { createDefaultWebTools },
  ] = await Promise.all([
    import("@handagent/core/runtime/AgentRuntime.ts"),
    import("@handagent/core/pet/PetRegistry.ts"),
    import("@handagent/core/adapters/filesystem/FilePermissionPolicy.ts"),
    import("../settings/SettingsBackedLLMClient.ts"),
    import("../settings/SettingsBackedToolRegistry.ts"),
    import("../actions/MCPServerRegistry.ts"),
    import("@handagent/core/adapters/mcp/StdioMCPClient.ts"),
    import("@handagent/core/adapters/mcp/StreamableHttpMCPClient.ts"),
    import("@handagent/core/adapters/filesystem/FileNetworkLogger.ts"),
    import("@handagent/core/adapters/filesystem/FilesystemBlobStore.ts"),
    import("@handagent/core/runtime/TurnSummarizer.ts"),
    import("@handagent/core/adapters/providers/MockLLMClient.ts"),
    import("@handagent/core/tools/web/WebTools.ts"),
  ]);

  const paths = resolveServerPaths();
  const store = new ThreadStore({ dbPath: paths.threadsDbPath });
  const networkLogger = new FileNetworkLogger({ baseDir: paths.logDir });
  const blobStore = new FilesystemBlobStore({ rootPath: paths.blobsDir });
  const mcpConfig = await readMCPConfig(paths.mcpConfigPath);
  const mcpServers = new Map(mcpConfig.servers.map((server) => [server.id, server]));

  const petRegistry = new PetRegistry(store);
  await petRegistry.ensureDefault(paths.defaultPetRoot);

  const dynamicToolBridge = new WebSocketDynamicToolBridge();
  let threads: ThreadRegistry;
  const toolRegistry = new SettingsBackedToolRegistry();
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
  const permissionPolicy = new FilePermissionPolicy({
    filePath: paths.permissionsPath,
    askResolver: (request) => threads.get(request.threadId ?? "")?.requests.askPermission(request) ?? Promise.resolve({ decision: "deny" }),
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

  const persistence = new ThreadPersistence(store, undefined, blobStore);
  const activityPublisher = new AgentActivityPublisher();
  const eventPublisher = new ThreadNotificationPublisher((event) => activityPublisher.observe(event));
  threads = new ThreadRegistry({
    storage: persistence,
    projection: {
      runtimeMessages: projection.agentMessagesToRuntimeMessages,
      conversation: projection.agentMessagesToConversation,
      notification: projection.toThreadNotification,
      audit: projection.toAuditEvent,
      summarizeInput: projection.summarizeUserInput,
    },
    publish: (event) => eventPublisher.publish(event),
    createTools: (dynamicTools) => new ThreadTools({
      builtinRegistry: toolRegistry.registry,
      refreshBuiltins: () => toolRegistry.refresh(),
      globalMcpServerIds,
      listMcpTools: (id) => mcpRegistry.listTools(id),
      dynamicToolBridge,
      exposeBuiltinToolsBeforeActivation: llmMode === "mock",
      defaultTools: [...createDefaultWebTools(), ...createDefaultReadTools({contextHistoryRoot:join(paths.spotDir,"context-history")})],
    }, dynamicTools, { log: (message) => console.warn(message) }),
    createRuntime: (id, tools) => new AgentRuntime(llmClient, tools.registry, {
      permissionPolicy, blobStore, turnSummarizer: summarizer,
      onMetaToolActivate: () => tools.activate(),
      isThreadActivated: () => tools.isActivated(),
    }),
  });
  const commandRouter = new ThreadCommandRouter(threads, eventPublisher, petRegistry, undefined, () => dynamicToolBridge.availableTools(), blobStore);
  const server = await startServer({ commandRouter, eventPublisher, activityPublisher, dynamicToolBridge,
    staticFilesDir: resolveThreadWindowWebDistDir(), blobStore, port });
  let shutdown: Promise<void> | undefined;
  const close = () => shutdown ??= (async () => {
    const stopped = new Promise<void>((resolve) => server.close(() => resolve()));
    await threads.close();
    await settleWithin(mcpRegistry.closeAll(), 3000);
    dynamicToolBridge.close();
    store.close();
    await settleWithin(stopped, 1000);
  })();
  return Object.assign(server, { shutdown: close });
}

interface ServerPaths {
  spotDir: string;
  threadsDbPath: string;
  logDir: string;
  blobsDir: string;
  defaultPetRoot: string;
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
    defaultPetRoot: join(spotDir, "workspace"),
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
    blobStore?: BlobStore;
  },
): Promise<void> {
  const blobId = /^\/api\/blobs\/(blob-[A-Za-z0-9-]+)$/.exec(request.url ?? "")?.[1];
  if (blobId && options.blobStore && request.method === "GET") {
    try {
      const record = await options.blobStore.get(blobId);
      if (!record || (record.kind !== "image" && record.kind !== "pdf")) {
        response.statusCode = 404; response.end("Attachment not found"); return;
      }
      const bytes = await options.blobStore.readContent(blobId);
      response.setHeader("Content-Type", contentType(extname(record.path)) || "application/octet-stream");
      response.setHeader("X-Content-Type-Options", "nosniff");
      response.setHeader("Cache-Control", "private, max-age=3600");
      response.end(bytes);
    } catch { response.statusCode = 404; response.end("Attachment not found"); }
    return;
  }
  await handleStaticRequest(request.url ?? "/", response, options.staticFilesDir);
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


if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = await startDefaultServer();
  const shutdown = () => { void server.shutdown().finally(() => process.exit(0)); };
  process.stdin.resume();
  process.stdin.on("end", shutdown);
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}
