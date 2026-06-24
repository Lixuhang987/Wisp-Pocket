import type { AgentTool } from "@handagent/core/tools/AgentTool.ts";
import { ToolRegistry } from "@handagent/core/tools/ToolRegistry.ts";
import { MetaToolUseTool } from "@handagent/core/tools/MetaToolUseTool.ts";
import type {
  DynamicToolBridge,
  DynamicToolSpec,
} from "@handagent/core/protocol/DynamicTool.ts";
import { DynamicToolAdapter } from "@handagent/core/tools/DynamicToolAdapter.ts";

export class ThreadScopedToolRegistry {
  private readonly metaTool: AgentTool = MetaToolUseTool.create();
  private readonly activated = new Set<string>();
  private readonly registries = new Map<string, ToolRegistry>();
  private readonly dynamicToolsByThread = new Map<string, DynamicToolSpec[]>();

  constructor(
    private readonly options: {
      builtinRegistry: ToolRegistry;
      globalMcpServerIds: string[];
      listMcpTools: (serverId: string) => Promise<AgentTool[]>;
      dynamicToolBridge?: DynamicToolBridge;
      exposeBuiltinToolsBeforeActivation?: boolean;
    },
    private readonly dependencies: {
      log?: (message: string) => void;
    } = {},
  ) {}

  async refreshForThread(threadId: string): Promise<void> {
    const registry = this.registryForThread(threadId);
    if (this.activated.has(threadId)) {
      await this.refreshActivated(threadId, registry);
      return;
    }
    if (this.options.exposeBuiltinToolsBeforeActivation) {
      this.replaceWithUniqueTools(registry, [
        this.metaTool,
        ...this.options.builtinRegistry.all(),
      ]);
      return;
    }
    registry.replaceAll([this.metaTool]);
  }

  async activate(threadId: string): Promise<void> {
    this.activated.add(threadId);
    await this.refreshActivated(threadId, this.registryForThread(threadId));
  }

  setDynamicTools(threadId: string, tools: DynamicToolSpec[]): void {
    this.dynamicToolsByThread.set(threadId, tools.map((tool) => ({ ...tool })));
  }

  isActivated(threadId: string): boolean {
    return this.activated.has(threadId);
  }

  registryForThread(threadId: string): ToolRegistry {
    let registry = this.registries.get(threadId);
    if (!registry) {
      registry = new ToolRegistry([this.metaTool]);
      this.registries.set(threadId, registry);
    }
    return registry;
  }

  forgetThread(threadId: string): void {
    this.activated.delete(threadId);
    this.registries.delete(threadId);
    this.dynamicToolsByThread.delete(threadId);
  }

  private async refreshActivated(
    threadId: string,
    registry: ToolRegistry,
  ): Promise<void> {
    const tools: AgentTool[] = [...this.options.builtinRegistry.all()];

    const serverIds = new Set(this.options.globalMcpServerIds);

    for (const serverId of serverIds) {
      try {
        tools.push(...(await this.options.listMcpTools(serverId)));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.dependencies.log?.(
          `[agent-server] skipped MCP server ${serverId}: ${message}`,
        );
      }
    }

    tools.push(...this.dynamicToolAdaptersForThread(threadId));
    this.replaceWithUniqueTools(registry, tools);
  }

  private dynamicToolAdaptersForThread(threadId: string): AgentTool[] {
    const specs = this.dynamicToolsByThread.get(threadId) ?? [];
    if (specs.length === 0) return [];
    const bridge = this.options.dynamicToolBridge ?? offlineDynamicToolBridge;
    return specs.map((spec) => new DynamicToolAdapter(spec, bridge));
  }

  private replaceWithUniqueTools(registry: ToolRegistry, tools: AgentTool[]): void {
    const byName = new Map<string, AgentTool>();
    for (const tool of tools) {
      if (!byName.has(tool.name)) {
        byName.set(tool.name, tool);
      }
    }
    registry.replaceAll([...byName.values()]);
  }
}

const offlineDynamicToolBridge: DynamicToolBridge = {
  async call(payload) {
    return {
      callId: payload.callId,
      success: false,
      contentItems: [
        {
          type: "inputText",
          text: `Dynamic tool provider is offline: ${payload.clientId}`,
        },
      ],
    };
  },
};
