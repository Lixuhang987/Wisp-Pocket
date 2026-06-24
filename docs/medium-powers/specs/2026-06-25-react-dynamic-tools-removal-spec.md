# React Dynamic Tools Removal Spec

## Background

HandAgent 当前 dynamic tool 的真实 provider 在 Swift desktop：Swift 通过 `/api/dynamic-tools` 发送 provider hello，处理 `host_macos.*` 和 plugin namespace 的 tool call。Swift PromptPanel 和 AgentTrigger 创建 thread 时，会通过 Swift `/api/thread` client 在 `thread.start.payload.dynamicTools` 中带上当前 host / plugin dynamic tool specs。

React ThreadWindow 当前也收到一份默认 dynamic tools：Swift 启动 Electron 时把 dynamic tools 写入环境变量，Electron main 解析后通过 ThreadWindow preload 注入 `window.handAgentThreadWindowConfig.defaultDynamicTools`，React 再在 initial prompt fallback 或 React 新建 thread 时把它写入 `thread.start.payload.dynamicTools`。

这让 React 上下文承担了它不需要理解的运行时 tool 配置，并扩大了 dynamic tool 在 UI 层的传播面。React 的职责应保持为 thread UI、历史、消息、composer、permission/workspace 请求；React 创建的 thread 没有 dynamic tools 是预期行为。

## Goal

删除 React ThreadWindow 上下文中的 dynamic tool 数据。React renderer 不再读取、校验、保存、透传或发送 `DynamicToolSpec[]`。

Electron preload 注入给 ThreadWindow 的配置只保留 thread WebSocket URL、`availableSkills`、theme 和 initial prompt receiver 等 UI 必需内容，不再包含 `defaultDynamicTools`。

React 发起的 `thread.start` 不再携带 `payload.dynamicTools`。fallback initial prompt 流程和 React 新建空白 thread 流程都只创建 thread 并提交用户输入，不附带 dynamic tool 候选集合；这些 thread 不具备 dynamic tools。

Swift 侧 dynamic tool provider、Swift PromptPanel / AgentTrigger 的 `thread.start(dynamicTools)` 路径保持不变。core、agent-server、thread-store 对 dynamic tools 的协议和持久化能力也保持不变。

## Non-Goals

- 不删除 `/api/dynamic-tools`。
- 不删除 `DynamicToolSpec`、`DynamicToolAdapter` 或 thread metadata 中的 `dynamicTools` 能力。
- 不删除 Swift `DynamicToolProviderConnectionClient`、`DynamicToolProviderService`、`MacHostDynamicTools` 或 plugin dynamic tool manager。
- 不改变 Swift PromptPanel 和 AgentTrigger 创建 thread 时携带 dynamic tools 的行为。
- 不为 React 创建的 thread 设计 dynamic tools 注入、补发、恢复或替代机制。
- 不改变 composer slash skill 的 `availableSkills` 注入；skill/action 候选仍属于 React UI 上下文。

## Use Cases

- 触发：Electron 预热或打开 ThreadWindow。
- 预期结果：preload config 不再包含 `defaultDynamicTools`；React renderer 上下文中无法读取 dynamic tool specs。

- 触发：React fallback initial prompt 流程创建 thread。
- 预期结果：React 发送的 `thread.start` 不包含 `payload.dynamicTools`，随后仍按原流程提交首轮 `UserInput`；该 thread 没有 dynamic tools。

- 触发：用户在 React ThreadWindow 中新建空白 thread。
- 预期结果：React 发送的 `thread.start` 不包含 `payload.dynamicTools`，UI 仍能创建并展示 thread；该 thread 没有 dynamic tools。

- 触发：Swift PromptPanel 或 AgentTrigger 创建 thread。
- 预期结果：Swift 继续从 `DynamicToolProviderService.dynamicToolSpecs` 读取 host / plugin dynamic tools，并写入 `thread.start.payload.dynamicTools`。

- 触发：LLM 在含有 dynamic tools metadata 的 Swift 创建 thread 中调用 host/plugin dynamic tool。
- 预期结果：tool call 仍通过 agent-server `/api/dynamic-tools` 路由到 Swift provider，行为不受 React 删除 dynamic tool 上下文影响。

- 触发：开发者检查 React / Electron renderer 代码。
- 预期结果：`apps/thread-window-web` 不再 import `DynamicToolSpec`，不再有 `getDefaultDynamicTools`，`ThreadSocketClient` 不再接收 `defaultDynamicTools` option；Electron ThreadWindow preload 和 prewarmer 不再传递 default dynamic tools。
