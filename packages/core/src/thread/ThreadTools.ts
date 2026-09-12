import type { AgentTool } from "@handagent/core/tools/types/AgentTool.ts";
import { ToolRegistry } from "@handagent/core/tools/ToolRegistry.ts";
import { MetaToolUseTool } from "@handagent/core/tools/MetaToolUseTool.ts";
import type {
  DynamicToolBridge,
  DynamicToolSpec,
} from "@handagent/core/protocol/types/DynamicTool.ts";
import { DynamicToolAdapter } from "@handagent/core/tools/DynamicToolAdapter.ts";

export class ThreadTools {
  private readonly metaTool: AgentTool = MetaToolUseTool.create();
  private activated = false;
  private revision = 0;
  readonly registry = new ToolRegistry([this.metaTool]);

  constructor(
    private readonly options: {
      builtinRegistry: ToolRegistry;
      globalMcpServerIds: string[];
      listMcpTools: (serverId: string) => Promise<AgentTool[]>;
      dynamicToolBridge?: DynamicToolBridge;
      exposeBuiltinToolsBeforeActivation?: boolean;
      defaultTools?: AgentTool[];
      refreshBuiltins?: () => Promise<unknown>;
    },
    private readonly dynamicTools: DynamicToolSpec[] = [],
    private readonly dependencies: {
      log?: (message: string) => void;
    } = {},
  ) {}

  async refresh(): Promise<void> {
    const revision = ++this.revision;
    await this.options.refreshBuiltins?.();
    if (revision !== this.revision) return;
    const registry = this.registry;
    if (this.activated) {
      await this.refreshActivated(registry, revision);
      return;
    }
    if (this.options.exposeBuiltinToolsBeforeActivation) {
      this.replaceWithUniqueTools(registry, [
        this.metaTool,
        ...this.defaultTools(),
        ...this.options.builtinRegistry.all(),
      ]);
      return;
    }
    this.replaceWithUniqueTools(registry, [this.metaTool, ...this.defaultTools()]);
  }

  async activate(): Promise<void> {
    this.activated = true;
    await this.refreshActivated(this.registry, ++this.revision);
  }

  cancelRefresh(): void { this.revision += 1; }

  isActivated(): boolean { return this.activated; }

  private async refreshActivated(
    registry: ToolRegistry,
    revision: number,
  ): Promise<void> {
    const tools: AgentTool[] = [
      ...this.defaultTools(),
      ...this.options.builtinRegistry.all(),
    ];

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

    tools.push(...this.dynamicToolAdapters());
    if (revision === this.revision) this.replaceWithUniqueTools(registry, tools);
  }

  private dynamicToolAdapters(): AgentTool[] {
    const specs = this.dynamicTools;
    if (specs.length === 0) return [];
    const bridge = this.options.dynamicToolBridge ?? offlineDynamicToolBridge;
    return specs.map((spec) => new DynamicToolAdapter(spec, bridge));
  }

  private defaultTools(): AgentTool[] {
    return this.options.defaultTools ?? [];
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
