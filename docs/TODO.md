# 待办清单

## 文档维护要求（重要）

- **完成即迁移**：当本文中的待办项被代码实现并通过测试覆盖后，必须将该项**从本文移除**，并按主题分组追加到 manual-qa
- **同步更新模块文档**：若条目跨多个模块，迁移时同步更新对应 `<dir>.md` 索引。

最后核对日期：2026-09-14。

---

## 默认读取工具与桌宠路径输入（2026-10-02，规格发布）

完整规格与验收见 [Issue #6](https://github.com/Lixuhang987/Wisp-Pocket/issues/6)（`ready-for-agent`），架构决定见 [ADR 0004](./adr/0004-context-history-default-tools.md)。共享后端默认开放历史读取、任意路径 `file.read` 和按需 `user.ask`，取消输入分阶段；仅桌宠改为原路径输入，其他独立前端保持现状。Swift 常驻采集，失败状态在设置中显示。以上尚未实现，保留与自动删除后续单独设计。

- [x] 核对共享创建入口、当前工具懒激活及 `inspect` 限制；本轮设计讨论和文档记录无需 worktree。
- [x] 确认 Node 历史读取、后端统一首轮开放、Swift 常驻采集及取消开关，记录 ADR。
- [x] 确认彻底移除分阶段执行限制、四个历史读取工具免确认、采集失败保留旧历史查询与设置提示；记录 ADR，并核对附件读取须与模式字段解耦。
- [x] 用户补充确认删除 `UserInput.mode`；PDF、图片等以路径提交，由 LLM 调用默认开放的文件读取 Tool 实际读取，第一版允许任意路径，取消后端自动预读。
- [x] 用户确认直接替换 `file.read`、默认开放且免确认、直接引用原路径不保存副本；原文件变更后读当前内容，失效明确报错。
- [x] 用户确认以现有客户端到真实 Thread/Runtime/SQLite 的主路径为主要测试边界，补充 Swift 采集/设置状态和原生/真实多模态 QA。
- [x] 用户修正范围：输入前端只调整桌宠，其他独立前端保持现状；桌宠路径使用现有文本 Input Item，PromptPanel 截图继续当前图片协议，宿主设置仅做已确认的采集修改。
- [x] 规格发布为 Issue #6，标记 `ready-for-agent`；回读核对范围、33 条用户故事及 21 项自动化验收，文档交付已记录到 manual QA。
- [ ] 后续实现任务从主 checkout 通过 `scripts/create-worktree.sh` 创建 worktree，确认 CodeGraph 索引并运行分层基线，再阅读目标目录文档链、修改代码。
- [ ] 验证实现，更新 owning 文档及 manual QA，安排不继承上下文的独立子 agent 审核 spec / 代码 / 文档，完成三项提交前检查并提交。

## 多桌宠 A「口袋对话」本地规格（2026-10-02）

- [x] 实现前澄清核查：读取 spec / surface / glossary / 新输入 ADR，并由独立只读子 agent 核对窗口、请求与队列事实；纯文档任务无需 worktree。
- [ ] 回答[实现前澄清清单](./medium-powers/specs/multi-pet-pocket-dialogue/implementation-questions.md)后，统一共享输入 / 文件边界和多宠流程；推荐尚未确认，暂不实施。
- [x] 本轮范围收敛先核对 spec、surface 与根架构；仅修文档，无需 worktree，保留其他任务的未提交修改。
- [x] 清理本次不做的显示方式、消息阅读状态及其他前端设计 / 验收，补充单后端与独立前端的架构边界。
- [x] 故事与验收编号、文档链接和 diff 检查通过；TypeScript/Web、Swift test/build 三项提交前检查通过，manual QA 已更新，仅本轮文档随任务提交。
- [x] 本轮修订先核对 surface、所属目录文档及 renderer：点击唤出并聚焦、常态最新消息、hover 全部当前 Thread 历史已写明且已实现；纯文档修订无需 worktree。
- [x] 删除 spec 与验收中新增的固定消息展开状态，补充 surface 的现有交互保留基线及上级阅读路由。
- [x] 核对文档链接与一致性，TypeScript/Web、Swift test/build 三项提交前检查通过，manual QA 已记录规格修正；仅本轮文档修改随任务提交。
- [x] 核对主 checkout 修改、目录文档、领域术语与调研分支；本轮仅写文档，无需 worktree。
- [x] 对照当前代码筛选调研结论，明确自由创建、角色提示与图片、桌宠直接替代 Workspace 并持有可重复 rootPath、不做跨宠转交的边界。
- [x] 用户确认复用桌宠入口到真实 Thread/Runtime/SQLite 的测试边界；原生窗口行为另做实机验收。
- [x] 保存可执行 [spec](./medium-powers/specs/multi-pet-pocket-dialogue/multi-pet-pocket-dialogue.md)、协议及数据约束和验收场景，更新直接父目录索引。
- [x] 检查规格链接、需求一致性与 diff，完成 TypeScript/Web、Swift test/build 三项提交前检查；文档交付记录已加入 manual QA，本轮文档随任务提交。
- [ ] 后续实现须从主 checkout 通过 `scripts/create-worktree.sh` 创建独立 worktree，确认 CodeGraph 索引并跑分层基线，再读目标目录文档、修改代码及验证。
- [ ] 实现完成后更新 owning 文档，安排不继承上下文的独立子 agent 审核 spec / 代码 / 文档，更新 manual QA，执行三项提交前检查后提交。

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
