# ElectronShell 模块

`ElectronShell` 是桌面端唯一 UI shell 运行时桥。`AppServices.defaultRuntime` 始终使用 `ElectronBackedAppServer` 作为 app-server health source、Electron ThreadWindow command client 和 ActivityWindow command client。

## 职责

- 启动 Electron 子进程；`HANDAGENT_ELECTRON_BINARY` 指向的路径存在或显式为 `/usr/bin/env` 时覆盖 Electron binary，失效的旧路径会被忽略并从 Electron 子进程环境中移除；`HANDAGENT_ELECTRON_MAIN` 可覆盖 main entry。相对 main 会先按 repo root 解析为绝对路径，避免 pnpm filter 切换目录后重复拼接 `apps/electron-shell`。
- main 与 runtime 独立选择：未覆盖 main 时优先使用包内 `Contents/Resources/ElectronShell/dist/main/main.js`，包内文件不存在才回退 checkout 构建产物。没有有效 binary 覆盖且能定位 repo root 时，始终从该目录通过 `pnpm --filter handagent-electron-shell exec electron <main>` 使用 workspace runtime；未覆盖 main、包内 main 存在且无法定位 repo root 时才回退全局 `electron`。本包不是自包含发行包，依赖边界见 [开发说明](../../../../../docs/dev.md#打包边界)，Electron 侧所有权见 [Electron UI Shell](../../../../electron-shell/electron-shell.md)。
- Swift 启动 Electron 时通过 `HANDAGENT_INITIAL_THEME` 传入当前真实 host theme JSON，字段与 `theme.changed` payload 相同：`{ preference, resolved }`。该值必须来自 `AppearanceThemeService.currentTheme`，不能固定写成 dark 或 light 后再依赖运行时同步纠偏。
- Swift 启动 Electron 时把子进程 stdin 指向 `/dev/null`，避免 Electron CLI 在 pipe stdin 未 EOF 时阻塞加载 main entry；`ElectronShellCommand` 通过 `HANDAGENT_ELECTRON_COMMAND_SOCKET` 指向的本地 Unix domain socket 发送。
- Electron -> Swift 的 `ElectronShellEvent` 通过 stdout newline-delimited JSON 回传。
- 主动停机时先通过 command socket 发送 `shutdown` command；宿主仍运行时，Electron 未在 2 秒内退出才兜底 `terminate()`，主动停机不作为 fatal termination 上报。Swift 进程退出可能先关闭 stdout 读取端，Electron 的 [输出桥](../../../../electron-shell/src/main/swiftBridge/swiftBridge.md)必须容纳回执的 `EPIPE`，继续完成退出。
- Electron 作为前台 ThreadWindow host 收到 `Command+Q` 时可能自行 clean exit；Swift 侧把 `Electron shell exited with status 0` 解释为宿主退出请求，上报给 Coordinator 调用 Swift `NSApplication.terminate`，不弹 fatal alert。非 0 status 仍作为异常退出上报。
- 在 `agent_server.health available=true` 与 `thread_window.prepared` 同时成立后，向 `AgentServerHealth` 暴露可提交状态。
- 作为 `ThreadWindowCommanding` 实现，只接收 Coordinator 的 openInitialPrompt/openHistory/focus/themeChanged 意图；`theme.changed` 不参与 ThreadWindow 可用性 gate。启动初值由 `HANDAGENT_INITIAL_THEME` 提供，运行中变化仍由 `theme.changed` command 提供。
- PromptPanel 经 Swift Thread client 提交后，既有 `focus(threadId:)` 将目标 ID 交给 Electron，再由 renderer 选择并 resume；Swift 不等待 snapshot 或持有当前选择。无目标 focus/openHistory 只操作窗口。字段与失败回执以 [Electron 协议](../../../../electron-shell/src/main/protocol/protocol.md) 为准，成功 ack 不表示目标内容已渲染。
- 作为 `ActivityWindowCommanding` 实现，接收 Coordinator 的 showActivityWindow 意图，并编码为 `activity_window.show`。
- 在 agent-server available 后连接 `/api/dynamic-tools`，由 Swift `DynamicToolProviderService` 执行原生工具，并直接分派到已启用的 Context History / Automation。业务模块生命周期归 [AppServices](../app-services.md)，不随 server health 或窗口关闭而停机。
- visible Electron ThreadWindow 关闭时，通过 `onThreadWindowClosed` 通知 Coordinator 清理打开状态；隐藏预热窗口关闭只影响可提交 gate。
- 桌宠的点击、拖入、回复与历史由 Electron renderer 处理；Swift 只负责显示窗口的 command，不接管桌宠交互。
- `bash ./scripts/swiftw run HandAgentDesktop` 会先构建 `handagent-electron-shell`，确保开发态 `dist/main/main.js` 存在；不要依赖旧 worktree 残留产物。

## 文件

| 文件 | 职责 |
|------|------|
| `ElectronShellProcess.swift` | 启动 Electron 子进程、通过 Unix socket 写入 command JSON line、读取 stdout event JSON line、处理主动停机和非主动退出 |
| `ElectronShellProtocol.swift` | Swift 端 command/event DTO，必须与 TS `electronShellProtocol.ts` 字段一致 |
| `ElectronBackedAppServer.swift` | app-server health gate、ThreadWindow command client、ActivityWindow command client、dynamic tool provider client 和 Swift thread client 连接管理 |
| `ThreadWindowDiagnostics.swift` | 仅供宿主侧排查 ThreadWindow 首次打开/关闭竞态的 stderr 诊断开关；`HANDAGENT_THREADWINDOW_TRACE=1` 时输出 `openHistory`、`hide(restoringFocus:false)`、`command.ack`、`thread_window_closed` 等关键时序 |
| `ThreadWindowCommanding.swift` | Coordinator 面向 ThreadWindow 的 command 抽象：open initial prompt、open history、focus、theme changed |
| `ActivityWindowCommanding.swift` | Coordinator 面向 Electron ActivityWindow 的 show command 抽象 |
| `UserMessageAttachmentPayload.swift` | 旧 attachment DTO 兼容辅助；当前 initial prompt command 主载荷是 `PromptUserInput.items` |

## 可用性 gate

- `ElectronBackedAppServer.isAvailable` 必须同时满足 `agent_server.health available=true`、`thread_window.prepared`、没有 agent-server/thread-window 错误。
- `thread_window.prepare_failed` 或 hidden/visible ThreadWindow closed 都会让 `hasPreparedThreadWindow=false`，并发布 unavailable。
- `agent_server.health available=false` 会断开 `/api/dynamic-tools` 与 Swift `/api/thread` client；重新 available 后才连接 `DynamicToolProviderConnectionClient` 与 `SwiftThreadClient`。
- visible ThreadWindow closed 才调用 `onThreadWindowClosed`；hidden prewarm 关闭只影响可提交状态。
- ActivityWindow renderer crash 不改变 app-server availability；ThreadWindow renderer crash 会按 fatal 处理。
- 这条链路是高频回归点：凡是改动 `openHistory` / `focus` / `commandAck` / `threadWindowClosed` 相关行为，都要同时复验“首次 PromptPanel -> ThreadWindow handoff 不会把窗口一起带没”和 `docs/manual-qa.md` 中对应条目。

## 边界

- 不持有 ThreadWindow thread 缓存、消息或历史状态。
- 不解析 `/api/thread` 的 `ThreadNotification`。
- 不消费完整 `/api/thread` 状态；AgentTrigger 命中由 SwiftThreadClient 直连，权限/工作区请求由 ThreadWindow 和桌宠的交互式连接呈现，core 仲裁唯一回执。
- 新增 host dynamic tool 时，先在 `MacHostDynamicTools` 与 `MacPlatformProvider` 同步 spec / method 映射。
- 不承载 PromptPanel、Settings、Hotkey 或焦点恢复；这些仍由 Swift 宿主负责。

## 修改约束

- 新增或改名 Electron command/event 时，先改 `ElectronShellProtocol.swift`，再同步 `apps/electron-shell/src/main/protocol/electronShellProtocol.ts` 和双方测试。主题同步 command 固定为 `theme.changed`，payload 为 `{ preference, resolved }`。
- 不把持续 `ThreadNotification` / `ServerRequest` 引入本目录；生产 PromptPanel 与 AgentTrigger 首轮提交由 `AgentServer/SwiftThreadClient` 直连 `/api/thread` 完成，本目录只处理 Electron 窗口 command。`thread_window.open_initial_prompt` 仍作为 fallback / 测试协议保留。
- `ElectronShellProcess` 的 stdout 只能解析 event；stderr 作为 diagnostic 日志原样转发到宿主 stderr，支持 packaged app stdout/stderr 重定向观察。不要把 Electron diagnostic 写到 stdout。
- Swift->Electron command socket 路径必须保持短路径；macOS `sockaddr_un.sun_path` 长度有限，当前使用 `/tmp/hae-<uuid>.sock`。
- `stop()` 必须清理 callbacks、pending command kind、dynamic tool provider client、Swift thread client、宿主退出请求回调和 shell handlers，避免旧 Electron 事件影响下一次 start。
