# 待办清单

## 文档维护要求（重要）

- **完成即迁移**：当本文中的待办项被代码实现并通过测试覆盖后，必须将该项**从本文移除**，并按主题分组追加到 manual-qa
- **同步更新模块文档**：若条目跨多个模块，迁移时同步更新对应 `<dir>.md` 索引。

最后核对日期：2026-09-01。

---

## Wisp Pocket 桌宠交互

- 已确认规格：[Wisp Pocket：以月见八千代桌宠承接拖入与 Thread 轻量对话 #1](https://github.com/Lixuhang987/SpotAgent/issues/1)，标记 `ready-for-agent`；设计与验收以该 Issue 为准，尚未实现。
- 重要后续 TODO：用户习惯记忆系统，只改善建议，不产生自动执行权。
- 后续 TODO：桌宠内切换 Thread；决定是否呈现工具调用及呈现方式。
- [ ] 实现前读取目录文档链，从主 checkout 创建并初始化 worktree，确认 CodeGraph 路径并运行分层基线。
- [ ] 按规格完成实现与验证；由独立、无上下文继承的子 agent 审核规格、代码与文档，更新 manual-qa 后提交。

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

### 后端 Thread 所有权重构（Issue #2）

- 已实现并提交：core `ThreadRegistry` / `Thread` 统一管理加载、历史、输入队列、Turn、交互请求、工具激活、中断、删除与关闭；agent-server 仅负责 socket、协议翻译与依赖组合。
- 已实现并提交：持久化确认顺序、保存失败暂停与恢复、连接断开后继续执行、删除晚到结果隔离、MCP 并发复用与有界清理。
- 已实现并提交：Permission 仅支持 once / always；永久规则按工具名称跨 Thread 与重启生效，Web 与 Swift 设置同步。
- 后续回收策略：半小时无输入后的内存回收仍不实现。

### 前后端状态所有权收敛（Issue #3）

- [设计讨论](./issue-3-design.md) 已确认保持行为、保留 core 与连接适配边界、将全仓库目录整理拆出；剩余边界尚待确认，未开始实现。
- [ ] 完成设计讨论并确认共同理解，再同步实施规格。
- [ ] 实现前读取目标目录文档链至根架构，从主 checkout 用规定脚本创建并初始化 worktree，确认 CodeGraph 路径并运行分层基线。
- [ ] 完成实现与验证，更新 owning 模块文档；由独立、无上下文继承的子 agent 审核规格、代码与文档，更新 manual-qa 后提交。

### 后续能力与验证

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
