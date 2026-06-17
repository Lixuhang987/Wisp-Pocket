import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { StdioMCPServerConfig } from "./MCPConfig.ts";
import { SDKMCPClientAdapter } from "./SDKMCPClientAdapter.ts";

type StdioServerConfig = StdioMCPServerConfig;

export class StdioMCPClient extends SDKMCPClientAdapter {
  constructor(private readonly config: StdioServerConfig) {
    super({
      serverId: config.id,
      timeoutLabel: "stdio",
      requestTimeoutMs: config.requestTimeoutMs,
      autoAcceptEmptyForm: config.elicitation?.autoAcceptEmptyForm,
    });
  }

  protected createTransport(): Transport {
    return new StdioClientTransport({
      command: this.config.command,
      args: this.config.args,
      env: this.config.env,
      cwd: this.config.cwd,
      stderr: "pipe",
    });
  }
}
