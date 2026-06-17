import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { StreamableHttpMCPServerConfig } from "./MCPConfig.ts";
import { SDKMCPClientAdapter } from "./SDKMCPClientAdapter.ts";

type HttpServerConfig = StreamableHttpMCPServerConfig;

export class StreamableHttpMCPClient extends SDKMCPClientAdapter {
  constructor(private readonly config: HttpServerConfig) {
    super({
      serverId: config.id,
      timeoutLabel: "HTTP",
    });
  }

  protected createTransport(): Transport {
    return new StreamableHTTPClientTransport(new URL(this.config.url), {
      requestInit: {
        headers: this.config.headers ?? {},
      },
    });
  }
}
