# AppServices 层

跨模块共享的应用服务：Electron shell runtime、host dynamic tools、设置存储、热键名、激活策略。所有服务都由 [Coordinator](/Users/mu9/proj/handAgent/apps/desktop/Sources/Coordinator/coordinator.md) 持有并通过依赖注入传给上层模块，自身不感知 UI 与窗口。

## 子模块

| 目录 | 文档 | 职责 |
|------|------|------|
| `AgentServer/` | [agent-server.md](/Users/mu9/proj/handAgent/apps/desktop/Sources/AppServices/AgentServer/agent-server.md) | `AppServerManaging` health 协议、`/api/thread` / `/api/dynamic-tools` WebSocket client、Electron launch 所需仓库根定位 |
| `ElectronShell/` | [electron-shell.md](/Users/mu9/proj/handAgent/apps/desktop/Sources/AppServices/ElectronShell/electron-shell.md) | Swift 到 Electron 进程桥、event 解码、app-server 可用性门控、ThreadWindow/ActivityWindow command client |
| `AgentSettings/` | [agent-settings.md](/Users/mu9/proj/handAgent/apps/desktop/Sources/AppServices/AgentSettings/agent-settings.md) | `~/.spotAgent/settings.json` 读写 + 500ms 轮询；模型配置 UI |
| `Appearance/` | [appearance.md](/Users/mu9/proj/handAgent/apps/desktop/Sources/AppServices/Appearance/appearance.md) | Swift 宿主主题偏好、解析后主题和传给 Electron/React 的 theme payload |
| `Hotkey/` | [hotkey.md](/Users/mu9/proj/handAgent/apps/desktop/Sources/AppServices/Hotkey/hotkey.md) | 固定系统入口快捷键（`showPromptPanel` / `captureSelection` / `captureRegion`）与 manifest Action 全局快捷键注册 |
| `Lifecycle/` | [lifecycle.md](/Users/mu9/proj/handAgent/apps/desktop/Sources/AppServices/Lifecycle/lifecycle.md) | 根据 Electron ThreadWindow / SettingsWindow 计数切换激活策略 |
| `PlatformBridge/` | [platform-bridge.md](/Users/mu9/proj/handAgent/apps/desktop/Sources/AppServices/PlatformBridge/platform-bridge.md) | Host / plugin dynamic tools：把 macOS 原生能力与 `~/.spotAgent/plugins/<id>/plugin.json` 声明的 plugin tools 通过 `/api/dynamic-tools` 暴露给 agent-server |
| `SelectionCapture/` | [selection-capture.md](/Users/mu9/proj/handAgent/apps/desktop/Sources/AppServices/SelectionCapture/selection-capture.md) | 文本选区采集（osascript Cmd-C）+ 用户主动区域截图（保留 `screencapture -i`），由 Coordinator 在 `captureSelection` / `captureRegion` 热键路径调用 |
| `AgentTrigger/` | 无独立索引文档 | AgentTrigger package/store/runtime/provider 抽象；内置 `chrome.bookmarks` 与 `system.clock`，manifest 字面值由 `AgentTriggerStore.builtinPackages` 持有，`AgentTriggerStore.ensureBuiltinPackagesInstalled()` 幂等写入缺失项并不覆盖用户改过的 `trigger.json`，`AgentTriggerStore.deleteInstance(id:)` 复用 `saveInstances` 原子写入。Runtime 会启动所有已安装 provider，即使当前没有启用实例；这样 Chrome Bookmarks bridge 在创建首个实例前也能接收扩展 hello 并更新连接状态。provider 事件可能来自后台队列，`AgentTriggerRuntime` 必须先切回 main queue，再把渲染后的 `PromptSubmission` 交给 Swift `/api/thread` client，复用 PromptPanel 的 `thread.start(dynamicTools)` + 首轮 `op.submit(UserInput)` 提交流程。Chrome Bookmarks provider 不再轮询 Chrome `Bookmarks` 文件，而是通过 Chrome 扩展 → Native Messaging helper → Swift loopback bridge 接收 `handagent.bookmarks.created` 事件；同一 bridge 还接收 `handagent.bookmarks.folderTreeSnapshot` 并写入 `~/.spotAgent/agent-triggers/chrome-bookmarks-extension/folders.json`，供 Settings 渲染文件夹树选择；内置默认提示词会把 `{{title}}` 与 `{{url}}` 渲染进后台 thread 首条输入 |

## 文件

