# Settings：配置能力与偏好

- **模式**：Operate。
- **范围**：原生设置窗口和九个 Tab；入口 `apps/desktop/Sources/Settings/SettingsView.swift`。各 Tab 是同一 surface 内的任务子页。
- **用户与频率**：首次配置或需要调整模型、权限、工具和工作习惯的用户；按需进入，实际频率未测量。
- **成功条件**：找到正确设置，理解其作用范围和启用状态，保存后行为一致，失败时有可处理的说明。

## 当前 surface 合约

- **THESIS**：用一个设置入口管理产品依赖与个人选择；对话中的即时授权仍在对话 surface 完成。
- **OWN-WORLD**：原生 SwiftUI，继承共享主题与 Common 表单控件；页级结构、动作、错误和空态使用统一组件。
- **STORY**：从输入面板或应用菜单进入 → 选择 Tab → 查看/修改配置 → 保存或即时应用 → 返回当前工作。
- **FIRST VIEWPORT**：固定 680×560 的内容容器，上方横向九个 Tab、分隔线和当前页；默认模型页。触发器页可进入 package 详情，使用页面内返回路径。
- **FORM**：现有 Tab 容器、列表与表单子页；不按每个配置项创造独立视觉系统。未选择新导航方案，seed key 不适用。
- **FINISH**：本次记录九个页面的用途与关键状态；主题、字段溢出、键盘访问和真实保存仍按 QA 记录验收，没有新增视觉通过结论。

## 设置子页现状

| 子页 | 用户任务与内容 | 关键状态/边界 |
| --- | --- | --- |
| 模型 | 配置模型、服务地址与凭据 | 配置存在不等于外部服务可用；真实请求另验 |
| 外观 | 选择亮色、暗色或跟随系统 | 宿主解析主题并同步两个 React 界面 |
| 工具 | 启用内置能力，查看采集状态和 builtin tool 列表 | Context History 常驻并展示真实采集状态；Automation 默认关闭，采集失败不影响已有历史查询 |
| 触发器 | 选择 Chrome Bookmarks / System Clock，管理明确目标桌宠的触发规则 | package 列表 → 详情 → 新增表单；连接、无文件夹、空列表、保存失败、取消分别处理 |
| 追加 | 管理 Append Prompt 模板与入口信息 | 保存后供输入入口选择；不提供参数声明或工具绑定 |
| MCP | 管理 stdio / streamableHttp server 配置 | 列表与表单管理；配置保存不等于连接成功 |
| 权限 | 查看并撤销永久工具规则 | 管理已有决定，不代替任务内的即时授权 |
| 快捷键 | 配置系统入口、追加模板和应用内快捷键 | 三类快捷键的生效范围不同 |
| 桌宠 | 创建、编辑并选择默认 Pet | 配置经后端保存；根目录创建后只读，角色变更仅用于新 Thread，冲突保留表单 |

上述子页对应 Settings 源码中的同名 View；模型页由 AppServices 的 AgentSettingsView 嵌入。详细字段与存储路径由 owning 模块维护，本 brief 不再复制。

## 约束与待决事项

- 工具页是内置能力的启用与状态入口；当前没有独立 Context History 时间线或 Automation 流程编辑 surface。
- 关闭设置窗口不停止已启用的内置能力。Context History 没有启用开关，历史读取不依赖采集成功或 Swift Provider 在线。
- 触发器新增失败时保留表单与错误，取消时清理本次错误；书签连接可靠性仍有既有待办与待验边界。
- 当前没有已核实的独立 onboarding 流程；后续若要引导首次配置，需要另行确认任务与完成标准。
- 待确认：九个横向 Tab 的导航组织是否满足使用频率，以及权限、MCP、触发器的引导深度。本轮只记录，不据此变更导航。

## 证据

- [设置模块约定](../../apps/desktop/Sources/Settings/settings.md)，[SettingsView.swift](../../apps/desktop/Sources/Settings/SettingsView.swift)与 [SettingsStyles.swift](../../apps/desktop/Sources/Settings/SettingsStyles.swift)确认九个 Tab、默认页和布局。
- 已抽查 ToolSettingsView、AgentTriggerSettingsView 与 AppearanceSettingsView 的状态和页面内容；其他子页按现有模块资料记录。
- [手工验收](../manual-qa.md)：配置、主题、内置模块、触发器、MCP、权限、快捷键与桌宠相关项目；本轮未复验。
