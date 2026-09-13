# Coordinator 模块

`AppCoordinator` 是宿主层的单向事件流总线，全局只有一份，由 Wisp Pocket App 持有。所有模块间协调（PromptPanel ↔ Electron ThreadWindow ↔ Electron 桌宠 ↔ Settings ↔ ElectronBackedAppServer）走 `send(.action)` 一条通路。

## 文件

| 文件 | 职责 |
|------|------|
| `AppCoordinator.swift` | 单向事件流、Action 路由；不持有 `NSWindow`、不 `import AppKit` |
| `ThreadWindowManaging.swift` | Coordinator 使用的 ThreadWindow 抽象，当前实现是 Electron command lifecycle |
| `ElectronThreadWindowLifecycle.swift` | 通过 `ThreadWindowCommanding` 向 Electron main 发送 open/focus command，不持有 Swift window 或 thread UI 状态 |
| `SettingsLifecycle.swift` | 持有设置窗口；提供 `openOrFocus / handleClosed / close` |
| `PromptSubmission.swift` | 把 PromptPanel composer items、选区和图片翻译为 `PromptUserInput.items` 与摘要的纯函数 |
| `PromptCaptureCoordinator.swift` | 把热键 → 选区 / 区域采集 → PromptPanel attachment 的串联从 Coordinator 抽出 |

## 事件流约束

- 唯一入口是 `send(_ action: Action)`；所有模块向 Coordinator 报告意图都必须通过该入口。
- Action 是封闭枚举；新增协调事件必须显式声明分支，不要用 `NotificationCenter` 绕开。
- `AppCoordinator.init` 保存依赖后会调用 `bootstrap()`；不要在外部重复手动调用。
- `bootstrap()` 会安装外观回调并启动外观监听、设置 PromptPanel 回调、注册热键和应用内快捷键、安装 app-server health 回调，并启动 Electron shell health 链路。AgentTrigger runtime reload 由 `AppServices.init` 负责。
- 子模块回调统一在 `bootstrap()` 阶段注入闭包；外观系统回调只转给 `AppearanceThemeService.systemAppearanceDidChange()`，其他闭包内只允许 `send(.xxx)` 或打开 PromptPanel。
- 应用退出由 `WispPocketApplicationDelegate` 接收 macOS termination 回调并等待异步 `shutdown()`；AppKit 延迟答复与去重由 [应用入口](../../desktop.md) 持有。Electron ThreadWindow 为前台时的 `Command+Q` 可能先让 Electron clean exit，Coordinator 通过 `AppServerManaging.onHostTerminationRequest` 调用宿主 `terminateApplication`，再回到同一退出链路。
- 内置模块由 bootstrap 启动；`shutdown()` 先通过 [BuiltinFeatures](../AppServices/PlatformBridge/platform-bridge.md) 停止采集、操作和录制监听，并等待 Automation 完成取消处理与 Run 终态写入，再关闭外部连接。Settings / ThreadWindow 关闭与 agent-server 暂时不可用不触发内置模块停机。
- 测试模式走 `AppServices.testing()` 注入 nop 替身，跳过窗口/进程/激活策略副作用。
- 窗口生命周期由 lifecycle 控制器闭环：Electron ThreadWindow 由 `ElectronThreadWindowLifecycle` 通过 `ThreadWindowCommanding` 管理，`SettingsLifecycle` 管 Settings；Coordinator 不持有 AppKit 对象。
- 应用内快捷键（如 `showThreadWindow` ⌘L 唤起 ThreadWindow）使用 `NSEvent.addLocalMonitorForEvents(matching: .keyUp)` 在 `setupHotkey()` 中注册，仅当 handAgent 持有焦点时生效。不走 `HotkeyRegistering` 协议和 Carbon Events 全局通道。配置 UI 复用 `KeyboardShortcuts.Recorder`，监听通过 `KeyboardShortcuts.Shortcut(event:)` 比对。`shutdown()` 中 `NSEvent.removeMonitor` 清理。
- Electron ThreadWindow 打开成功以 `command.ack ok` 为准；Swift 宿主不再把 Electron ThreadWindow 计入自身 Dock / Cmd+Tab 可见性。ThreadWindow 的 Dock / app switcher 入口属于 Electron app；Swift 宿主的持久 `.regular` 状态只由 Settings 窗口决定，PromptPanel 隐藏后按 Settings 状态回落。
- 历史入口语义：`openHistory` 聚焦全局 Electron ThreadWindow 并刷新左侧历史，不打开独立窗口；若此时 PromptPanel 仍可见，Coordinator 必须先执行 `hide(restoringFocus: false)` 再把控制权交给 Electron，避免首次 show/focus 时被 PromptPanel 的失焦恢复抢回旧前台应用。右侧当前展示哪个 thread 由 React `App` 本地 state 编排。
- PromptPanel show/toggle 只负责显示原生输入面板和刷新 action 定义，不触发 ThreadWindow prepare。ThreadWindow 预热由 Electron main 在 agent-server ready 后主动完成。
- PromptPanel 与 ThreadWindow handoff 语义：无论是提交首轮 prompt，还是 PromptPanel 仍可见时触发 `openHistory`，都必须先用 `hide(restoringFocus: false)` 隐藏 PromptPanel，不恢复唤起前的前台应用。提交首轮 prompt 的生产路径先由 Swift `/api/thread` client 创建 thread 并提交首轮 `UserInput`，拿到 `thread.started.threadId` 后再发送 `thread_window.focus(threadId)` 给 Electron main；`openHistory` 仍发送 `thread_window.open_history`。这样 Electron `BrowserWindow.show()/focus()` 后不会被 PromptPanel 的焦点恢复逻辑推到后台。
- 上一条是明确的防回归红线，不是实现细节建议：这个 bug 已多次出现。今后只要修改 `showThreadWindow` 快捷键、`openHistory`、PromptPanel hide/focus restore、ThreadWindow open/focus ack 任一环节，就必须同时保留自动化顺序断言，并重跑 manual QA 里的“首次 PromptPanel -> ThreadWindow 历史入口 handoff”。
- Settings 打开时会创建模型、外观、工具、Append Prompt、MCP、权限、快捷键和 workspace 的 ViewModel；工具页接收同一个 `BuiltinFeatures`。Coordinator 只负责注入，配置写入由对应 Store 负责。
- agent-server 健康状态独立：server 不可用时拒绝 `submitPrompt` 并保留面板草稿。
- `AppCoordinator` 在 app-server available 后通过 `ActivityWindowCommanding.showActivityWindow()` 显示桌宠。桌宠交互与 Thread 投影由 Electron renderer 处理，首次文字输入仍走 PromptPanel；Coordinator 不解析 Activity 状态。
- `AppCoordinator` 在 bootstrap 时启动 `AppearanceChangeObserving` 和 app-server health；macOS 外观变化时由 `AppearanceThemeService` 重新解析 `system` 并通过 `theme.changed` 下发给 Electron。

