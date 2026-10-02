# 调研依据与实施阅读路由

本文服务于[多桌宠规格](./multi-pet-pocket-dialogue.md)。只保留能限定实施、避免错误或确定验证方式的结论；不搬入产品罗列、论文统计、原型剧情或来源全文。

## 基准与决策优先级

本次现状核对主 checkout `main` 的 `e51a1b9c96de8a2bebc40f705a0d4d3d17f0e7a2`；调研固定引用 `codex/pet-dialogue-design-20260914` 的 `be1b8933bd3821ff6108d746db59bf92129b7307`。以用户 2026-10-02 的选择为目标，以当前代码为现状真相，调研 / 设计提案只提供被选择性采纳的依据。

用户已决定：A 方案、本次仅多宠同屏、可自由创建多个宠、每宠角色提示词与图片、后端 Workspace 直接改成桌宠、每宠直接指定一个允许重复的 rootPath、Thread 按宠分区、不需要跨宠转交；现有点击唤出 / 聚焦 / 最新消息、hover 全部当前 Thread 历史与移出收起必须保留。消息阅读状态本次不实现，其他前端的交互改造已移出本规格；测试边界经本轮确认。用户进一步确认角色 / 文件根快照、静态自定义图、读取免 Permission、隐藏宠请求重新显示；本期不做归档、旧数据迁移、桌宠截图 / 剪贴板图片。决策见[实现前记录](./implementation-questions.md)。

多宠窗口共用单后端，前端导航 / 草稿互相独立，遵守 [根架构](../../../../handAgent.md) 的设计边界。其他消费者只因共享协议变化做必要适配，不以修改其体验作为本次验收条件。

## 仅采纳以下调研结论

| 研究 / 设计来源 | 提取的限定结论 | 对本规格的具体影响 |
| --- | --- | --- |
| pet-codebase：Thread 生命周期与持久 owner | 窗口数量不能提供历史身份；人设必须贯穿创建、恢复和 Runtime | Pet 身份 / 快照贯穿协议、Thread 与 SQLite，复用既有 owner，不建另一会话库 |
| pet-codebase：Workspace 关联与文件工具 | 当前 workspaceId 是元数据；工具从全局 registry 按入参找根 | 不用“改字段名”假装完成：移除工具选择另一宠的能力；Thread 文件根快照约束写入和相对路径，读取边界由新决定覆盖 |
| pet-codebase：system sections / Append Prompt | 有现成人设注入位置；Append Prompt 属于 UserInput | 角色走 system section，快照保存配置，不把人设塞成每轮用户消息 |
| pet-products：AIRI、Raycast 的身份与历史边界 | 每角色可有多段历史，选择与后端事实分开 | petId 固定归属，恢复上次主动 Thread，后台通知不抢选 |
| model-and-persona：角色版本 | 改角色不能重写已有任务的来源 | Thread 保存实际提示快照；本规格将同一稳定性要求用于 rootPath |
| pet-platform-hci：透明与焦点 | 透明窗口不天然穿透；hover / 后台不应激活输入 | 实际命中矩形与 sender 绑定沿既有窗口边界扩展；单独做原生焦点 / 多屏验收 |
| pet-platform-hci：drop 目标与异步物化 | 最终松手固定接收路由，延迟读取不能追随之后的选择 | 捕获 petId / new-or-append / threadId 后再异步接收原文件路径，失败不改投 |
| 当前 desktop-pet surface / renderer | 点击唤出并聚焦，常态最新消息，仅 hover 对话区展示全部当前 Thread 历史，移出立即回常态 | A 保留这三个状态、统一滚动和草稿 / 焦点；调研的固定面板推荐不纳入此次范围 |
| pet-codebase：Permission | 其他需审批工具的永久决定全局按工具名生效 | 角色不改变授权，写入仍受快照文件根约束；file.read 免确认由用户新决定覆盖 |
| prototype-results / 平台实测边界 | 模拟回复 / 保存不证明生产效果，窗口试验不证明任意跨 App 行为 | 不承诺 99%、能耗或三宠性能；采用自动化链路 + macOS 实机两种证据 |

## 明确覆盖或不采纳的旧提案

