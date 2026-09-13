import { describe, expect, it } from "vitest";
import { MockLLMClient } from "@handagent/core/adapters/providers/MockLLMClient.ts";
import { AgentRuntime, type AgentRuntimeEvent } from "@handagent/core/runtime/AgentRuntime.ts";
import type { AgentMessage } from "@handagent/core/runtime/types/AgentMessage.ts";
import type { AgentTool } from "@handagent/core/tools/types/AgentTool.ts";
import { ToolRegistry } from "@handagent/core/tools/ToolRegistry.ts";
import { META_TOOL_NAME } from "@handagent/core/tools/MetaToolUseTool.ts";
import type { DynamicToolBridge } from "@handagent/core/protocol/types/DynamicTool.ts";
import { ThreadTools } from "@handagent/core/thread/ThreadTools.ts";

// Test fixture models independent owners while preserving the existing tool-behavior cases.
class ThreadScopedToolRegistry {
  private tools = new Map<string, ThreadTools>();
  constructor(private options: ConstructorParameters<typeof ThreadTools>[0], private dependencies: ConstructorParameters<typeof ThreadTools>[2] = {}) {}
  private get(id: string) {
    let tools = this.tools.get(id);
    if (!tools) { tools = new ThreadTools(this.options, [], this.dependencies); this.tools.set(id, tools); }
    return tools;
  }
  registryForThread(id: string) { return this.get(id).registry; }
  refreshForThread(id: string) { return this.get(id).refresh(); }
  activate(id: string) { return this.get(id).activate(); }
  isActivated(id: string) { return this.get(id).isActivated(); }
  setDynamicTools(id: string, specs: ConstructorParameters<typeof ThreadTools>[1]) {
    this.tools.set(id, new ThreadTools(this.options, specs, this.dependencies));
  }
  forgetThread(id: string) { this.tools.delete(id); }
}

function fakeTool(name: string): AgentTool {
  return {
    name,
    description: name,
    inputSchema: { type: "object", additionalProperties: false },
    call: async () => "ok",
  };
}

function buildScoped(options?: {
  builtin?: AgentTool[];
  mcp?: Record<string, AgentTool[]>;
  globalMcpServerIds?: string[];
  defaultTools?: AgentTool[];
}): ThreadScopedToolRegistry {
  const builtin = new ToolRegistry(options?.builtin ?? [fakeTool("workspace.list")]);
  return new ThreadScopedToolRegistry({
    builtinRegistry: builtin,
    globalMcpServerIds: options?.globalMcpServerIds ?? [],
    listMcpTools: async (id) => options?.mcp?.[id] ?? [],
    defaultTools: options?.defaultTools,
  });
}