| 文件 | 职责 |
|------|------|
| `AppServices.swift` | DI 容器：持有 `appServer` / `swiftThreadClient` / `threadWindowCommandClient` / `activityWindowCommandClient` / `settingsStore` / `agentTriggerStore` / `agentTriggerRuntime` / `appearanceThemeService` / `appearanceChangeObserver` / `actionManifestStore` / `dynamicToolServerURL` / `threadServerURL` / `hotkeyRegistrar` / `settingsWindowPresenter` / `fatalAlertPresenter` / `setActivationPolicy` / `terminateApplication` / `showsFatalAlert` / `promptPanelPresentationMode`。`init` 在构造 `AgentTriggerRuntime` 之前调用 `agentTriggerStore.ensureBuiltinPackagesInstalled()`，使首次启动 reload 即可扫到内置 `chrome-bookmarks` / `system-clock` package；该顺序不能颠倒，否则 reload 时 `packages/` 仍为空。若环境提供 `HANDAGENT_CHROME_BOOKMARKS_EXTENSION_ID`，启动期还会写入 Chrome Native Messaging Host manifest；`HANDAGENT_CHROME_BOOKMARKS_NATIVE_HOST_PATH` 可覆盖 helper 可执行路径；开发态 `scripts/swiftw run HandAgentDesktop` 会默认注入固定扩展 ID 和 helper path。同一 installer 也提供 Settings 使用的扩展连接状态诊断，诊断会检查 manifest/helper、当前 `bridge.json`，并读取 native host 写入的 `status.json`。生产 `defaultRuntime` 始终选择 `ElectronBackedAppServer` 作为 app-server health source、ThreadWindow command client 和 ActivityWindow command client，并创建 Swift thread client 与 dynamic tool provider client；启动时会创建 `PluginDynamicToolManager` 扫描 `~/.spotAgent/plugins`，provider hello、Swift `thread.start.dynamicTools` 和 Electron 环境变量 `HANDAGENT_DEFAULT_DYNAMIC_TOOLS` 都来自同一份 dynamic tool 列表；AgentTrigger 命中后直接调用同一个 Swift thread client 提交后台 prompt，不再通过 Electron `agent_trigger.fire` 启动 thread；`AppearanceThemeService` 负责宿主主题解析和同步 payload，Electron 启动环境里的 `HANDAGENT_INITIAL_THEME` 必须来自该服务当前解析后的真实主题；`SystemAppearanceChangeObserver` 负责监听 macOS 外观变化。测试用 `AppServices.testing()` 注入 nop 替身，并让 PromptPanel controller 创建 panel 但不把窗口展示到屏幕 |
| `AppServicesProductionImpls.swift` | 生产实现：`ProductionHotkeyRegistrar` / `ProductionSettingsWindowPresenter` / `ProductionFatalAlertPresenter`；Settings window presenter 通过 `WindowCloseObservation` 持有和释放关闭通知 token |

## DI 协议

| 协议 | 生产实现 | 测试替身 |
|------|---------|---------|
| `AppServerManaging`（在 `AgentServer/AppServer.swift`）| `ElectronBackedAppServer` | `NopAppServer` / 测试内 recording server |
| `ElectronShellProcessing`（在 `ElectronShell/ElectronShellProcess.swift`）| `ElectronShellProcess` | 测试内 recording shell |
| `ThreadWindowCommanding`（在 `ElectronShell/ThreadWindowCommanding.swift`）| `ElectronBackedAppServer` | `NopThreadWindowCommandClient` / 测试内 recording command client |
| `ActivityWindowCommanding`（在 `ElectronShell/ActivityWindowCommanding.swift`）| `ElectronBackedAppServer` | 测试内 recording command client |
| `AppearanceChangeObserving`（在 `Appearance/AppearanceChangeObserver.swift`）| `SystemAppearanceChangeObserver` | `NopAppearanceChangeObserver` / 测试内 recording observer |
| `HotkeyRegistering` | `ProductionHotkeyRegistrar` | `NopHotkeyRegistrar` |
| `SettingsWindowPresenting` | `ProductionSettingsWindowPresenter` | `NopSettingsWindowPresenter` |
| `FatalAlertPresenting` | `ProductionFatalAlertPresenter` | `NopFatalAlertPresenter` |

## 编辑此层的约束

- **服务与 presenter 分层**：`ElectronBackedAppServer` / `AgentSettingsStore` 等服务保持 UI 无关；生产 window presenter 只能负责窗口构造与关闭回调，不写业务逻辑。
- **Electron-only UI shell**：agent-server supervisor、ThreadWindow、StatusBubble 与 `/api/activity` subscriber 由 Electron/React 路径承载。
- **SettingsWindowPresenting 只注入 ViewModel**：Settings 的 Append Prompt / MCP 页面各自直接读写 `~/.spotAgent/actions` 或 `~/.spotAgent/mcp.json`；presenter 只把 ViewModel 交给 `SettingsView`，不解析配置文件。
- **`@Observable` 优先**：新建状态类使用 `@Observable`，View 使用 `@Bindable` / `@State`。
- **依赖通过 init 注入**：`AgentSettingsStore(homeDirectoryURL:)` 这样允许测试注入临时目录；不要在服务内直接读 `FileManager.default.homeDirectoryForCurrentUser` 之外的全局状态。
- **错误对外暴露规则**：服务内部捕获错误后写 `xxxErrorMessage` 字段供 UI 读，不要直接 `fatalError` 或抛到 Coordinator。
- **宿主退出边界**：Electron clean exit 只能通过 `AppServerManaging.onHostTerminationRequest` 上报给 Coordinator，再由注入的 `terminateApplication` 调用 `NSApplication.terminate`；不要在服务层直接退出 Swift 宿主。
