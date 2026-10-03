# Settings：配置能力与偏好

- **模式**：Operate。
- **范围**：独立 Electron 设置与 Swift 原生宿主设置，共同服务配置任务；入口分别为 `SettingsApp.tsx` 与 `SettingsView.swift`。
- **用户与频率**：首次配置或需要调整模型、权限、工具和工作习惯的用户；按需进入，实际频率未测量。
- **成功条件**：找到正确设置，理解其作用范围和启用状态，保存后行为一致，失败时有可处理的说明。

## 当前 surface 合约

- **THESIS**：按数据使用方配置产品依赖与个人选择；任务内即时授权仍在对话 surface 完成。
- **OWN-WORLD**：Electron/React 与 SwiftUI 共用现有主题；Swift 解析亮色、暗色与跟随系统，下发到全部 renderer。
- **STORY**：menu bar “设置”或应用菜单“设置…”进入 Electron → 选择 AI / Agent / Pets → 编辑与保存；PromptPanel 的原生设置入口继续管理宿主能力与偏好。
- **FIRST VIEWPORT**：Electron 左侧为 AI / Agent / Pets，首次与关闭重开默认 AI；已打开时再次进入只聚焦，不重置页面或草稿。Agent 内以 Tools / MCP / Permissions 切换。原生保留 680×560 容器、五个横向 Tab，默认外观。
- **FORM**：紧凑导航、列表和表单；模型、MCP 与 Pet 显式保存，输入变化、切页不自动提交。Tool 开关、权限撤销、默认 Pet 和显示隐藏为即时动作。
- **FINISH**：2026-10-04 对照实现更新所有权与保存合约；真实焦点、布局、亮暗主题、字段溢出和键盘访问仍待 manual QA，没有新增实机通过结论。

## 设置子页现状

| 窗口 / 子页 | 用户任务与内容 | 关键状态/边界 |
| --- | --- | --- |
| Electron / AI | 配置 provider、model、接口模式、Base URL 与 API Key | 显式保存，下次模型请求生效；后端保留未展示字段，凭据为密码输入 |
| Electron / Agent / Tools | 调整可配置 builtin Tool | 即时保存；默认文件与历史读取没有禁用开关 |
| Electron / Agent / MCP | 管理 stdio / streamableHttp 及示例 | 编辑加入待保存配置，再显式保存；保存只确认持久化，重启 App 后加载，连接刷新尚未实现 |
| Electron / Agent / Permissions | 查看永久规则与创建时间并撤销 | 按 Tool 名称全局跨 Pet 生效，不代替任务内即时授权 |
| Electron / Pets | 管理名称、描述、角色、图片、默认项和显示隐藏 | 与桌宠伙伴管理共用表单及 revision 合同；创建选目录，编辑项目只读；冲突保留表单 |
| 原生 / 外观 | 选择亮色、暗色或跟随系统 | 独立原生偏好，不覆盖后端模型/Tool 配置 |
| 原生 / Host | 查看 Context History 状态，启用 Automation | Context History 常驻；Automation 默认关闭，失败不影响已有历史读取 |
| 原生 / 触发器 | 管理 Chrome Bookmarks / System Clock 规则 | Package → 详情 → 新增表单，明确目标 Pet；失败保留输入，取消清理本次错误 |
| 原生 / 追加 | 管理 Append Prompt 模板与入口 | 保存后供输入入口选择；不提供参数声明或工具绑定 |
| 原生 / 快捷键 | 配置全部既有系统、模板与应用内快捷键 | 生效范围保持原语义 |

详细字段与存储路径由 owning 模块维护，本 brief 不再复制。

## 约束与待决事项

- 后端配置通过公开接口校验与保存，Electron 不直接写业务文件。Swift 外观写 `native-preferences.json`，后端模型/Tools 写 `settings.json`，两端交错保存互不覆盖。
- 新项目自动创建基础 Pet，再独立保存用户 Pet，产生两只；复用目录只新增用户 Pet。Workspace 根与 Pet 归属不可改；不新增项目管理页或 AGENTS.md 编辑器。
- 原生 Host 页是内置能力的启用与状态入口；当前没有独立 Context History 时间线或 Automation 流程编辑 surface。
- 关闭设置窗口不停止已启用的内置能力。Context History 没有启用开关，历史读取不依赖采集成功或 Swift Provider 在线。
- 触发器新增失败时保留表单与错误，取消时清理本次错误；书签连接可靠性仍有既有待办与待验边界。
- 当前没有已核实的独立 onboarding 流程；后续若要引导首次配置，需要另行确认任务与完成标准。
- MCP 配置已保存不等于连接成功；模型配置存在也不等于外部服务可用，真实请求另验。权限、MCP 与触发器的后续引导深度尚待确认。

## 证据

- [Web 源码约定](../../apps/thread-window-web/src/src.md)、[SettingsApp.tsx](../../apps/thread-window-web/src/SettingsApp.tsx) 与共享伙伴表单确认导航、草稿和保存边界。
- [原生设置约定](../../apps/desktop/Sources/Settings/settings.md)、[SettingsView.swift](../../apps/desktop/Sources/Settings/SettingsView.swift) 确认保留页与默认外观；[后端设置](../../apps/agent-server/src/settings/settings.md)和 [Electron 窗口](../../apps/electron-shell/src/main/windows/windows.md)分别拥有持久化与单实例窗口合同。
- [手工验收](../manual-qa.md)：配置、主题、内置模块、触发器、MCP、权限、快捷键与桌宠相关项目；本轮未复验。
