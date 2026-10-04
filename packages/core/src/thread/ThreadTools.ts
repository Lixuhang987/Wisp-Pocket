import type { AgentTool } from "../tools/types/AgentTool.ts";
import { ToolRegistry } from "../tools/ToolRegistry.ts";

/** Resolves the permitted catalogue at each Turn; stale refreshes cannot replace it. */
export class ThreadTools {
  private revision = 0;
  readonly registry = new ToolRegistry();

  constructor(private readonly options: { resolveTools: () => Promise<AgentTool[]> | AgentTool[] }) {}

  async refresh(): Promise<void> {
    const revision = ++this.revision;
    const tools = await this.options.resolveTools();
    if (revision !== this.revision) return;
    const unique = new Map<string, AgentTool>();
    for (const tool of tools) if (!unique.has(tool.name)) unique.set(tool.name, tool);
    this.registry.replaceAll([...unique.values()]);
  }

  cancelRefresh(): void { this.revision += 1; }
}
