import type { AgentTool } from "@handagent/core/tools/types/AgentTool.ts";
import type {
  MCPClient,
  MCPPromptDescription,
  MCPGetPromptResult,
  MCPResourceDescription,
  MCPReadResourceResult,
  MCPServerInfo,
} from "@handagent/core/mcp/MCPClient.ts";
import { MCPToolAdapter } from "@handagent/core/mcp/MCPToolAdapter.ts";

export class MCPServerRegistry {
  private readonly clients = new Map<string, MCPClient>();
  private readonly initializing = new Map<string, Promise<MCPClient>>();
  private closing = false;
  private readonly toolCache = new Map<string, AgentTool[]>();

  constructor(
    private readonly options: {
      createClient: (serverId: string) => MCPClient;
    },
  ) {}

  async getClient(serverId: string): Promise<MCPClient> {
    if (this.closing) throw new Error("MCP service closed");
    const existing = this.clients.get(serverId);
    if (existing) return existing;
    const pending = this.initializing.get(serverId);
    if (pending) return pending;
    const client = this.options.createClient(serverId);
    const initialization = (async () => {
      try {
        await client.initialize();
        if (this.closing) throw new Error("MCP service closed");
        this.clients.set(serverId, client);
        return client;
      } catch (error) {
        await client.close();
        throw error;
      } finally { this.initializing.delete(serverId); }
    })();
    this.initializing.set(serverId, initialization);
    return initialization;
  }

  getServerInfo(serverId: string): MCPServerInfo | undefined {
    return this.clients.get(serverId)?.serverInfo();
  }

  async listTools(serverId: string): Promise<AgentTool[]> {
    const cached = this.toolCache.get(serverId);
    if (cached) return cached;

    const client = await this.getClient(serverId);
    const tools = (await client.listTools()).map(
      (tool) =>
        new MCPToolAdapter({
          serverId,
          tool,
          callTool: (name, args) => client.callTool(name, args),
        }),
    );
    if (this.closing) throw new Error("MCP service closed");
    this.toolCache.set(serverId, tools);
    return tools;
  }

  async listPrompts(serverId: string): Promise<MCPPromptDescription[]> {
    const client = await this.getClient(serverId);
    return client.listPrompts();
  }

  async getPrompt(
    serverId: string,
    name: string,
    args?: Record<string, string>,
  ): Promise<MCPGetPromptResult> {
    const client = await this.getClient(serverId);
    return client.getPrompt(name, args);
  }

  async listResources(serverId: string): Promise<MCPResourceDescription[]> {
    const client = await this.getClient(serverId);
    return client.listResources();
  }

  async readResource(serverId: string, uri: string): Promise<MCPReadResourceResult> {
    const client = await this.getClient(serverId);
    return client.readResource(uri);
  }

  async closeAll(): Promise<void> {
    this.closing = true;
    const clients = [...this.clients.values()];
    this.clients.clear();
    this.toolCache.clear();
    await Promise.allSettled(clients.map((client) => client.close()));
    // In-flight initialization closes its own client before settling.
    await Promise.allSettled(this.initializing.values());
  }
}
