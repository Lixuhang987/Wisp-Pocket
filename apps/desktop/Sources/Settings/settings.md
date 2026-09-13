# Settings 模块

设置窗口的容器与各 Tab 视图。当前九个 Tab：模型配置、外观主题、工具与内置功能、AgentTrigger 管理、Append Prompt 管理、MCP 管理、权限规则管理、快捷键配置、工作区管理。窗口本身由 Coordinator 用 `NSWindow + NSHostingController` 管理。

## 文件

| 文件 | 职责 |
|------|------|
| `SettingsView.swift` | 设置容器，挂"模型" / "外观" / "工具" / "AgentTrigger" / "追加" / "MCP" / "权限" / "快捷键" / "工作区"九个 Tab |
| `AgentSettingsViewModel.swift` | `@Observable` 代理：把 `AgentSettingsStore.settings` 包装成可双向绑定的属性 |
| `AppearanceSettingsViewModel.swift` / `AppearanceSettingsView.swift` | 外观主题偏好 UI 与写入 |
| `ToolSettingsViewModel.swift` / `ToolSettingsView.swift` | Context History / Automation 开关、采集状态与配置错误，以及 Agent builtin tool 列表 |
| `AgentTriggerSettingsViewModel.swift` / `AgentTriggerSettingsView.swift` | 两级触发器设置：一级展示已安装 package 行（左侧 name + description，右侧"N 个自动化 >"进入二级），二级顶部展示 name + description，并按 `providerKind` 渲染表单管理"自动化"（`AgentTriggerInstance`）。Chrome Bookmarks 详情页显示扩展连接状态：先检查 Native Messaging Host manifest/helper 和当前 `bridge.json`，再读取 helper 写入的 `status.json`，只有不早于当前 bridge 的 connected 状态才视为正在监听；新增表单读取 `folders.json` 展示 Chrome 收藏夹文件夹树，用户只看到文件夹名称、层级和内部数量，保存时写入内部 folderIds 和实例级 `promptTemplate`，提示词可使用 `{{url}}`、`{{title}}`、`{{folderId}}` 等事件字段，内置默认值会带上收藏标题和 URL；System Clock 保持时间点与时区配置。内置 manifest 与 `ensureBuiltinPackagesInstalled` 由 `AgentTriggerStore` 提供，启动期由 `AppServices` 在 runtime reload 之前调用以确保首次启动直接可见 |
| `AppendPromptSettingsViewModel.swift` / `AppendPromptSettingsView.swift` | 管理 Append Prompt manifest；写入 `~/.spotAgent/actions/append-prompts/action.json`，prompt 不包含参数字段 |
| `MCPSettingsViewModel.swift` / `MCPSettingsView.swift` | 直接读写 `~/.spotAgent/mcp.json` 的 stdio / streamableHttp server 列表 |
| `PermissionRulesViewModel.swift` / `PermissionRulesView.swift` | 直接读写 `~/.spotAgent/permissions.json`，展示永久规则并支持撤销 |
| `ShortcutSettingsView.swift` | 快捷键配置 UI；固定系统入口全局快捷键、应用内快捷键（会话窗口）和 manifest `ActionDefinition` 派生的 Action 快捷键 |
| `WorkspaceSettingsViewModel.swift` / `WorkspaceSettingsView.swift` | 直接读写 `~/.spotAgent/workspaces.json` |
| `SettingsStyles.swift` | `SettingsTab` / `SettingsTabBar`，以及 Settings 对 Common 组件的薄包装或 typealias（`SettingsTextField` / `SettingsSecureField` / `SettingsTextEditor` / `SettingsActionButton` / `SettingsEmptyState` / `SettingsErrorFooter` / `SettingsPage` 等） |
| `SettingsTextHelpers.swift` | 设置页共用字符串 trim / identifier helper |

模型设置的具体 UI 在 [AppServices/AgentSettings/AgentSettingsView.swift](/Users/mu9/proj/handAgent/apps/desktop/Sources/AppServices/AgentSettings/AgentSettingsView.swift)，由本模块的 SettingsView 嵌入。

## 数据流

```
Coordinator.send(.openSettings)
  └─ SettingsLifecycle.openOrFocus(...)
       └─ SettingsView(settingsViewModel:, appearanceViewModel:, toolSettingsViewModel:, appendPromptSettingsViewModel:, mcpSettingsViewModel:, permissionRulesViewModel:, shortcutActions:, workspaceViewModel:)
            ├─ AgentSettingsView        → ~/.spotAgent/settings.json
            ├─ AppearanceSettingsView   → settings.json + theme.changed
            ├─ ToolSettingsView         → builtin-features.json + settings.json tools
            ├─ AgentTriggerSettingsView → ~/.spotAgent/agent-triggers/*
            ├─ AppendPromptSettingsView → ~/.spotAgent/actions/append-prompts/action.json
            ├─ MCPSettingsView          → ~/.spotAgent/mcp.json
            ├─ PermissionRulesView      → ~/.spotAgent/permissions.json
            ├─ ShortcutSettingsView     → KeyboardShortcuts UserDefaults
            └─ WorkspaceSettingsView    → ~/.spotAgent/workspaces.json
```

