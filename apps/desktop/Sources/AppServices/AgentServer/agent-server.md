# AgentServer 模块

本目录不再由 Swift 启动 agent-server。agent-server 进程由 `apps/electron-shell` 监督；Swift 保留健康状态协议、窄口径 thread submit client、dynamic tool provider WebSocket client，以及 Electron launch 所需的仓库根定位器。

## 文件

| 文件 | 职责 |
|------|------|
| `AppServer.swift` | `AppServerManaging` 协议与 `DynamicToolProviderConnectionClient`；协议暴露 availability、fatal error 和 Electron clean exit 触发的宿主退出请求，后者连接 `/api/dynamic-tools`，发送 `provider_hello`，处理 `tool_call_request` 并回写 `tool_call_response` |
| `SwiftThreadClient.swift` | 窄口径 `/api/thread` client：PromptPanel 提交时发送 `thread.start` 和首轮 `op.submit`，拿到 `thread.started.threadId` 后交给 Electron 打开或聚焦 React ThreadWindow |
| `AgentServerHealth.swift` | 主线程健康状态桥：订阅 `AppServerManaging` 可用性与 fatal error，向 PromptPanel 暴露可提交状态，并在需要时调用原生 fatal alert |
| `AgentServerRuntimeMode.swift` | 读取 bundle resource marker 与环境变量，决定 Electron supervisor 是否注入 `HANDAGENT_LLM_MODE=mock` |
| `AgentServerRepositoryRootLocator.swift` | 用于 Electron launch config 定位 worktree 或 packaged resources |
| `AppServerConnection.swift` | 单条 WebSocket 连接抽象：处理 connect / reconnect / receive loop / 原始文本收发 |

## 职责

1. Swift 通过 `DynamicToolProviderConnectionClient` 连接 `ws://127.0.0.1:4317/api/dynamic-tools`。
2. 连接成功后发送 `channel: "dynamic_tools"` 的 `provider_hello`，注册默认 `swift-host` / `host_macos` 工具。
3. 收到 `tool_call_request` 后交给 `DynamicToolProviderService`，再通过同一 socket 回写 `tool_call_response`。
4. PromptPanel 提交和 AgentTrigger 命中时，Swift 通过 `SwiftThreadClient` 连接 `ws://127.0.0.1:4317/api/thread`，发送带默认 dynamic tools 的 `thread.start`，收到 `thread.started.threadId` 后发送首轮 `op.submit(UserInput)`；PromptPanel 路径随后通知 Electron 打开或聚焦 ThreadWindow，AgentTrigger 路径只创建后台 thread。
5. `AgentServerHealth` 只观察 `ElectronBackedAppServer` 暴露的 availability/fatal 状态，不直接启动或停止 Node 子进程。
6. Electron 前台收到 `Command+Q` 后可能先 clean exit；该路径由 `AppServerManaging.onHostTerminationRequest` 交给 Coordinator 调用宿主 `NSApplication.terminate`，不走 fatal alert。

桌面端不订阅 `/api/activity`，也不 mirror React ThreadWindow 状态。Swift `/api/thread` client 只负责 PromptPanel 和 AgentTrigger 的首轮直连提交；ThreadWindow 的持续 thread 协议由 React 前端通过 `/api/thread?acceptServerRequests=1` 处理，StatusBubble 的 activity 协议由 Electron ActivityWindow renderer 通过 `/api/activity` 处理。

## 编辑此目录的约束

- 除 `AgentServerHealth.swift` 作为健康状态与原生 fatal alert 的桥接外，不要在此处新增 `SwiftUI` / `AppKit` 依赖。
- 不要重新引入 Swift 侧 agent-server 子进程启动器或 `/api/activity` subscriber。
- 修改 TS 源码后必须重启 desktop app 才能让 Electron 监督的 agent-server 重新加载。

## 与其他模块的关系

- [Coordinator](/Users/mu9/proj/handAgent/apps/desktop/Sources/Coordinator/coordinator.md) 在 `bootstrap()` 调 `start()`，在 `shutdown()` 调 `stop()`；订阅 `onAvailabilityChange`、`onFatalError` 与 `onHostTerminationRequest`。
- [ElectronShell](/Users/mu9/proj/handAgent/apps/desktop/Sources/AppServices/ElectronShell/electron-shell.md) 通过 `ElectronBackedAppServer` 暴露 app-server health、ThreadWindow command client 和 ActivityWindow command client。
- [PlatformBridge](/Users/mu9/proj/handAgent/apps/desktop/Sources/AppServices/PlatformBridge/platform-bridge.md) 走独立 `/api/dynamic-tools` WebSocket，通过 `channel: "dynamic_tools"` 处理 host / plugin dynamic tools。
