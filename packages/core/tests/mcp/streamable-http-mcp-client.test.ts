import { createServer } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { StreamableHttpMCPClient } from "../../src/mcp/StreamableHttpMCPClient.ts";

describe("StreamableHttpMCPClient", () => {
  const servers: Array<{ close: () => void }> = [];

  afterEach(() => {
    for (const server of servers.splice(0)) server.close();
  });

  it("sends MCP protocol header and reads json-rpc responses", async () => {
    const server = createServer((req, res) => {
      if (req.method === "GET") {
        res.statusCode = 405;
        res.end();
        return;
      }

      let body = "";
      req.setEncoding("utf8");
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", () => {
        const rpc = JSON.parse(body);
        res.setHeader("content-type", "application/json");
        if (rpc.method !== "initialize" && rpc.method !== "notifications/initialized") {
          expect(req.headers["mcp-protocol-version"]).toBe("2025-11-25");
        }
        if (rpc.method === "initialize") {
          res.end(
            JSON.stringify({
              jsonrpc: "2.0",
              id: rpc.id,
              result: {
                protocolVersion: "2025-11-25",
                capabilities: { tools: {} },
                serverInfo: { name: "echo", version: "1.0.0" },
              },
            }),
          );
        } else if (rpc.method === "tools/list") {
          res.end(
            JSON.stringify({
              jsonrpc: "2.0",
              id: rpc.id,
              result: {
                tools: [{ name: "echo", inputSchema: { type: "object" } }],
              },
            }),
          );
        } else if (rpc.method === "tools/call") {
          res.end(
            JSON.stringify({
              jsonrpc: "2.0",
              id: rpc.id,
              result: {
                content: [{ type: "text", text: rpc.params.arguments.text }],
              },
            }),
          );
        } else if (rpc.method === "notifications/initialized") {
          res.statusCode = 202;
          res.end();
        } else {
          res.end(JSON.stringify({ jsonrpc: "2.0", id: rpc.id, result: {} }));
        }
      });
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("bad address");

    const client = new StreamableHttpMCPClient({
      id: "echo",
      title: "Echo",
      transport: "streamableHttp",
      url: `http://127.0.0.1:${address.port}/mcp`,
    });

    await client.initialize();
    await expect(client.listTools()).resolves.toEqual([
      { name: "echo", description: undefined, inputSchema: { type: "object" } },
    ]);
    await expect(client.callTool("echo", { text: "hello" })).resolves.toEqual({
      content: [{ type: "text", text: "hello" }],
    });
  });

  it("starts the SDK SSE stream after accepted initialized notification", async () => {
    const seenMethods: string[] = [];
    const server = createServer((req, res) => {
      seenMethods.push(req.method ?? "");
      if (req.method === "GET") {
        res.statusCode = 405;
        res.end();
        return;
      }

      let body = "";
      req.setEncoding("utf8");
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", () => {
        const rpc = JSON.parse(body);
        res.setHeader("content-type", "application/json");
        if (rpc.method === "initialize") {
          res.end(
            JSON.stringify({
              jsonrpc: "2.0",
              id: rpc.id,
              result: {
                protocolVersion: "2025-11-25",
                capabilities: { tools: {} },
                serverInfo: { name: "sdk-http", version: "1.0.0" },
              },
            }),
          );
        } else if (rpc.method === "notifications/initialized") {
          res.statusCode = 202;
          res.end();
        } else if (rpc.method === "tools/list") {
          res.end(JSON.stringify({ jsonrpc: "2.0", id: rpc.id, result: { tools: [] } }));
        } else {
          res.end(JSON.stringify({ jsonrpc: "2.0", id: rpc.id, result: {} }));
        }
      });
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("bad address");

    const client = new StreamableHttpMCPClient({
      id: "sdk-http",
      title: "SDK HTTP",
      transport: "streamableHttp",
      url: `http://127.0.0.1:${address.port}/mcp`,
    });

    await client.initialize();
    await client.listTools();

    expect(seenMethods[0]).toBe("POST");
    expect(seenMethods).toEqual(expect.arrayContaining(["POST", "GET"]));
    expect(seenMethods).toContain("POST");
  });

  it("parses event-stream json-rpc response data", async () => {
    const server = createServer((req, res) => {
      if (req.method === "GET") {
        res.statusCode = 405;
        res.end();
        return;
      }

      let body = "";
      req.setEncoding("utf8");
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", () => {
        const rpc = JSON.parse(body);
        res.setHeader("content-type", "text/event-stream");
        if (rpc.method === "initialize") {
          res.setHeader("content-type", "application/json");
          res.end(
            JSON.stringify({
              jsonrpc: "2.0",
              id: rpc.id,
              result: {
                protocolVersion: "2025-11-25",
                capabilities: { tools: {} },
                serverInfo: { name: "sse", version: "1.0.0" },
              },
            }),
          );
        } else if (rpc.method === "notifications/initialized") {
          res.statusCode = 202;
          res.end();
        } else {
          res.end(
            `event: message\ndata: ${JSON.stringify({
              jsonrpc: "2.0",
              id: rpc.id,
              result: { tools: [] },
            })}\n\n`,
          );
        }
      });
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("bad address");

    const client = new StreamableHttpMCPClient({
      id: "sse",
      title: "SSE",
      transport: "streamableHttp",
      url: `http://127.0.0.1:${address.port}/mcp`,
    });

    await client.initialize();
    await expect(client.listTools()).resolves.toEqual([]);
  });
});
