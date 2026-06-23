# Plugin System Spec

## Background

HandAgent 当前有三类工具来源：core 内置工具、`~/.spotAgent/mcp.json` 中的全局 MCP server，以及 Swift desktop 通过 `/api/platform` 提供的 macOS 原生能力。`/api/platform` 只服务内置平台工具，无法覆盖 plugin、浏览器扩展、开发者自建前端等多个调用端。

仓库中已经有 `dynamicTools` 的持久化雏形：thread store 可在 thread metadata 中保存 dynamic tool spec，但 runtime 还没有把它作为统一工具调用模型。目标是把这条雏形补成正式能力，并用它替代 `/api/platform`。

## Goal

引入统一的 dynamic tool 机制：thread 创建时携带可启用的 `dynamicTools` 候选集合，core 保存这些 tool spec，并在 LLM 调用 `use_tools` 后把它们暴露给模型。LLM 调用 dynamic tool 时，core 产生 tool call request，agent-server 转发给对应 provider，provider 回传 tool response，core 再继续当前 turn。

Swift desktop 是默认 dynamic tool provider。原先通过 `/api/platform` 暴露的 macOS 能力迁移为 Swift 默认注册的 dynamic tools，并在 Swift 宿主创建的所有 thread 中默认进入候选集合。`/api/platform` 删除，`PlatformAdapter` / `RemotePlatformAdapter` 不再承担 macOS tool 调用链路。

Plugin 生命周期由 Swift 控制。常驻 plugin 可以在 App 启动后持续运行并注册 dynamic tools；只暴露 tool 的 plugin 可以由 Swift 按设置或需要启动。agent-server 不 spawn plugin binary，只负责保存 tool spec、路由 dynamic tool call request、等待 provider response。

## Non-Goals

- 第三方 plugin 分发市场、自动更新或签名校验。
- Plugin 沙盒、安全隔离和权限 UI 的完整设计。
- MCP `resources` / `prompts` 作为 plugin 对外能力暴露。
- 将 workspace / file 工具迁移为 dynamic tools；这些 Node/core 侧工具继续保留现有 workspace 沙箱与 thread 权限模型。
- 让 Swift desktop 直接持有 `/api/thread` client 或直接创建 thread。

## Use Cases

### UC1: 默认 macOS 能力作为 dynamic tools 进入 thread

- 触发：用户通过 PromptPanel、ThreadWindow 新建空白 thread，或后台 AgentTrigger 创建 thread。
- 结果：Swift 宿主提供的默认 host dynamic tools 被写入 `thread.start.payload.dynamicTools`，并随 thread metadata 持久化；未激活前模型仍只看到 `use_tools`。

### UC2: LLM 激活工具后调用默认 host tool

- 触发：LLM 在某个 thread 中调用 `use_tools`。
- 结果：该 thread 的 builtin Node tools、MCP tools 和 dynamic tools 一起暴露；后续 LLM 调用如 `host_macos.screen_capture` 时，core 发出 dynamic tool call request，Swift provider 执行并回传结果。

### UC3: Swift 控制 plugin 生命周期

- 触发：用户启用常驻 plugin，或选择某个只提供 tool 的 plugin。
- 结果：Swift 启动并管理对应 plugin；plugin 注册的 dynamic tools 加入新 thread 的候选集合，或按用户选择加入指定 thread 的候选集合。agent-server 不拥有 plugin 进程。

### UC4: 多调用端共享同一 dynamic tool 模型

- 触发：未来浏览器扩展或开发者自建前端连接 agent-server 并注册 tool provider。
- 结果：调用端只需提供 `DynamicToolSpec` 和处理 tool call request / response；core runtime 不需要区分工具来自 Swift、plugin、浏览器扩展还是自建前端。

### UC5: Dynamic tools 可恢复和可审计

- 触发：thread 被持久化、恢复或历史回放。
- 结果：thread metadata 中保存创建时的 `dynamicTools`，恢复后仍能知道该 thread 允许哪些 dynamic tools；动态工具调用过程以 request / response 事件进入审计和历史记录。
