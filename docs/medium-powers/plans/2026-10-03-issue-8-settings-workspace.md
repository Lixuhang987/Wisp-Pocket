# Issue #8 实施记录

规格以 [Issue #8](https://github.com/Lixuhang987/Wisp-Pocket/issues/8) 为准。审核基准 `7932ae6eacdfeb53d279064794b187b943434f3d`，隔离目录 `.worktrees/issue-8-settings-workspace`。计划采用已确认规格的边界，不另增兼容层。

## 主路径与合同

- 创建伙伴：Pet 表单提交目录 → core 规范化真实目录 → SQLite 单事务注册唯一 Workspace 与基础 Pet → 独立保存用户 Pet → 返回完整身份。复用目录不播种；commandId 持久去重；Pet.workspaceId 与 Workspace.rootPath 不可改。
- 创建重投先查询持久 commandId 再检查目录，同请求在途共享完整创建 Promise；原目录不可用或重投携带不同目录仍返回原身份。存储返回 rootPath 始终从 workspaceId 派生。
- Thread：`thread.start {petId?,workspaceId?}` 指定 Pet 时推导/核验项目，只有项目时随机选其全部 Pet，无目标失败。summary/snapshot/通知保存双归属，按 petId/workspaceId 查询交集且游标绑定范围。桌宠只查询自己；ThreadWindow 列全部项目一级分组，组内不按宠筛选。
- Turn：实际执行开始读取根 AGENTS.md 一次 → 同轮模型请求固定内容 → 下一轮重读。缺失为空、其他读取错误使 Turn 明确失败。用户要求 > 项目指令 > Pet 创建快照，文件工具根由 Workspace 派生。
- 项目命令：`workspace.list` → `workspace.listed {workspaces}`；`workspace.create {rootPath}` → `workspace.created {workspace,basePet,created}`，均沿已有 commandId 规则。
- 设置：HTTP GET/PUT `/api/settings/model` 返回原始 llm 对象，PUT 合并保留 summarizerModel/未展示字段；GET `/api/settings/tools` 返回 `{tools:[{name,title,enabled}]}`，PUT `{name,enabled}`；GET/PUT `/api/settings/mcp` 使用原始 `{version:1,servers}`，保存回 `{saved:true}`；GET permissions 回 `{rules:[{toolName,decision,createdAt}]}`，DELETE `/api/settings/permissions/{toolName}` 撤销。错误非2xx回 `{error}`，不泄露API Key。
- 窗口：Swift menu bar 唯一“设置” → `settings.open` → Electron 独立单例，加载 `surface=settings`。首次及关闭重开默认 AI，重复打开只聚焦。主题复用宿主 resolved theme；安全 preload，关闭不停止后台。
- React 设置：AI / Agent（Tools、MCP、Permissions）/ Pets；显式保存模型、MCP、Pet；失败保留草稿，切页不自动提交。即时工具/权限/默认Pet/显示隐藏保持。两处伙伴管理复用共享组件、同 revision规则，并补描述与隐藏能力。
- 原生：主题等偏好独立写 native-preferences.json，模型/工具/MCP/权限/Pet 编辑移到后端接口；Append Prompt、快捷键、Host状态/Automation、AgentTrigger 保留。PromptPanel默认Pet、trigger明确Pet，DTO同步。
- 身份对账：完整Pet快照替换已知集合，清理失效窗口/路由/界面偏好，保留有效项；局部查询不可误清全局，接收中回收继续延后。

## 实施与验证状态（2026-10-04）

- 从主 checkout 初始化 worktree 与独立 CodeGraph 索引，完成 TypeScript/Web 与 Swift build 分层基线；实现前阅读各受影响目录到 handAgent.md 的文档链。
- 沿公开主路径扩展既有身份、Thread、窗口、主题、历史导航与草稿用例；新增配置 HTTP、设置窗口、React 显式保存与 MCP 保存回执四个用例，累计新增预算 4/4。业务 owner 与 SQLite 使用真实实现，模型、Electron 与 macOS 边界使用替身。
- `bash ./scripts/test.sh`、`bash ./scripts/swiftw test`、`bash ./scripts/swiftw build` 与 Electron 完整 build 均通过；审核修正 MCP 编辑/回执竞态与桌宠管理 ACK 超时后，针对性回归、完整 TypeScript/Web 与 Electron build 再次通过。既有真实模型集成测试仍按默认条件跳过。
- 独立无继承上下文的文档审核已返回结论：无阻断性不一致，59 份修改或新增文档的本地链接无失效项。Standards 与 Spec 双轴代码审核提出的三处 P2 均已修复并复核，剩余确认发现为零；`git diff --check` 通过。
- 临时真实后端与浏览器验证了 AI 草稿跨页保留及显式保存、MCP 示例配置保存、伙伴描述保存、项目组内随机新建 Thread；1440×778 与 390×844 设置截图未见越界，920×640 项目导航与 Composer 正常。截图在 worktree `.cache/issue8-settings-desktop.png`、`issue8-settings-narrow.png`、`issue8-thread-project.png`，临时服务和测试数据不进入正式配置。
- 完整宿主尚未实机验收。menu bar、焦点、多屏/显示隐藏、主题、后台持续运行、真实模型与 AGENTS.md 编辑均保留在 [manual QA](../../manual-qa.md)；替身测试不证明这些真实系统行为。
- 已实现项目从 [TODO](../../TODO.md) 移出；MCP 运行刷新继续留作后续待办。当前协议与状态所有权以 owning 模块指南为准，本记录只保留本次合同与验证边界。
