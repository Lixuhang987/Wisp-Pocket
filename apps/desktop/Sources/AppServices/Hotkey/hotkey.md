# Hotkey 模块

快捷键分为固定系统入口全局快捷键、Action 全局快捷键和应用内快捷键三类。全局快捷键配置模型基于 [KeyboardShortcuts](https://github.com/sindresorhus/KeyboardShortcuts) 库，应用内快捷键复用该库的 `Name` / `Recorder` 做配置持久化，但监听走 `NSEvent.addLocalMonitorForEvents`。

## 文件

| 文件 | 职责 |
|------|------|
| `GlobalShortcutNames.swift` | 定义 `KeyboardShortcuts.Name` 扩展：固定系统入口（唤起面板 / 捕获文本选区 / 圈选区域截图）和应用内快捷键（会话窗口） |
| `NamedHotkeyRegistrar.swift` | 对 `KeyboardShortcuts.Name` 建立可测试的全局注册层；监听快捷键配置变更并重新绑定运行中的 handler |
| `ActionShortcutDefaults.swift` | Action 快捷键默认值写入与测试辅助；不直接监听 AppKit 局部键盘事件 |
| `AppScopedShortcutMatcher.swift` | app-scoped 快捷键匹配 helper：统一读取 `KeyboardShortcuts` 当前配置并和 `NSEvent` 比对，供 Coordinator 复用 |

## 架构

### 固定系统入口快捷键

- `KeyboardShortcuts.Name.showPromptPanel`，默认 ⌘⇧Space，回调 `send(.togglePromptPanel)`。
- `KeyboardShortcuts.Name.captureSelection`，无默认值；按下后调用 `MacSelectionCaptureProvider`，把结果作为 `textSelection` chip 推入 PromptPanel 并自动唤起。
- `KeyboardShortcuts.Name.captureRegion`，无默认值；按下后调用 `MacRegionCaptureProvider`（基于 `screencapture -i`）；用户取消圈选时不弹面板，截图成功则把 PNG base64 作为 `imageRegion` chip 推入 PromptPanel 并自动唤起。
- 注册位置统一在 [Coordinator.setupHotkey()](/Users/mu9/proj/handAgent/apps/desktop/Sources/Coordinator/coordinator.md)。
- 生产实现由 `ProductionHotkeyRegistrar` 委托 `NamedHotkeyRegistrar` 绑定。`NamedHotkeyRegistrar` 订阅 `KeyboardShortcuts_shortcutByNameDidChange`，同名快捷键变更后会移除旧 handler 并按新配置重新绑定，运行中的 App 不需要重启。
- 库内部使用 Carbon Events 注册系统级热键；用户自定义值由库自动持久化到 UserDefaults，并在写入后发出同名快捷键变更通知。

### Action 全局快捷键

- 每个由 manifest prompt 派生的 `ActionDefinition` 通过 `shortcutName` 计算属性生成 `KeyboardShortcuts.Name("action.<id>")`。
- Action 快捷键使用 `KeyboardShortcuts.Recorder` 配置，存储仍由 KeyboardShortcuts 写入 UserDefaults。
- Action 快捷键是系统级全局快捷键，由 `ProductionHotkeyRegistrar.registerActionShortcut(...)` 注册。
- 默认值来自 action manifest prompt 级 `globalShortcut`，仅当用户未自定义时写入。
- Append Prompt 快捷键触发后由 Coordinator 打开 PromptPanel，并把对应模板追加为 chip；用户可继续输入，也可直接提交只含 Append Prompt 的输入（协议类型为 `skill`）。

### 应用内快捷键（app-scoped）

- `KeyboardShortcuts.Name.showThreadWindow`，默认 ⌘L，回调 `send(.openHistory)` 打开或聚焦 ThreadWindow。
- 仅在 handAgent 持有焦点时生效（promptPanel 或 Settings 窗口在前台），不持有焦点时按键由 macOS 正常分发。
- 监听在 `AppCoordinator.setupHotkey()` 的 `NSEvent.addLocalMonitorForEvents(matching: .keyUp)` 中注册。
- 配置 UI 复用 `KeyboardShortcuts.Recorder`，持久化走 KeyboardShortcuts 库写入 UserDefaults；运行时由 `AppScopedShortcutMatcher` 统一读取 `KeyboardShortcuts.getShortcut(for:)`，未自定义时 fallback 到 `Name` 的 `defaultShortcut`。
- 匹配逻辑：`KeyboardShortcuts.Shortcut(event: NSEvent)` 构建 Shortcut 对象后 `==` 比对，命中则执行 action 并返回 `nil` 吞掉事件。
- `shutdown()` 中通过 `NSEvent.removeMonitor` 清理。

### 设置界面

- 由 [Settings/ShortcutSettingsView](/Users/mu9/proj/handAgent/apps/desktop/Sources/Settings/settings.md) 渲染，上下分为“全局快捷键”和“Action 快捷键”两栏，二者都用 `KeyboardShortcuts.Recorder` 配置。

## 编辑此目录的约束

- 新增固定系统入口快捷键：在此处加 `Name` 扩展并设默认值；注册位置统一在 Coordinator，不要散到其他模块。
- Action 快捷键命名格式 `action.<actionId>` 不要改，否则旧用户的 UserDefaults 会失效。
- 不要把 `KeyboardShortcuts.Recorder` 散布到非 Settings 模块。
- 应用内快捷键的 `Name` 也定义在 `GlobalShortcutNames.swift`，但注册不走 `HotkeyRegistering` 协议；监听代码主入口放在 Coordinator 的 `setupHotkey()` 中。

## 与其他模块的关系

- [Coordinator](/Users/mu9/proj/handAgent/apps/desktop/Sources/Coordinator/coordinator.md) 通过 `HotkeyRegistering` 协议注册全局热键回调。
- [Coordinator](/Users/mu9/proj/handAgent/apps/desktop/Sources/Coordinator/coordinator.md) 从 manifest 构建 `ActionDefinition` 列表并注册 Action 全局快捷键。
- [Coordinator](/Users/mu9/proj/handAgent/apps/desktop/Sources/Coordinator/coordinator.md) 在 `setupHotkey()` 中用 `NSEvent.addLocalMonitorForEvents` 注册应用内快捷键，不走协议层。
- [Settings](/Users/mu9/proj/handAgent/apps/desktop/Sources/Settings/settings.md) 提供配置 UI。
