# mcp

标准 MCP client 与 tool adapter。第一版支持 `stdio` 和 `Streamable HTTP`，按 MCP `2025-11-25` 稳定规范实现完整客户端能力：`tools`、`prompts`、`resources` 三类 server-side primitive 全部覆盖。`~/.spotAgent/mcp.json` 中配置的 server 作为全局 MCP tools 注入 thread tool registry。

| 文件 | 职责 |
|------|------|
| `MCPConfig.ts` | 用 `zod` 解析 `~/.spotAgent/mcp.json`，含 stdio elicitation 策略与 Streamable HTTP headers 环境变量插值 |
| `MCPClient.ts` | MCP client 接口：`initialize` / `tools/*` / `prompts/*` / `resources/*` |
| `MCPDescriptions.ts` | stdio / Streamable HTTP client 共享的 tool、prompt、resource description 归一化 |
| `SDKMCPClientAdapter.ts` | `@modelcontextprotocol/sdk` Client 包装层，统一 `MCPClient` DTO 转换、request timeout 和空表单 elicitation 策略 |
| `StdioMCPClient.ts` | 基于 `@modelcontextprotocol/sdk/client/stdio.js` 的 stdio transport 适配 |
| `StreamableHttpMCPClient.ts` | 基于 `@modelcontextprotocol/sdk/client/streamableHttp.js` 的 Streamable HTTP transport 适配 |
| `MCPToolAdapter.ts` | 把 MCP tool 包装为 `AgentTool`，暴露名为 `mcp.<serverId>.<toolName>` |

## Client 接口

`MCPClient` 接口覆盖 server 的三类 primitive：

- `initialize() => MCPServerInfo`：握手并返回 `protocolVersion`、`serverInfo`、`capabilities`。完成后立即发送 `notifications/initialized`。
- `listTools()` / `callTool(name, args)`：tool 列表与调用，结果为 `MCPCallToolResult { content, isError? }`。
- `listPrompts()` / `getPrompt(name, args?)`：prompt 模板列表与展开，返回 `messages: { role, content }[]`。
- `listResources()` / `readResource(uri)`：资源列表与读取，内容为 `text` 或 base64 `blob`。
- `serverInfo()`：本地缓存的 capabilities，`refreshForThread` 等上层逻辑可按 capability 决定是否调用对应 endpoint。

## 配置形状

```json
{
  "version": 1,
  "servers": [
    {
      "id": "github",
      "title": "GitHub",
      "transport": "stdio",
      "command": "node",
      "args": ["server.js"],
      "cwd": "/path/to/server",
      "requestTimeoutMs": 60000,
      "env": { "TOKEN": "..." },
      "elicitation": { "autoAcceptEmptyForm": true }
    },
    {
      "id": "docs",
      "title": "Docs",
      "transport": "streamableHttp",
      "url": "https://example.com/mcp",
      "headers": { "Authorization": "Bearer ${DOCS_TOKEN}" }
    }
  ]
}
```

## 约束

- `mcp.json` 中配置的所有 server 默认作为**全局** MCP server，会被注入每个 thread 的 tool registry。
- MCP exposed tool name 统一为 `mcp.<serverId>.<toolName>`，避免与 builtin tool 冲突。
- `computer_use` / `computer-use` 不再有 Wisp Pocket 原生兼容 client；如需使用，必须在 `~/.spotAgent/mcp.json` 中配置真实 MCP transport。macOS host 能力走 Swift dynamic tools，不走 MCP 兼容层。
- stdio server 可配置 `cwd`；也可配置 `requestTimeoutMs`，默认 60s，避免外部 server 卡死时拖挂当前 thread run。
- stdio server 可配置 `elicitation.autoAcceptEmptyForm: true`。该选项只自动接受 `requestedSchema` 为空对象且无必填字段的 form-mode `elicitation/create`，用于 Computer Use 这类本地 App 授权握手；带字段表单或 URL mode 仍返回 decline，不代替用户填写敏感信息或打开外部 URL。
- stdio 与 Streamable HTTP 的 JSON-RPC 编码、初始化握手、session header、SSE 响应处理和 transport lifecycle 由官方 `@modelcontextprotocol/sdk` 承担；本模块只保留 Wisp Pocket 配置、DTO 转换和 timeout 文案。
- `MCPConfig.ts` 只解析配置；client 生命周期、capability 缓存与 prompt/resource 调用由 agent-server 的 `MCPServerRegistry` 管理。
- Streamable HTTP headers 支持 `${ENV_NAME}` 插值，未设置的环境变量会替换为空字符串。
- stdio 与 Streamable HTTP 的 description 归一化必须复用 `MCPDescriptions.ts`，避免 prompt/resource/tool 字段默认值漂移。

## 测试

- [stdio-mcp-client.test.ts](/Users/mu9/proj/handAgent/packages/core/tests/mcp/stdio-mcp-client.test.ts) / [streamable-http-mcp-client.test.ts](/Users/mu9/proj/handAgent/packages/core/tests/mcp/streamable-http-mcp-client.test.ts) — 基础链路。
- [mcp-config.test.ts](/Users/mu9/proj/handAgent/packages/core/tests/mcp/mcp-config.test.ts) — MCPConfig zod 解析、环境变量插值和 elicitation 配置校验。
- [mcp-use-cases.test.ts](/Users/mu9/proj/handAgent/packages/core/tests/mcp/mcp-use-cases.test.ts) — 自建 stdio mock server，覆盖 tools + prompts + resources 完整协议。
- [mcp-real-server.integration.test.ts](/Users/mu9/proj/handAgent/packages/core/tests/mcp/mcp-real-server.integration.test.ts) — 通过 `npx @modelcontextprotocol/server-filesystem` 拉起真实参考实现做端到端验证。

## 实现约束

- `StdioMCPClient` 和 `StreamableHttpMCPClient` 不直接拼装 JSON-RPC 消息；新增 MCP transport 能力时优先复用官方 SDK transport，再在 `SDKMCPClientAdapter` 中做 Wisp Pocket 接口适配。