Append Prompt 只定义 trigger/title/description/template/globalShortcut。PromptPanel 选择后会追加 chip，提交时以 `skill` Input Item 进入 `UserInput.items`；Settings 不创建参数声明、运行期类型或 MCP 绑定字段。

工具页的两个内置功能默认关闭，选择经 [BuiltinFeatureSettingsStore](../AppServices/AgentSettings/agent-settings.md) 保存后立即生效。Context History 开关同时控制采集和工具入口；状态显示等待首次采样、最近采样或明确失败，不提供“停止采集但单独保留查询”的第二开关。关闭设置窗口不改变功能启用状态。

## 编辑此目录的约束

- **Settings UI 优先使用 Common**：所有表单输入走 `SettingsTextField` / `SettingsSecureField` / `SettingsTextEditor`，页级容器走 `SettingsPage`，动作按钮走 `SettingsActionButton`（role: `primary` / `secondary` / `destructive`），表单底部动作区走 `SettingsFormActions`，错误提示走 `SettingsErrorFooter`，空状态走 `SettingsEmptyState`。这些 Settings 类型应是 Common 的薄包装或 typealias；不要在 Settings 内复制 Common 已覆盖的绘制逻辑。
- **主题安全**：Common / Settings 组件统一消费 `@Environment(\.appTheme)`，确保 light / dark 下 placeholder、输入内容、强调与危险操作可读。输入 placeholder 由 Common overlay 真实渲染，不只依赖 macOS 原生 `TextField(prompt:)` 着色。
- **SwiftLint 约束**：仓库根 `.swiftlint.yml` 只对 `apps/desktop/Sources/Settings` 与 `apps/desktop/Sources/AppServices/AgentSettings` 启用，并强制裸输入、硬编码颜色和常见裸动作按钮约束（`SettingsStyles.swift` 在 `excluded` 内）。脚本入口 `bash ./scripts/swiftlint.sh` 通过 SwiftPM `SwiftLintCommandPlugin` 运行，并被 `scripts/test.sh` 在其他检查之前调用。
- **ViewModel 是配置代理层**：模型和 Agent builtin tool 使用 `AgentSettingsStore`；内置功能使用 `BuiltinFeatureSettingsStore`，只观察模块公开的采集状态；Append Prompt / MCP / 权限 / Workspace 代理各自共享 JSON 文件。
- **AgentTrigger 独立于现有手动 trigger**：Settings 里的 AgentTrigger 页只服务后台自动触发能力，不复用 Append Prompt 的 package 目录、配置语义或提交流程。
- **写入时统一 trim**：所有字符串字段在 setter 或创建入口中 trim。
- **不要把 store 直接传给 View**：始终经过 ViewModel。
- **Tab 增加规则**：新建 Tab 先在 `SettingsTab` enum 增 case、标题和图标，再在 `SettingsView.tabContent` 接入内容。
- **运行状态所有权**：Settings 不编排 LLM 或工具执行；内置功能启停由 `BuiltinFeatures` 管理，采集状态由 Context History 提供，agent-server 继续按既有时机读取模型与 Agent tool 配置。
- **快捷键只有三类模型**：固定系统入口全局快捷键；manifest prompt 派生的 Action 快捷键；应用内快捷键（app-scoped，用 `NSEvent.addLocalMonitorForEvents` 监听，不走 `HotkeyRegistering` 协议）。
- **测试**：`AppendPromptSettingsViewModelTests` 覆盖无参数 manifest 读写；`MCPSettingsViewModelTests` 覆盖 mcp.json 读写；`PermissionRulesViewModelTests` 覆盖按工具名称读取永久允许/拒绝规则与撤销。

## 与其他模块的关系

- Store 在 [AppServices/AgentSettings](/Users/mu9/proj/handAgent/apps/desktop/Sources/AppServices/AgentSettings/agent-settings.md)，由 [Coordinator](/Users/mu9/proj/handAgent/apps/desktop/Sources/Coordinator/coordinator.md) 持有。
- 快捷键名来自 [AppServices/Hotkey](/Users/mu9/proj/handAgent/apps/desktop/Sources/AppServices/Hotkey/hotkey.md) 与 [PromptPanel/ActionDefinition](/Users/mu9/proj/handAgent/apps/desktop/Sources/PromptPanel/prompt-panel.md)。
- 设置窗口的开/关会触发 [Lifecycle](/Users/mu9/proj/handAgent/apps/desktop/Sources/AppServices/Lifecycle/lifecycle.md) 中的激活策略切换。
