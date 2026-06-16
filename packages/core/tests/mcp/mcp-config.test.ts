import { describe, expect, it } from "vitest";
import { parseMCPConfig } from "../../src/mcp/MCPConfig.ts";

describe("parseMCPConfig", () => {
  it("parses stdio and streamable http servers", () => {
    const config = parseMCPConfig({
      version: 1,
      servers: [
        {
          id: "fs",
          title: "FS",
          transport: "stdio",
          command: "node",
          args: ["server.js"],
          cwd: "/tmp/mcp",
          requestTimeoutMs: 5_000,
          elicitation: { autoAcceptEmptyForm: true },
        },
        {
          id: "github",
          title: "GitHub",
          transport: "streamableHttp",
          url: "https://example.com/mcp",
        },
      ],
    });

    expect(config.servers.map((server) => server.id)).toEqual(["fs", "github"]);
    expect(config.servers[0]).toMatchObject({
      cwd: "/tmp/mcp",
      requestTimeoutMs: 5_000,
      elicitation: { autoAcceptEmptyForm: true },
    });
  });

  it("interpolates streamable http headers from environment variables", () => {
    process.env.HANDAGENT_MCP_TEST_TOKEN = "secret";
    try {
      const config = parseMCPConfig({
        version: 1,
        servers: [
          {
            id: "docs",
            title: "Docs",
            transport: "streamableHttp",
            url: "https://example.com/mcp",
            headers: { Authorization: "Bearer ${HANDAGENT_MCP_TEST_TOKEN}" },
          },
        ],
      });

      expect(config.servers[0]).toMatchObject({
        headers: { Authorization: "Bearer secret" },
      });
    } finally {
      delete process.env.HANDAGENT_MCP_TEST_TOKEN;
    }
  });

  it("throws clear validation messages for invalid config shape", () => {
    expect(() => parseMCPConfig(null)).toThrow("mcp config must be an object");
    expect(() => parseMCPConfig({ version: 2, servers: [] })).toThrow(
      "mcp config version must be 1",
    );
    expect(() => parseMCPConfig({ version: 1, servers: "bad" })).toThrow(
      "mcp config servers must be an array",
    );
    expect(() => parseMCPConfig({
      version: 1,
      servers: [{ id: "bad", title: "Bad", transport: "other" }],
    })).toThrow("mcp server transport must be stdio or streamableHttp");
    expect(() => parseMCPConfig({
      version: 1,
      servers: [{ id: "bad", title: "Bad", transport: "stdio", command: "node", args: [1] }],
    })).toThrow("mcp args must be a string array");
  });
});
