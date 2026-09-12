import { describe, expect, it } from "vitest";
import type { MCPClient, MCPServerInfo } from "@handagent/core/mcp/MCPClient.ts";
import { MCPServerRegistry } from "../../src/actions/MCPServerRegistry.ts";

describe("MCPServerRegistry", () => {
  it("caches tools per server id", async () => {
    let createCount = 0;
    const registry = new MCPServerRegistry({
      createClient: (serverId) => {
        createCount += 1;
        return makeClient(serverId);
      },
    });

    await expect(registry.listTools("github")).resolves.toHaveLength(1);
    await expect(registry.listTools("github")).resolves.toHaveLength(1);
    expect(createCount).toBe(1);
  });

  it("exposes prompts and resources from server", async () => {
    const registry = new MCPServerRegistry({
      createClient: (serverId) => makeClient(serverId),
    });

    const prompts = await registry.listPrompts("github");
    expect(prompts).toHaveLength(1);
    expect(prompts[0].name).toBe("code_review");

    const result = await registry.getPrompt("github", "code_review", { code: "x" });
    expect(result.messages).toHaveLength(1);

    const resources = await registry.listResources("github");
    expect(resources).toHaveLength(1);
    expect(resources[0].uri).toBe("file:///readme.md");

    const content = await registry.readResource("github", "file:///readme.md");
    expect(content.contents).toHaveLength(1);
    expect(content.contents[0].text).toBe("# Hello");
  });
});

function makeClient(serverId: string): MCPClient {
  const info: MCPServerInfo = {
    name: serverId,
    version: "1.0.0",
    protocolVersion: "2025-11-25",
    capabilities: { tools: {}, prompts: {}, resources: {} },
  };
  return {
    async initialize() { return info; },
    serverInfo() { return info; },
    async listTools() {
      return [
        {
          name: "create_issue",
          description: serverId,
          inputSchema: { type: "object" },
        },
      ];
    },
    async callTool() {
      return { content: [{ type: "text", text: "ok" }] };
    },
    async listPrompts() {
      return [{ name: "code_review", description: "Review code" }];
    },
    async getPrompt(_name, _args) {
      return {
        description: "Review code",
        messages: [{ role: "user", content: { type: "text", text: "Review this" } }],
      };
    },
    async listResources() {
      return [{ uri: "file:///readme.md", name: "readme.md", mimeType: "text/markdown" }];
    },
    async readResource(_uri) {
      return { contents: [{ uri: "file:///readme.md", text: "# Hello", mimeType: "text/markdown" }] };
    },
    async close() {},
  };
}

it("shares concurrent initialization and closes a client that finishes during shutdown", async () => {
  const gate = Promise.withResolvers<void>();
  const client = makeClient("shared");
  let closed = 0; let created = 0;
  client.initialize = async () => { await gate.promise; return client.serverInfo()!; };
  client.close = async () => { closed += 1; };
  const registry = new MCPServerRegistry({ createClient: () => { created += 1; return client; } });
  const requests = Promise.allSettled([registry.getClient("shared"), registry.getClient("shared")]);
  const stopping = registry.closeAll();
  gate.resolve(); await stopping;
  expect((await requests).every((result) => result.status === "rejected")).toBe(true);
  expect(created).toBe(1); expect(closed).toBe(1);
});
