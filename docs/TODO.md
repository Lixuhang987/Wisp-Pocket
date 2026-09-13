# 待办清单

## 文档维护要求（重要）

- **完成即迁移**：当本文中的待办项被代码实现并通过测试覆盖后，必须将该项**从本文移除**，并按主题分组追加到 manual-qa
- **同步更新模块文档**：若条目跨多个模块，迁移时同步更新对应 `<dir>.md` 索引。

最后核对日期：2026-09-14。

---

## 桌宠常态布局与悬停浏览（待最终确认）

2026-09-14 用户通过 `grill-with-docs` 明确以下目标，尚未修改实现。用例、接口与验证步骤见[实施计划](./medium-powers/plans/2026-09-14-pet-compact-hover.md)；它将替代旧浮动气泡方案中“最新气泡固定、历史与正文分别滚动”的约束。

已明确的目标：

- 常态以底部回复框为锚点，建议选项与最新气泡向上叠加；没有选项时不保留选项空白，缩小显示尺寸，长气泡裁剪且不提供内部滚动。
- 已确认 Q2–Q3：对话列按现有 280px 缩小四分之一至约 210px，回复框约 44px 高；正文显示开头最多三行；常态展示全部建议选项，随内容向上自然增高。
- 悬停时回复框固定，上方历史、最新气泡与当前选项进入同一个滚动容器；最新气泡展开为与其他消息相同的组件。
- 已确认 Q1：展开只由对话区悬停决定；鼠标离开即收回常态，保留回复框焦点与草稿，自动聚焦本身不触发展开。
- 移除常态气泡的关闭按钮，改用点击桌宠隐藏或唤出对话；点击唤出时自动聚焦回复框。
- 已确认 Q4：没有既有 Thread 时也允许点击桌宠唤出回复框并自动聚焦，直接开始首轮纯文字对话；该要求替代 Issue #1 的首次文字仅由 PromptPanel 承接规则。
- 已确认 Q5–Q6：常态与悬停均裁剪上方容器溢出；每次进入悬停都回到底部，不保存跨次展开的阅读位置。

当前待办：由用户核对完整约定并确认共同理解，再发布 GitHub 规格与开始实现。

执行 TODO：

- [x] 读取相关上下文与目录文档链到 `handAgent.md`，核对现有 Issue #1 和旧方案。
- [ ] 完成设计访谈，记录确认的术语与需求，并由用户确认共同理解。
- [ ] 从主 checkout 执行 `bash ./scripts/create-worktree.sh <task-name>`；确认 CodeGraph 使用该 worktree 的绝对路径且索引有效。
- [ ] 在 worktree 跑 `bash ./scripts/test.sh` 分层基线；若涉及桌面启动链路，追加 Swift build，再开始实现。
- [ ] 实现常态收紧、悬停统一滚动、角色点击切换与主动聚焦，并验证相关用户流程。
- [ ] 执行 TypeScript/Web、Swift test/build 及所需 Electron build；原生布局、命中与焦点另做实机验收。
- [ ] 由不继承上下文的独立子 agent 审核需求、代码及相关目录文档，更新过期约定。
- [ ] 将完成项迁移到 `manual-qa.md`，确认审核结论与文档一致后提交。

## Wisp Pocket 桌宠后续能力

[Issue #1](https://github.com/Lixuhang987/Wisp-Pocket/issues/1) 的拖入、读取与 Thread 轻量交互已实现；实施与检查状态见 [实施记录](./medium-powers/plans/2026-09-13-desktop-pet.md)，原生待验项见 [manual QA](./manual-qa.md)。

- 用户习惯记忆系统：只改善建议，不产生自动执行权。
- 桌宠内切换 Thread。
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
  - Thread metadata 更新：标题、preview、Workspace 等字段的更新命令与通知。
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
- 补一轮端到端实机验证：Thread 创建、恢复、列表、删除、Turn 中断、Permission / Workspace 回流。
- 补一轮端到端实机验证：React ThreadWindow 只通过 `/api/thread?acceptServerRequests=1` 承载 Thread / Turn 主协议与交互式请求，Swift PromptPanel 直连 `/api/thread` 创建 Thread 并提交首轮输入，Swift Dynamic Tool Provider 只通过 `/api/dynamic-tools` 承载调用，确认旧 `/api/platform` 不再可用。

---

## 手工验证清单入口

端到端验证步骤见 [manual-qa.md](./manual-qa.md)。每次完成本文条目后，应同步更新对应模块 `<dir>.md`。
