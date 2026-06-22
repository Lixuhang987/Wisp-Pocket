# Plugin System Spec

## Background

HandAgent 当前的 "skill" 机制仅提供提示词追加能力——用户在 PromptPanel 选择一个 skill 后，其 template 文本拼入 system prompt，LLM 获得额外上下文但没有新的可执行工具。

系统已有 MCP server 集成（`MCPServerRegistry` + `SDKMCPClientAdapter`），但生命周期是 server 级 lazy init、跨 thread 共享，与 codex 的 session-scoped 模型不一致。

用户需要一种方式让 LLM 调用真实的客户端系统能力（accessibility、屏幕操作、app 控制等），这些能力需要原生 macOS API，无法用 Node.js 实现。

## Goal

引入 plugin 概念：一个 plugin 是一个预编译 Swift binary，实现 MCP 协议（stdin/stdout JSON-RPC），同时附带一段提示词和 UI 元数据。用户在 PromptPanel 显式选择 plugin 后，agent-server 在 thread 创建时 spawn plugin 进程，将其 tools 注册到该 thread 的 tool registry，将其 prompt 注入 system prompt。LLM 即可调用 plugin 提供的工具，tool call 通过 MCP `tools/call` 到达 plugin binary 执行。

同时将现有 MCP server 的生命周期统一改为 thread-scoped（对齐 codex 的 `McpConnectionManager` 模式）：所有 MCP 进程在 thread 创建时启动，thread 结束时关闭。

## Non-Goals

- 第三方 plugin 分发市场 / 自动更新机制
- Plugin 沙盒 / 代码签名验证（后续安全迭代）
- Plugin 间通信或依赖声明
- MCP 协议的 resources / prompts 能力暴露给 LLM（本期只用 tools）
- Plugin 的热重载（修改后需重新开始 thread）

## Use Cases

### UC1: 用户选择 plugin 并在对话中使用

- 触发：用户在 PromptPanel 输入 trigger 或搜索，看到按 skill / plugin 分栏的列表，选中一个 plugin（如 "screen-reader"），作为 chip 出现在 composer 中
- 结果：提交后 agent-server 创建 thread 时 spawn screen-reader binary，其 tools 可被 LLM 调用

### UC2: 常驻 plugin 自动附加

- 触发：用户在 plugin 设置页面将某个 plugin 设为"常驻触发"
- 结果：每次新建 thread 时，该 plugin 自动 spawn 并注入，无需手动选择

### UC3: 多 plugin + 多 skill 同时使用

- 触发：用户在一次提交中同时选中 2 个 plugin 和 1 个 skill
- 结果：2 个 plugin binary 同时 spawn，各自的 tools 都注册到 thread，skill 的 prompt 也一并注入

### UC4: Thread 结束时清理 plugin 进程

- 触发：thread 结束（用户关闭、超时、或 agent idle）
- 结果：该 thread 关联的所有 MCP 进程（含 plugin）被 close/kill，资源释放

### UC5: Plugin 开发者创建 plugin

- 触发：开发者在 `~/.spotAgent/plugins/<id>/` 放置 `plugin.json` manifest 和编译好的 binary
- 结果：HandAgent 启动时或 PromptPanel 展示时扫描到该 plugin，列入可选列表
