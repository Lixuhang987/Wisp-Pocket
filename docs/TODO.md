# 待办清单

## 文档维护要求（重要）

- **完成即迁移**：当本文中的待办项被代码实现并通过测试覆盖后，必须将该项**从本文移除**，并按主题分组追加到 manual-qa
- **同步更新模块文档**：若条目跨多个模块，迁移时同步更新对应 `<dir>.md` 索引。

最后核对日期：2026-10-03。

## Electron 设置迁移（规格已发布，2026-10-03）

实施规格：[Issue #8](https://github.com/Lixuhang987/Wisp-Pocket/issues/8)，已标记 `ready-for-agent`。规格正文以 Issue 为准。

- [ ] 新增 menu bar 入口，菜单暂时只有“设置”，点击打开新增的 Electron 设置页面。
- [ ] 第一阶段目标：原生保留 Appearance、快捷键、Host 功能（Context History 状态、Automation）、AgentTrigger 与 Append Prompt；Electron 完整迁移 AI、Agent 的 Tools / MCP / Permissions 与 Pets 现有功能，暂不建立 Prompts 页。
- 已确认：原生设置暂时继续使用 PromptPanel 入口，不新增 Electron 跳转入口；Electron 设置采用独立窗口与 AI / Agent / Pets 分组，每次打开默认 AI，不记住页面，重复打开聚焦已有窗口。
- 已确认：后端使用的数据由后端提供配置接口，现有 JSON 存储可以保留；主题与 Append Prompt 由 Swift 修改。边界理由见 [ADR 0005](./adr/0005-settings-data-ownership.md)。
- [x] 完成设计决策并发布规格：表单使用显式保存按钮；未确认的离页阻拦弹窗不纳入验收。测试边界已确认使用后端公开接口主路径、Electron 窗口 / React 交互及 macOS 实机验收。
- [x] 读取共享产品文档、Settings surface 与跨上下文架构，调查现有设置和入口；本轮仅讨论设计，不修改代码。
- [ ] 确认范围后，从主 checkout 执行 `scripts/create-worktree.sh` 创建 `.worktrees/<task-name>/`，确认独立 CodeGraph 索引与显式 projectPath。
- [ ] 在 worktree 先执行 `scripts/test.sh` 与 `scripts/swiftw build` 分层基线，再沿目标目录指南及父目录读到 `handAgent.md`，开始实现。
- [ ] 完成迁移与必要验证，运行 TypeScript/Web、Swift test/build 提交前检查，更新相关模块文档。
- [ ] spec 实现后由不继承上下文的独立子 agent 审核 spec、代码与文档；确认审核结论，将已实现项移入 `manual-qa.md` 后提交。

## MCP 配置运行刷新（设置迁移之后）

- [ ] 后端配置接口修改 MCP 后，由后端自行刷新连接与工具状态；前端不编排刷新。设置迁移本轮仅交付配置读写接口，保存成功不等于运行连接已更新。

## Workspace 与 Pet 拆分（设计讨论中，2026-10-03）

- [x] 确认 Workspace 一对多 Pet、Pet 一对多 Thread；Pet 的 workspaceId 不可变；同一实际目录复用 Workspace，项目指令来自 AGENTS.md。已同步词表与 [ADR 0006](./adr/0006-workspace-pet-separation.md)，尚未实现、未变更 Issue #8。
- [x] 确认 Thread 直接归属 Pet，同时保存 petId 与 workspaceId；桌宠按 petId 查询，ThreadWindow 按 workspaceId 查询，后端必须保证两种归属一致。
- [x] 确认 Workspace 根不可修改，根目录 AGENTS.md 每个 Turn 开始读取一次；用户明确任务 > 项目规则 > Pet 角色，工具与 Permission 边界保持；本轮不新增 Workspace / Pet 删除。
- [x] 确认 ThreadWindow 展示全部 Workspace，只用 workspaceId 一级分组，不按 petId 筛选；新建只选目标 Workspace 内的 Pet，未指定则后端随机选一只，幂等重试保持首次选择。
- [x] 确认创建 Pet 时选择目录自动创建 / 复用 Workspace，不新增独立 Workspace 管理页；创建 Workspace 自动有一只默认 Pet。
- [ ] 最后确认自动默认 Pet 的含义，以及从 Pet 创建入口产生新 Workspace 时是否将当前 Pet 作为自动成员；在最终规格明确 AGENTS.md 缺失 / 读取失败的反馈。
- 当前事实：Pet 可见集合已是前端按 petId 保存的状态，现阶段没有 Pet 删除接口；完整 Pet 列表同步时只追加 ID 的行为仍需补齐失效项清理。
- [ ] 若进入实现，遵循主 checkout 创建 worktree、独立 CodeGraph 索引与分层基线、目录阅读链、必要验证、独立文档审核、manual QA 更新后提交的既有流程。

## 重启后的排队消息策略

- [ ] 单独确定未开始输入在应用重启后的继续、取消及展示策略；Issue #6/#7 未新增队列控制协议，现有恢复行为与实机回归见 [manual QA](./manual-qa.md)。

## 全功能实机 QA 与缺陷修复（2026-09-14）

目标为验证当前已实现功能；尚未确认的新设计仍按各自待办推进。本轮从主 checkout 的 `main` 打包与操作，证据保存在 `.cache/live-qa-20260914/`。

- [x] 核对主分支、现有修改、产品文档与手工验收范围；保留用户已有研究文档和截图。
- [x] 完成 TypeScript/Web、Swift test/build 基线与正式模型模式打包；产物为主 checkout 的 `dist/Wisp Pocket.app`，签名标识为 `com.yourname.HandAgentDesktop`。
- [ ] 逐项执行 `manual-qa.md` 中功能验收及本轮补充回归；每项立即记录证据并提交。
- [ ] 发现缺陷后停止该轮实机测试，记录 UI、调用链、进程和持久化证据。
- [ ] 修复前从主 checkout 运行 `scripts/create-worktree.sh`，确认独立 CodeGraph 索引；跑分层基线后阅读目标目录文档链与代码。
- [ ] 按复现用例修复，完成必要测试、三项提交前检查与模块文档更新。
- [ ] 完成 spec 实现时，安排不继承上下文的独立子 agent 审核文档；确认结论并把修复加入 `manual-qa.md` 后提交。
- [ ] 将修复带回主分支打包实测；通过项使用 QA 技能脚本归档，仍有问题继续修复。
- [ ] 核对全部功能覆盖及剩余环境限制，恢复临时配置并清理本轮进程和测试数据。

## Wisp Pocket 桌宠后续能力

[Issue #1](https://github.com/Lixuhang987/Wisp-Pocket/issues/1) 的拖入、读取与 Thread 轻量交互已实现；实施与检查状态见 [实施记录](./medium-powers/plans/2026-09-13-desktop-pet.md)，原生待验项见 [manual QA](./manual-qa.md)。

- 用户习惯记忆系统：只改善建议，不产生自动执行权。
- 决定是否呈现工具调用及呈现方式。

## AgentTrigger Chrome 扩展连接可靠性

- 将 Chrome Bookmarks AgentTrigger 的扩展连接链路改成可靠会话模型，避免“先启动扩展或先启动 App，再启动另一端不会自动连接”的问题：
  - Swift desktop 启动 `ChromeBookmarksExtensionBridgeServer` 后继续作为本地 loopback server，写入带 token / generation / updatedAt 的当前 `bridge.json`。
  - Chrome Native Messaging helper 保持短生命周期转发器定位：每条消息读取当前 `bridge.json` 并 POST 到 Swift bridge；若 bridge 不存在、token 失效或转发失败，应主动退出或明确让扩展断开，不能让扩展误以为 port 仍可用。
  - Chrome 扩展作为 client 持有 native port；port disconnect、native response `{ ok: false }` 或发送失败时进入重连；每次重连必须重新发送 hello 和 folder tree snapshot。
  - hello 成功到达当前 Swift bridge 后，App 侧连接状态才视为 connected；状态必须绑定当前 bridge generation / updatedAt，不能复用旧 `status.json`。
  - 业务事件应带 eventId 并支持 ack；如果需要避免收藏事件丢失，扩展侧暂存未 ack 的 `handagent.bookmarks.created`，重连后重放。
  - Settings 的 AgentTrigger 详情页不要只在进入页面时读取 `status.json` / `folders.json`；应使用 observable 状态加文件 watcher 或轻量轮询，实时刷新连接状态和文件夹树。
  - 验证顺序覆盖：先启动 App 后启动扩展、先启动扩展后启动 App、App 重启、Chrome 重启、native host helper 转发失败、Swift bridge generation 变化、断线后新增书签事件恢复。

## Thread / Turn 破坏性重构遗留

### 后续能力与验证

- 后续回收策略：半小时无输入后的内存回收尚未实现。
- 对齐 codex 更完整 Thread / Turn 语义：
  - `thread.archive` / `thread.unarchive`：本轮已选择 `thread.delete` 作为最小可用删除语义，归档能力后续单独设计。
  - `thread.read`：按 threadId 拉取完整 thread 快照或分页读取历史。
  - `thread.fork`：从指定消息或 turn 分叉新 thread。
  - `thread.rollback`：回滚到指定消息或 turn，并明确持久化与 UI 展示规则。
  - Thread metadata 更新：标题、preview 等字段的更新命令与通知。
  - Thread settings 更新与通知：模型、Tool 范围、运行参数等 Thread 级配置变更。
  - goal / budget：目标状态、预算、用量统计及 UI 呈现。
  - realtime：语音、低延迟流式输入输出或实时通道。
  - codex-style `item.*`：细粒度 item 生命周期、局部更新、折叠与重放语义。
  - archived/list/search：归档 thread 的列表、搜索、恢复和删除管理。
  - Thread-level event replay、notification 去重与 request 生命周期。
  - auth refresh request / response：server 触发鉴权刷新、desktop 回执结果的 `ServerRequest` / `ClientResponse` 语义。
  - 子 agent / 多 Turn 并行语义。
  - run hooks 输入记录：把输入写进 Thread 历史，并触发用户配置的 Hooks，例如审计、提示注入。
  - 历史保存顺序：明确 Thread history 初始输入、hook 注入内容与后续消息的持久化顺序。
  - MCP server 激活来源：除全局配置外，后续可由 Dynamic Tool 或显式配置声明启用。
- 补一轮端到端实机验证：Thread 创建、恢复、列表、删除、Turn 中断、Permission 回流。
- 补一轮端到端实机验证：React ThreadWindow 只通过 `/api/thread?acceptServerRequests=1` 承载 Thread / Turn 主协议与交互式请求，Swift PromptPanel 直连 `/api/thread` 创建 Thread 并提交首轮输入，Swift Dynamic Tool Provider 只通过 `/api/dynamic-tools` 承载调用，确认旧 `/api/platform` 不再可用。

---

## 手工验证清单入口

端到端验证步骤见 [manual-qa.md](./manual-qa.md)。每次完成本文条目后，应同步更新对应模块 `<dir>.md`。
