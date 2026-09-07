# 待办清单

## 文档维护要求（重要）

- **完成即迁移**：当本文中的待办项被代码实现并通过测试覆盖后，必须将该项**从本文移除**，并按主题分组追加到 manual-qa
- **同步更新模块文档**：若条目跨多个模块，迁移时同步更新对应 `<dir>.md` 索引。

最后核对日期：2026-09-01。

---

## Wisp 桌宠交互（设计访谈中）

- 已确认：将 StatusBubble 改为桌宠；首版聚焦“拖入 → 理解 → 一个小决定”，用户选择后交给 Codex CLI 执行。
- 已确认：初始只显示下方桌宠；拖入后上方显示单个 Wisp 聊天气泡及选项。点击选项等价于发送对应用户消息；执行期间继续显示最新消息。
- 已确认：常态仅显示最新消息；鼠标 hover 时展开历史，Wisp 消息在左、用户消息在右。
- 已确认：展开历史底部提供自然语言输入框；输入框获得焦点时保持展开，失去焦点且鼠标离开后恢复单气泡。
- 已确认：Wisp 是统一 Thread 的渲染入口（用户称 session），不单独建立 Wisp 对话系统；首版只展示最新 Thread，“最新”的判定待明确。
- 已确认：拖入根据鼠标最终松开的区域决定新建 Thread 或追加到已有 Thread；区域映射待明确。
- 已确认：气泡长时间保留，仅点击或退出 App 才消失；具体点击目标、收起后的恢复入口待定。
- 已确认：支持文本、图片、链接、PDF；拖入后自动读取内容，结合用户习惯提出建议。允许必要读取工具，不提供大量无关工具。
- 已确认：Wisp 不会自动执行建议；用户明确选择后才可交给执行端。自动读取输入内容不属于执行建议，习惯不会升级为执行授权。
- 已确认：拖入内容需持久保留，未选择建议、重启后仍能找回；图片和 PDF 保存副本，其他内容使用已有文本及 history 留存机制，不额外处理。
- 已确认：首版信息不足就追问，不设置记忆系统。
- 重要 TODO：后续增加用户习惯记忆系统；记忆只能改善建议，不能产生自动执行权。
- 后续 TODO：在桌宠处切换 Thread。
- 待决策：拖入区域映射、最新 Thread 判定、气泡关闭与恢复、读取失败、运行中追加输入及后台 Thread 请求的呈现。
- [ ] 完成设计访谈并由用户确认共同理解，再进入实现。
- [ ] 读取涉及目录文档及父级链；从主 checkout 运行 `scripts/create-worktree.sh` 创建并初始化 worktree，确认 CodeGraph 索引路径。
- [ ] 运行分层基线，再修改代码；完成适用验证及提交前检查。
- [ ] 同步文档；spec 实现完成后由独立、无上下文继承的子 agent 审核文档；更新 manual-qa 后提交。

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
