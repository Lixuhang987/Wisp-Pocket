# AgentServer 模块

本目录不再由 Swift 启动 agent-server。agent-server 进程由 `apps/electron-shell` 监督；Swift 保留健康状态协议、窄口径 Thread 提交与 Pet 管理 client、dynamic tool provider WebSocket client，以及 Electron launch 所需的仓库根定位器。

## 文件

| 文件 | 职责 |
|------|------|
| `AppServer.swift` | `AppServerManaging` 协议与 `DynamicToolProviderConnectionClient`；协议暴露 availability、fatal error 和 Electron clean exit 触发的宿主退出请求，后者连接 `/api/dynamic-tools`，发送 `provider_hello`，处理 `tool_call_request` 并回写 `tool_call_response` |
| `PetManagement.swift` | Pet / Workspace DTO 和后端查询入口；Pet 带固定 workspaceId，rootPath 为所属项目派生位置 |
| `SwiftThreadClient.swift` | 窄口径 `/api/thread` client：PromptPanel 提交时发送 `thread.start` 和首轮 `op.submit`，拿到 `thread.started.threadId` 后交给 Electron 打开或聚焦 React ThreadWindow |
| `AgentServerHealth.swift` | 主线程健康状态桥：订阅 `AppServerManaging` 可用性与 fatal error，向 PromptPanel 暴露可提交状态，并在需要时调用原生 fatal alert |
| `AgentServerRuntimeMode.swift` | 读取 bundle resource marker 与环境变量，决定 Electron supervisor 是否注入 `HANDAGENT_LLM_MODE=mock` |
| `AgentServerRepositoryRootLocator.swift` | 用于 Electron launch config 定位 worktree 或 packaged resources |
| `AppServerConnection.swift` | 单条 WebSocket 连接抽象：处理 connect / reconnect / receive loop / 原始文本收发 |

## 职责

1. Swift 通过 `DynamicToolProviderConnectionClient` 连接 `ws://127.0.0.1:4317/api/dynamic-tools`。
2. 连接成功或内置功能启用选择变化时发送 `channel: "dynamic_tools"` 的 `provider_hello`，声明 `swift-host` 的原生工具与当前启用的业务工具。
3. 收到 `tool_call_request` 后交给 `DynamicToolProviderService`，再通过同一 socket 回写 `tool_call_response`。
4. PromptPanel 提交和 AgentTrigger 命中时，Swift 通过 `SwiftThreadClient` 连接 `ws://127.0.0.1:4317/api/thread`，手动输入先查询默认 Pet，AgentTrigger 使用明确 targetPetId，再发送带 petId 与默认 dynamic tools 的 `thread.start`，收到 `thread.started.threadId` 后发送首轮 `op.submit(UserInput)`；PromptPanel 路径随后通知 Electron 打开或聚焦 ThreadWindow，AgentTrigger 路径只创建后台 thread。
5. `AgentServerHealth` 只观察 `ElectronBackedAppServer` 暴露的 availability/fatal 状态，不直接启动或停止 Node 子进程。
6. Electron 前台收到 `Command+Q` 后可能先 clean exit；该路径由 `AppServerManaging.onHostTerminationRequest` 交给 Coordinator 调用宿主 `NSApplication.terminate`，不走 fatal alert。

Swift `/api/thread` client 负责 PromptPanel 和 AgentTrigger 首轮直连提交，以及 AgentTrigger 的 Pet 身份查询；Pet 配置只从服务端读写，不直写 JSON。ThreadWindow 与桌宠各自通过 `/api/thread?acceptServerRequests=1` 消费完整 Thread 投影并回复交互请求；Swift 不 mirror 这些状态，也不订阅 Activity。桌宠的连接与输入边界见 [Electron UI Shell](../../../../electron-shell/electron-shell.md)。

## 编辑此目录的约束

- 除 `AgentServerHealth.swift` 作为健康状态与原生 fatal alert 的桥接外，不要在此处新增 `SwiftUI` / `AppKit` 依赖。
- 不要重新引入 Swift 侧 agent-server 子进程启动器或 `/api/activity` subscriber。
- 修改 TS 源码后必须重启 desktop app 才能让 Electron 监督的 agent-server 重新加载。
- 同一连接刷新工具声明时必须保留在途调用；只有真实断连或 Provider 身份替换才走 offline 清理。对应服务端规则见 [server](../../../../agent-server/src/server/server.md)。Swift 在创建时显式提交当时的工具集合；桌宠与 ThreadWindow 未指定集合时由服务端选取当前在线声明。hello 不重写既有 Thread metadata，旧连接的声明刷新也不能覆盖新连接。

## 与其他模块的关系

- [Coordinator](/Users/mu9/proj/handAgent/apps/desktop/Sources/Coordinator/coordinator.md) 在 `bootstrap()` 调 `start()`，在 `shutdown()` 调 `stop()`；订阅 `onAvailabilityChange`、`onFatalError` 与 `onHostTerminationRequest`。
- [ElectronShell](/Users/mu9/proj/handAgent/apps/desktop/Sources/AppServices/ElectronShell/electron-shell.md) 通过 `ElectronBackedAppServer` 暴露 app-server health、ThreadWindow command client 和 ActivityWindow command client。
- [PlatformBridge](../PlatformBridge/platform-bridge.md) 走独立 `/api/dynamic-tools` WebSocket，通过 `channel: "dynamic_tools"` 处理原生与 Automation 工具。

Pet 命令使用现有 type / commandId / timestamp 信封。图片为受管 imageRef，不广播 bytes；更新带 expectedRevision，根目录不进入 patch。管理响应失败、断连与超时必须返回可见错误，调用方显示错误。PromptPanel 的默认 Pet 在每次新建前读取，AgentTrigger 的明确目标失败不会改投默认宠；双方协议以 [后端 server](../../../../agent-server/src/server/server.md) 为准。
