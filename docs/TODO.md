# 待办清单

## 文档维护要求（重要）

- **完成即迁移**：当本文中的待办项被代码实现并通过测试覆盖后，必须将该项**从本文移除**，并按主题分组追加到 manual-qa
- **同步更新模块文档**：若条目跨多个模块，迁移时同步更新对应 `<dir>.md` 索引。

最后核对日期：2026-10-04。

## 时间上下文与历史时间过滤（访谈中）

讨论草案由 [specs 入口](./medium-powers/specs/specs.md) 路由。用户已提出本地证据时间、新 Thread 时间注入、超过一小时的后续提示和工具时间过滤；时间表达、精确窗口与查询基准的推荐语义待一次性确认。

- [x] 读取根架构、领域路由、产品及 owning 文档，核对真实记录、模型请求和 Codex 的日期/时区更新机制。
- [x] 按 grill-with-docs 委派只读工程事实调查，形成明确标记未实现的讨论草案。
- [ ] 用户确认共同理解，收敛草案中本地时间表示、相对窗口解析及消息/执行时间基准。
- [ ] 从主 checkout 运行 `scripts/create-worktree.sh`，确认独立 CodeGraph 索引；后续 MCP 显式传绝对 projectPath。
- [ ] 在 worktree 执行 `scripts/test.sh` 与 `scripts/swiftw build` 基线，再沿 owning 文档链实施。
- [ ] 验证时间注入、持久恢复、消息投影和 Swift/Node 过滤；同步 owning 文档并完成三项提交前检查。
- [ ] 分发不继承上下文的独立文档审核子 agent；确认结论，更新 `manual-qa.md` 并迁出完成 TODO 后提交。

## Pet 前端所有权破坏性重构（规格已发布，待实现）

实施规格见 [Issue #9](https://github.com/Lixuhang987/Wisp-Pocket/issues/9)，架构决策见 [ADR 0007](./adr/0007-frontend-pet-workspace-threads.md)；尚未实现，不计入已实现 manual QA。

- [x] 读取根架构、领域路由、产品与相关 surface / ADR，核对当前模型并启动只读事实调查。
- [x] 完成产品边界访谈并形成 ADR 汇总，覆盖后端移除 Pet、独占 / 不可夺取、历史与 Permission 分配、初始库存、独立前端和首版排除范围。
- [x] 按用户调用的 to-spec 综合设计汇总、工程落点和已明确确认的测试边界。
- [x] 发布 [Issue #9](https://github.com/Lixuhang987/Wisp-Pocket/issues/9)，应用 ready-for-agent 并核对正文和标签。
- [ ] 从主 checkout 使用 `scripts/create-worktree.sh` 初始化 `.worktrees/<task-name>/`，确认 CodeGraph 独立索引；后续 MCP 调用显式传入输出的绝对 projectPath。
- [ ] 在 worktree 跑 `scripts/test.sh` 与桌面启动链相关的 `scripts/swiftw build` 基线，再沿 owning 目录文档链读取代码、实施删除与替换。
- [ ] 完成必要验证及三项提交前检查，同步当前产品、架构和目录文档。
- [ ] 分发不继承上下文的独立文档审核子 agent；确认 spec、代码、文档一致，更新 `manual-qa.md` 并迁出已完成 TODO 后提交。

### 角色提示后续策略（本期之外）

- [ ] 重新确定角色是否改为每次输入采用发送 Pet 的当前角色，以及同一 Thread 被不同 Pet 接续时的角色变化规则。本期只在首轮普通输入中添加角色 prompt，不随伙伴后续修改或更换重新注入，不增加后端角色快照或每轮 system 注入。该简化方案不表示永久选择，后续修改不重新引入后端 Pet 身份。

### 草稿与库存后续策略（本期之外）

- [ ] 确定 Pet 转移 Thread 时未发送草稿的归属与恢复规则；首版不新增草稿转移设计。
- [ ] 确定 Permission 请求因无库存而等待后，新增 / 释放库存时是否自动重试分配；首版只做最小提示并准备十几只内置库存。

## MCP 配置运行刷新（设置迁移之后）

- [ ] 后端配置接口修改 MCP 后，由后端自行刷新连接与工具状态；前端不编排刷新。设置迁移本轮仅交付配置读写接口，保存成功不等于运行连接已更新。

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
