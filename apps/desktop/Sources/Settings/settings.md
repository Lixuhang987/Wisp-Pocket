# Settings 模块

Swift 原生设置只拥有外观、Host、AgentTrigger、Append Prompt 和全部既有快捷键。PromptPanel 的设置入口仍打开本窗口；menu bar 的设置入口转给 [Electron 设置窗口](../../../electron-shell/src/main/windows/windows.md)。模型、Agent Tool、MCP、永久 Permission 和 Workspace 管理走后端接口；Pet 管理由 Electron 前端 store 及 React 设置拥有。

## 直接文件

- `SettingsView.swift` / `SettingsStyles.swift`：五个 Tab、Common 组件薄包装与容器。
- `AppearanceSettingsViewModel.swift` / `AppearanceSettingsView.swift`：经 AppearanceThemeService 保存并解析主题。
- `ToolSettingsViewModel.swift` / `ToolSettingsView.swift`：只显示 Context History 状态和 Automation 开关；没有 Agent builtin tool 编辑能力。
- `AgentTriggerSettingsViewModel.swift` / `AgentTriggerSettingsView.swift`：Package / Instance 两级表单与明确目标 Workspace。
- `AppendPromptSettingsViewModel.swift` / `AppendPromptSettingsView.swift`：无参数的 Append Prompt manifest。
- `ShortcutSettingsView.swift`：固定系统入口、应用内快捷键与 manifest Action 快捷键。
- `SettingsTextHelpers.swift`：表单共用字符串处理。

## 写入与生命周期边界

- 外观只写 `~/.spotAgent/native-preferences.json`，不读取或镜像后端 `settings.json` 的模型与 Tools，互相交错保存不会覆写另一方；格式归 [AgentSettings](../AppServices/AgentSettings/agent-settings.md)。Swift 解析主题并向 Electron 下发 resolved theme。
- Context History 随宿主常驻采集。Host 页展示真实最近采样和采集/权限错误；Automation 默认关闭，经独立 `builtin-features.json` 成功保存后立即切换。关闭任何设置窗口都不停止这些后台模块。
- Append Prompt 写 `~/.spotAgent/actions/append-prompts/action.json`，只有 trigger/title/description/template/globalShortcut；PromptPanel 选择后以 `skill` Input Item 提交。
- AgentTrigger 使用独立 `~/.spotAgent/agent-triggers/*`。后台事件只投递明确 `targetWorkspaceId`，失败不改投。手动 PromptPanel 独立选择并记忆 Workspace。
- AgentTrigger 新增、取消、收起和错误生命周期由 ViewModel 持有；保存失败保留表单，取消/收起一起重置本次字段和错误，不修改已有 Instance 或 reload runtime。
- Chrome Bookmarks 只把不早于当前 bridge 的 connected 状态视为监听；manifest/helper、bridge/status/folders 的持久化边界在 [AgentTrigger](../AppServices/AgentTrigger/agent-trigger.md)。表单展示文件夹名称、层级及数量，保存 folderIds 和 promptTemplate。System Clock 保留时间点/时区。
- 原生窗口由 [Coordinator](../Coordinator/coordinator.md) 的 SettingsLifecycle 管理 activation policy；不拥有 Electron 设置的窗口状态或表单草稿。

## 修改约束

- 输入、按钮、错误和空状态复用 Common 的 Settings 薄包装，主题统一消费 `@Environment(\.appTheme)`；placeholder 在 light/dark 都可读。SwiftLint 规则通过根 `scripts/test.sh` 执行。
- View 不直接持有配置 Store，也不编排模型、工具循环或宿主模块生命周期。
- 快捷键只分固定系统入口全局、manifest Action 和应用内三类。应用内 Recorder 通过 local event monitor 生效，不经 Carbon 全局 HotkeyRegistering。
- 运行修改需保留 Append Prompt、AgentTrigger 表单、Host 状态与外观的既有回归；系统替身不代表真实窗口视觉/焦点通过，见 [manual QA](../../../../docs/manual-qa.md)。
