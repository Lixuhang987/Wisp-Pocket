import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { ElicitRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type {
  MCPCallToolResult,
  MCPClient,
  MCPGetPromptResult,
  MCPPromptDescription,
  MCPReadResourceResult,
  MCPResourceDescription,
  MCPServerCapabilities,
  MCPServerInfo,
  MCPToolDescription,
} from "./MCPClient.ts";
import {
  parsePromptDescription,
  parseResourceDescription,
  parseToolDescription,
} from "./MCPDescriptions.ts";

const CLIENT_INFO = { name: "handagent", version: "0.1.0" };
const DEFAULT_REQUEST_TIMEOUT_MS = 60_000;

export abstract class SDKMCPClientAdapter implements MCPClient {
  private client?: Client;
  private transport?: Transport;
  private info?: MCPServerInfo;

  protected constructor(
    private readonly options: {
      serverId: string;
      timeoutLabel: string;
      requestTimeoutMs?: number;
      autoAcceptEmptyForm?: boolean;
    },
  ) {}

  async initialize(): Promise<MCPServerInfo> {
    await this.withTimeout("initialize", () => this.connect());
    this.info = this.toServerInfo();
    return this.info;
  }

  serverInfo(): MCPServerInfo | undefined {
    return this.info;
  }

  async listTools(): Promise<MCPToolDescription[]> {
    const result = await this.withTimeout("tools/list", () =>
      this.ensureConnectedClient().listTools({}, this.requestOptions()),
    );
    return result.tools.map(parseToolDescription);
  }

  async callTool(
    name: string,
    args: Record<string, unknown>,
  ): Promise<MCPCallToolResult> {
    const result = await this.withTimeout("tools/call", () =>
      this.ensureConnectedClient().callTool(
        { name, arguments: args },
        undefined,
        this.requestOptions(),
      ),
    );
    return isRecord(result) ? (result as MCPCallToolResult) : { content: [] };
  }

  async listPrompts(): Promise<MCPPromptDescription[]> {
    const result = await this.withTimeout("prompts/list", () =>
      this.ensureConnectedClient().listPrompts({}, this.requestOptions()),
    );
    return result.prompts.map(parsePromptDescription);
  }

  async getPrompt(
    name: string,
    args?: Record<string, string>,
  ): Promise<MCPGetPromptResult> {
    const result = await this.withTimeout("prompts/get", () =>
      this.ensureConnectedClient().getPrompt(
        args ? { name, arguments: args } : { name },
        this.requestOptions(),
      ),
    );
    return {
      description: result.description,
      messages: result.messages,
    } as MCPGetPromptResult;
  }

  async listResources(): Promise<MCPResourceDescription[]> {
    const result = await this.withTimeout("resources/list", () =>
      this.ensureConnectedClient().listResources({}, this.requestOptions()),
    );
    return result.resources.map(parseResourceDescription);
  }

  async readResource(uri: string): Promise<MCPReadResourceResult> {
    const result = await this.withTimeout("resources/read", () =>
      this.ensureConnectedClient().readResource({ uri }, this.requestOptions()),
    );
    return { contents: result.contents } as MCPReadResourceResult;
  }

  async close(): Promise<void> {
    await this.client?.close();
    this.client = undefined;
    this.transport = undefined;
  }

  protected abstract createTransport(): Transport;

  private ensureConnectedClient(): Client {
    if (!this.client) {
      throw new Error("MCP client is not initialized");
    }
    return this.client;
  }

  private async connect(): Promise<void> {
    if (this.client) return;

    const client = new Client(CLIENT_INFO, {
      capabilities: this.clientCapabilities(),
    });
    if (this.options.autoAcceptEmptyForm) {
      client.setRequestHandler(ElicitRequestSchema, async (request) => {
        const shouldAccept = isEmptyFormElicitation(request.params);
        return {
          action: shouldAccept ? "accept" : "decline",
          content: shouldAccept ? {} : undefined,
        };
      });
    }

    const transport = this.createTransport();
    await client.connect(transport, this.requestOptions());
    this.client = client;
    this.transport = transport;
  }

  private toServerInfo(): MCPServerInfo {
    const client = this.ensureConnectedClient();
    const version = client.getServerVersion();
    return {
      name: version?.name ?? this.options.serverId,
      version: version?.version ?? "unknown",
      protocolVersion: this.transportProtocolVersion(),
      capabilities: (client.getServerCapabilities() ?? {}) as MCPServerCapabilities,
    };
  }

  private transportProtocolVersion(): string {
    const transport = this.transport;
    if (transport && "protocolVersion" in transport) {
      const value = transport.protocolVersion;
      if (typeof value === "string") return value;
    }
    return "2025-11-25";
  }

  private clientCapabilities(): Record<string, unknown> {
    return this.options.autoAcceptEmptyForm
      ? { elicitation: { form: {} } }
      : {};
  }

  private requestOptions(): { timeout: number } {
    return { timeout: this.requestTimeoutMs() };
  }

  private async withTimeout<T>(method: string, operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (isTimeoutError(error)) {
        throw new Error(
          `MCP ${this.options.timeoutLabel} request timed out after ${this.requestTimeoutMs()}ms: ${method}`,
        );
      }
      throw error;
    }
  }

  private requestTimeoutMs(): number {
    return this.options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  }
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && /timed out|timeout/i.test(error.message);
}

function isEmptyFormElicitation(params: unknown): boolean {
  if (!isRecord(params) || !isRecord(params.requestedSchema)) return false;
  const schema = params.requestedSchema;
  if (schema.type !== "object") return false;
  if (Array.isArray(schema.required) && schema.required.length > 0) return false;
  return !isRecord(schema.properties) || Object.keys(schema.properties).length === 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