## 当前 Action 列表

```
showPromptPanel / hidePromptPanel / togglePromptPanel
submitPrompt([PromptPanelComposerItem], attachments: [PromptAttachmentResult])
openSettings / settingsWindowClosed
openHistory / threadWindowClosed
```

## 与其他模块的关系

- 持有 `ThreadWindowManaging`、`SettingsLifecycle`，分别闭环 Electron thread 窗口与设置窗口生命周期。
- 持有 `PromptPanelController`。
- 持有 `AgentServerHealth`（来自 AppServices 层）。
- 通过 `AgentServerHealth.onAvailabilityChange` 驱动 [PromptPanel](/Users/mu9/proj/handAgent/apps/desktop/Sources/PromptPanel/prompt-panel.md) 的提交启停状态。
- 通过 `AppServerManaging.onHostTerminationRequest` 把 Electron clean exit 转成 Swift 宿主退出。
- 通过 `ActivityWindowCommanding` 显示桌宠原生窗口；该 command client 只承载 show 命令回执，不承载 Thread 或 Activity 数据。
- 通过 `AppearanceChangeObserving` 接收 macOS 外观变化，并交给 `AppearanceThemeService` 生成宿主主题 payload。
- `AppActivationPolicyCoordinator` 实例由 Coordinator 创建；SettingsWindow 由 `SettingsLifecycle` 推送激活策略。Electron ThreadWindow open/close ack 只更新 Electron command lifecycle，不再改变 Swift 宿主 activation policy。
- Coordinator 不再保留 TCA `Store` 或 Swift 侧 thread 状态；Electron ThreadWindow 的消息、历史和运行态都由 React / agent-server 持有。

## 编辑此目录的约束

- 新增跨模块行为优先扩 `Action` 枚举，不要给 Coordinator 加 public 状态字段。
- 新增窗口类型 = 新增一个 lifecycle 控制器 + 1 条 Action 分支，不改 Coordinator 既有方法体。
- 子 Controller 自己管理就放在子模块下，并在 Coordinator 里只做 lazy 初始化与回调串联。
- 不要把 `LLMClient` / runtime / tool 调用塞进 Coordinator；这些归属 agent-server 与 packages/core。