- 原调研“PetProfile 与 Workspace 正交、每宠可选多个 Workspace、随聊无 Workspace、按 Workspace 分组”全部由用户新决定覆盖；目标只有 Pet 自带 rootPath，按 petId 分组。
- 共享输入遵守 [ADR 0004](../../../adr/0004-context-history-default-tools.md)：取消 inspect/reply、原文件路径交付、默认免确认读取；不采纳旧预读 / 阶段限制或读取限于 rootPath 的提案。
- 调研三宠是示例，不固定八千代 / Miku / 小八、角色职业、图片或数量。
- 不采纳调研新增的固定消息面板 / 点击锁定展开 / 多个固定阅读面；长文仍由 hover 浏览，其他 Thread 由单独选择弹层切换，不改变现有工具过程呈现。
- 旧设计 ADR-0004 为 proposed，位于调研分支而未进入当前 main；其中独立 Workspace 和跨宠物转交不再适用，其稳定归属 / 提示快照边界保留。
- 不采纳跨宠摘要转交、群聊、自动记忆 / RAG、每宠模型和能力配置、语音、B 布局、独立 C 形态、队列暂停、宿主资源租约或文件版本合并。
- 原审计关于“首次文字不可用”的结论已过时：当前桌宠已有空态首次文字与持久确认，保留并按 Pet 扩展；当前桌宠仍按全局最新创建时间选 Thread，必须改。

## 来源复核

报告原件保留在调研分支，本轮不 cherry-pick 整个文档树。使用 `git show be1b8933bd3821ff6108d746db59bf92129b7307:<仓库相对路径>` 读取下列原件：

- `docs/research/2026-09-14-pet-codebase.md`、`docs/research/2026-09-14-pet-platform-hci.md`、`docs/research/2026-09-14-pet-products.md`。
- `docs/design/pet-dialogue/model-and-persona.md`、`interaction.md`、`architecture.md`、`prototype-results.md` 和 `decisions.md`（后四者均在同一 pet-dialogue 目录）。
- `docs/adr/0004-pet-owned-conversations.md`：只作为旧提案来源，不能作为已接受并已实现事实。

## 当前事实与阅读路由

先读 [根架构](../../../../handAgent.md) → [术语路由](../../../../CONTEXT-MAP.md)；涉及 UI 时先从 [docs](../../../docs.md) 读 PRODUCT → [surface 索引](../../../surfaces/surfaces.md) → [桌宠现有合约](../../../surfaces/desktop-pet.md)，再按任务进入下表 owning 模块及其 `<dir>.md`，最后筛选调研。当前 glossary 仍将 Workspace 定义为命名文件边界、桌宠定义为轻量界面，这是待实现模型变化，不在本轮提前改成已经存在的 Pet 领域实体。

| 实施范围 | 阅读入口与需要核对的边界 |
| --- | --- |
| 后端实体 / Thread / Runtime / Tool | [packages](../../../../packages/packages.md) → [core](../../../../packages/core/core.md) → [src](../../../../packages/core/src/src.md)；依次深入 workspace、thread、protocol、runtime、tools 与 adapters，核对 ADR-0001 的唯一 owner 与 ADR-0002 的全局权限 |
| 协议组合 / 持久化 | [apps](../../../../apps/apps.md) → [agent-server](../../../../apps/agent-server/agent-server.md) → src / thread / server；[thread-store](../../../../packages/thread-store/thread-store.md) → src，核对写入顺序、Blob 与残缺 Turn 恢复 |
| A 界面 / 窗口 / IPC | [electron-shell](../../../../apps/electron-shell/electron-shell.md) → src → activity-window / main / preload → windows，核对窗口 sender、命中、位置和主题 |
| 原生管理 / 触发器 | [desktop](../../../../apps/desktop/desktop.md) → Sources → Settings / AppServices → AgentServer / AgentTrigger / ElectronShell，核对配置改经后端入口与触发归属；不增加其他前端的交互要求 |
| 产品 / 视觉 / 验收 | [docs](../../../docs.md) → PRODUCT / surfaces；视觉遵守 [DESIGN](../../../../DESIGN.md)，实机记录进入 [manual QA](../../../manual-qa.md) |

当前 Workspace 文档的请求接收方及 ADR-0002 的实现状态存在漂移，本轮仅按当前代码修正这些现状说明；新的 Pet 架构和术语等到实现时更新。未实施能力仍留在 TODO，本地文档交付记录与未来产品实机验收明确分开。