describe("ThreadScopedToolRegistry lazy activation", () => {
  it("only exposes the meta-tool before activation", async () => {
    const scoped = buildScoped();
    await scoped.refreshForThread("s1");

    expect(scoped.registryForThread("s1").list().map((t) => t.name)).toEqual(["use_tools"]);
    expect(scoped.isActivated("s1")).toBe(false);
  });

  it("exposes configured default tools before and after use_tools activation", async () => {
    const scoped = buildScoped({
      builtin: [fakeTool("workspace.list")],
      defaultTools: [fakeTool("web_search"), fakeTool("fetch_page")],
    });

    await scoped.refreshForThread("s1");
    expect(scoped.registryForThread("s1").list().map((t) => t.name)).toEqual([
      "use_tools",
      "web_search",
      "fetch_page",
    ]);

    await scoped.activate("s1");
    expect(scoped.registryForThread("s1").list().map((t) => t.name)).toEqual([
      "web_search",
      "fetch_page",
      "workspace.list",
    ]);
  });

  it("activate switches the registry to builtin + mcp tools without the meta-tool", async () => {
    const scoped = buildScoped({
      builtin: [fakeTool("workspace.list"), fakeTool("file.read")],
      mcp: { srv: [fakeTool("mcp.srv.echo")] },
      globalMcpServerIds: ["srv"],
    });

    await scoped.activate("s1");

    expect(scoped.registryForThread("s1").list().map((t) => t.name)).toEqual([
      "workspace.list",
      "file.read",
      "mcp.srv.echo",
    ]);
    expect(scoped.isActivated("s1")).toBe(true);
  });

  it("keeps dynamic tools hidden before activation and registers them after use_tools", async () => {
    const bridgeCalls: unknown[] = [];
    const bridge: DynamicToolBridge = {
      async call(payload) {
        bridgeCalls.push(payload);
        return {
          callId: payload.callId,
          success: true,
          contentItems: [{ type: "inputText", text: "captured" }],
        };
      },
    };
    const scoped = new ThreadScopedToolRegistry({
      builtinRegistry: new ToolRegistry([fakeTool("file.read")]),
      globalMcpServerIds: [],
      listMcpTools: async () => [],
      dynamicToolBridge: bridge,
    });
    scoped.setDynamicTools("s1", [
      {
        clientId: "swift-host",
        namespace: "host_macos",
        name: "screen_capture",
        description: "Capture a screen image",
        inputSchema: { type: "object", properties: {} },
      },
    ]);

    await scoped.refreshForThread("s1");
    expect(scoped.registryForThread("s1").list().map((tool) => tool.name)).toEqual([
      "use_tools",
    ]);

    await scoped.activate("s1");
    expect(scoped.registryForThread("s1").list().map((tool) => tool.name)).toEqual([
      "file.read",
      "host_macos.screen_capture",
    ]);

    const tool = scoped.registryForThread("s1").get("host_macos.screen_capture");
    await expect(tool?.call({}, {
      threadId: "s1",
      turnId: "turn-1",
      toolCallId: "call-1",
    })).resolves.toEqual({
      callId: "call-1",
      success: true,
      contentItems: [{ type: "inputText", text: "captured" }],
    });
    expect(bridgeCalls).toEqual([
      expect.objectContaining({
        clientId: "swift-host",
        threadId: "s1",
        turnId: "turn-1",
        callId: "s1:turn-1:call-1",
        namespace: "host_macos",
        tool: "screen_capture",
      }),
    ]);
  });

  it("removes the meta-tool from the next LLM request after activation", async () => {
    const toolNamesPerRequest: string[][] = [];
    const scoped = buildScoped({
      builtin: [fakeTool("workspace.list")],
    });
    await scoped.refreshForThread("s1");

    const client = {
      async *stream(_messages: AgentMessage[], tools: AgentTool[]) {
        toolNamesPerRequest.push(tools.map((tool) => tool.name));
        if (toolNamesPerRequest.length === 1) {
          yield {
            type: "tool_call" as const,
            toolCall: { id: "meta-1", name: META_TOOL_NAME, arguments: {} },
          };
          yield {
            type: "message_end" as const,
            message: { role: "assistant" as const, content: "" },
            toolCalls: [{ id: "meta-1", name: META_TOOL_NAME, arguments: {} }],
          };
          return;
        }
        yield { type: "text_delta" as const, text: "done" };
        yield {
          type: "message_end" as const,
          message: { role: "assistant" as const, content: "done" },
          toolCalls: [],
        };
      },
    };

    const runtime = new AgentRuntime(client, scoped.registryForThread("s1"), {
      onMetaToolActivate: (threadId) => scoped.activate(threadId),
      isThreadActivated: (threadId) => scoped.isActivated(threadId),
    });

    await runtime.runWithMessages([{ role: "user", content: "inspect screen" }], () => {}, {
      threadId: "s1",
    });

    expect(toolNamesPerRequest).toEqual([
      ["use_tools"],
      ["workspace.list"],
    ]);
  });

  it("emits dynamic tool calls through the generic tool audit events", async () => {
    const bridgeCalls: unknown[] = [];
    const bridge: DynamicToolBridge = {
      async call(payload) {
        bridgeCalls.push(payload);
        return {
          callId: payload.callId,
          success: true,
          contentItems: [{ type: "inputText", text: "captured" }],
        };
      },
    };
    const scoped = new ThreadScopedToolRegistry({
      builtinRegistry: new ToolRegistry([]),
      globalMcpServerIds: [],
      listMcpTools: async () => [],
      dynamicToolBridge: bridge,
    });
    scoped.setDynamicTools("s1", [
      {
        clientId: "swift-host",
        namespace: "host_macos",
        name: "screen_capture",
        description: "Capture a screen image",
        inputSchema: { type: "object", properties: {} },
      },
    ]);
    await scoped.refreshForThread("s1");

    let requestCount = 0;
    const client = {
      async *stream(_messages: AgentMessage[], tools: AgentTool[]) {
        requestCount += 1;
        if (requestCount === 1) {
          expect(tools.map((tool) => tool.name)).toEqual(["use_tools"]);
          yield {
            type: "tool_call" as const,
            toolCall: { id: "meta-1", name: META_TOOL_NAME, arguments: {} },
          };
          yield {
            type: "message_end" as const,
            message: { role: "assistant" as const, content: "" },
            toolCalls: [{ id: "meta-1", name: META_TOOL_NAME, arguments: {} }],
          };
          return;
        }
        if (requestCount === 2) {
          expect(tools.map((tool) => tool.name)).toEqual([
            "host_macos.screen_capture",
          ]);
          yield {
            type: "tool_call" as const,
            toolCall: {
              id: "dyn-1",
              name: "host_macos.screen_capture",
              arguments: { displayId: 1 },
            },
          };
          yield {
            type: "message_end" as const,
            message: { role: "assistant" as const, content: "" },
            toolCalls: [{
              id: "dyn-1",
              name: "host_macos.screen_capture",
              arguments: { displayId: 1 },
            }],
          };
          return;
        }
        yield { type: "text_delta" as const, text: "done" };
        yield {
          type: "message_end" as const,
          message: { role: "assistant" as const, content: "done" },
          toolCalls: [],
        };
      },
    };
    const runtime = new AgentRuntime(client, scoped.registryForThread("s1"), {
      onMetaToolActivate: (threadId) => scoped.activate(threadId),
      isThreadActivated: (threadId) => scoped.isActivated(threadId),
    });
    const events: AgentRuntimeEvent[] = [];

    await runtime.runWithMessages(
      [{ role: "user", content: "inspect screen" }],
      (event) => events.push(event),
      { threadId: "s1", turnId: "turn-1" },
    );

    expect(bridgeCalls).toEqual([
      expect.objectContaining({
        threadId: "s1",
        turnId: "turn-1",
        callId: "s1:turn-1:dyn-1",
      }),
    ]);
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: "tool_call",
        toolCallId: "dyn-1",
        toolName: "host_macos.screen_capture",
        input: { displayId: 1 },
      }),
      expect.objectContaining({
        type: "tool_result",
        toolCallId: "dyn-1",
        toolName: "host_macos.screen_capture",
        status: "success",
        output: expect.stringContaining("captured"),
      }),
    ]));
  });

  it("isolates activation state per Thread", async () => {
    const scoped = buildScoped();
    await scoped.activate("s1");
    await scoped.refreshForThread("s2");

    expect(scoped.isActivated("s1")).toBe(true);
    expect(scoped.isActivated("s2")).toBe(false);
    expect(scoped.registryForThread("s2").list().map((t) => t.name)).toEqual(["use_tools"]);
    expect(scoped.registryForThread("s1").list().map((t) => t.name)).toEqual([
      "workspace.list",
    ]);
  });

  it("does not activate a Thread only because MCP servers exist globally", async () => {
    const scoped = buildScoped({
      builtin: [fakeTool("workspace.list")],
      mcp: { srv: [fakeTool("mcp.srv.echo")] },
      globalMcpServerIds: ["srv"],
    });

    await scoped.refreshForThread("s1");

    expect(scoped.registryForThread("s1").list().map((t) => t.name)).toEqual([
      "use_tools",
    ]);
    expect(scoped.isActivated("s1")).toBe(false);
  });

  it("forgetThread drops activation state", async () => {
    const scoped = buildScoped();
    await scoped.activate("s1");
    expect(scoped.isActivated("s1")).toBe(true);

    scoped.forgetThread("s1");
    expect(scoped.isActivated("s1")).toBe(false);
  });

  it("does not rewrite one Thread registry when another Thread refreshes", async () => {
    const scoped = buildScoped({
      builtin: [fakeTool("workspace.list"), fakeTool("file.read")],
    });

    await scoped.activate("s1");
    const s1Registry = scoped.registryForThread("s1");

    await scoped.refreshForThread("s2");

    expect(scoped.registryForThread("s2").list().map((t) => t.name)).toEqual(["use_tools"]);
    expect(s1Registry.list().map((t) => t.name)).toEqual([
      "workspace.list",
      "file.read",
    ]);
  });

  it("can eagerly expose builtin tools for mock LLM direct tool-call scenarios", async () => {
    const fileWriteCalls: unknown[] = [];
    const fileWriteTool: AgentTool = {
      name: "file.write",
      description: "write file",
      inputSchema: { type: "object" },
      call: async (input) => {
        fileWriteCalls.push(input);
        return "ok";
      },
    };
    const scoped = new ThreadScopedToolRegistry({
      builtinRegistry: new ToolRegistry([fileWriteTool]),
      globalMcpServerIds: [],
      listMcpTools: async () => [],
      exposeBuiltinToolsBeforeActivation: true,
    });

    await scoped.refreshForThread("mock-Thread");
    const runtime = new AgentRuntime(
      new MockLLMClient(),
      scoped.registryForThread("mock-Thread"),
      {
        isThreadActivated: (threadId) => scoped.isActivated(threadId),
      },
    );

    const result = await runtime.runWithMessages(
      [{ role: "user", content: "please [mock:file-write]" }],
      () => {},
      { threadId: "mock-Thread" },
    );

    expect(fileWriteCalls).toEqual([
      {
        workspaceId: "qa-workspace",
        relativePath: "hello.txt",
        content: "hello from MockLLMClient",
      },
    ]);
    expect(result.messages.at(-1)).toEqual({
      role: "assistant",
      id: expect.any(String),
      content: "Mock file.write completed for hello.txt.",
    });
  });

  it("does not eagerly load MCP tools when only builtin tools are needed for mock LLM scenarios", async () => {
    let listMcpToolCalls = 0;
    const scoped = new ThreadScopedToolRegistry({
      builtinRegistry: new ToolRegistry([fakeTool("file.write")]),
      globalMcpServerIds: ["filesystem"],
      listMcpTools: async () => {
        listMcpToolCalls += 1;
        return [fakeTool("mcp.filesystem.read_file")];
      },
      exposeBuiltinToolsBeforeActivation: true,
    });

    await scoped.refreshForThread("mock-Thread");

    expect(listMcpToolCalls).toBe(0);
    expect(scoped.isActivated("mock-Thread")).toBe(false);
    expect(scoped.registryForThread("mock-Thread").list().map((t) => t.name)).toEqual([
      "use_tools",
      "file.write",
    ]);
  });
});
