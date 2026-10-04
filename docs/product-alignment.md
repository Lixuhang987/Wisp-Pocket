# 产品、规格与实现对齐记录

核对日期：2026-10-04；已按 Issue #9 与设置分支合并同步实现状态，并核对 Issue #10 的 Codex 委托首版实现。原调查范围为 GitHub Issues #1–#9 的正文与评论、全部本地 spec、产品 / surface、相关架构与关键代码路径；原调查时九个 issue 均无评论。本文记录决定演进、实现差距与适用范围；[PRODUCT](./PRODUCT.md) 直接表达最终产品意图，不承载实现状态。

## 判断依据

- 产品目标采用用户确认的后续决定；待实现目标不能按旧代码回退，草案中的推荐方案不能当成已确认要求。
- 产品文档按最终意图统一书写，不并列新旧模型或“已实现 / 待实现”版本；下面的状态与历史对照只用于工程追溯。
- 当前行为采用代码与 owning 模块文档；历史规格说明当时意图，发布、合入、自动检查与实机验收分别判断。
- 后续决定只覆盖明确改变的范围；旧规格中的点击、hover、资料交付与任务持续等未变合约继续保留。

## GitHub issue 与实现状态

| Issue | GitHub 状态 | 当前结论与追溯入口 |
| --- | --- | --- |
| [#1 桌宠基础](https://github.com/Lixuhang987/Wisp-Pocket/issues/1) | 开放 | 拖入与轻量 Thread 交互已实现；首次文字、浏览、读取与附件保存规则后续修订，不能整份重做。见桌宠 surface 与 manual QA。 |
| [#2 后端所有权](https://github.com/Lixuhang987/Wisp-Pocket/issues/2) | 关闭 | Thread 所有权、持久确认、工具级永久权限已实现；关闭状态不代替剩余人工回归。见后端 DAG 与 manual QA。 |
| [#3 前后端状态](https://github.com/Lixuhang987/Wisp-Pocket/issues/3) | 开放 | 职责拆分已实现（`72787e21`）；旧前端执行队列已被后端持久队列替代。见实施记录与 manual QA。 |
| [#4 内置模块](https://github.com/Lixuhang987/Wisp-Pocket/issues/4) | 开放 | 去 Plugin 已合入（`e4b1ff0d`）；采集开关和历史动态查询由 #6 替换，Automation 仍默认关闭，完整自主修复未交付。实机证据仍按原记录范围判断。 |
| [#5 紧凑与 hover](https://github.com/Lixuhang987/Wisp-Pocket/issues/5) | 开放 | 点击首次输入、固定回复框与 hover 统一滚动已合入（`f54d09f`）；部分原生验收有历史证据，完整多宠实机仍待验。 |
| [#6 默认读取](https://github.com/Lixuhang987/Wisp-Pocket/issues/6) | 开放 | 默认读取、常驻采集与统一首轮执行已合入（`7e352e76`）；文件路径随后改为结构化引用（`12542c24`），没有恢复自动预读或用户文件副本。 |
| [#7 多宠口袋对话](https://github.com/Lixuhang987/Wisp-Pocket/issues/7) | 开放 | 多宠、独立草稿与本宠选择已合入（`7e352e76`）；Pet 替代 Workspace 和按宠分组由 #8 覆盖。历史子树保留原决定，不能当成整份当前模型。 |
| [#8 设置与项目](https://github.com/Lixuhang987/Wisp-Pocket/issues/8) | 开放 | 设置、Workspace/Pet 拆分、逐 Turn 项目规则与一级项目历史已合入（`1c322ae4`）；Pet 所有权与双归属已由 #9 替代，其余设置与项目规则保留；完整宿主 / 真实模型待验，MCP 运行刷新未实现。 |
| [#9 Pet 前端化](https://github.com/Lixuhang987/Wisp-Pocket/issues/9) | 开放 | 已实现（`1b4c6595`）；后端移除 Pet、Thread 仅归 Workspace，前端统一分配伙伴，Codex 风格设置 UI 同时落地。完整宿主 / 真实模型及本次合并实机待验，见 ADR 0007 与实施记录。 |
| [#10 Codex 委托](https://github.com/Lixuhang987/Wisp-Pocket/issues/10) | 开放 | 首版已实现；移除主 Agent 激活/写入/扩展入口，新增 Codex 委托、持久会话归属与设置状态。完整宿主与真实模型待验，扩展迁移/统一终止仍在 TODO；见 ADR 0008 和实施记录。 |

除 #5 外，当前开放 issue 均仍标记 `ready-for-agent`；这些标签与本地实现状态不完全一致，不能据此重复实施。原历史调查只读取 #1–#9；本次 to-spec 创建 #10 并应用标签，未修改其他 issue 的正文、评论或状态。

追溯入口：[规格集合](./medium-powers/medium-powers.md)、[桌宠 / 其他 surface](./surfaces/surfaces.md)、[后端 DAG](./backend-state-ownership.md)、[#3 实施记录](./issue-3-design.md)、[ADR 集合](./adr/adr.md)、[manual QA](./manual-qa.md)。

## 影响产品判断的替代关系

| 主题 | 原要求 | 后续已确认决定 | 当前与目标的界线 |
| --- | --- | --- | --- |
| 首次输入与阅读 | #1 首次文字走 PromptPanel，输入焦点保持展开 | #5 点击角色直接输入，仅 hover 展开，移出保留输入 | 已实现；#9 保留这条交互，不引入固定消息面板。 |
| 资料与执行 | #1 自动预读、图片 / PDF 副本、首轮只分析 | #6 按需免确认读取、取消阶段；10-03 使用 `file_reference` | 已实现；资料原文件与角色图片副本、PromptPanel 截图副本分别处理。 |
| 历史采集 | Plugin spec / #4 默认关闭，动态查询 | #6 常驻采集，Node 直接读取保存证据 | 已实现；Automation 的开关与已有修复数据入口仍保留。 |
| 项目与伙伴 | #7 Pet 直接拥有文件根、替代 Workspace | #8 独立 Workspace、固定 Pet 归属与 Thread 双归属 | #8 曾实现的 Pet 固定归属与双归属已由 #9 替代；同目录共享文件、独立模型历史保留。 |
| 伙伴重新安排 | #8 固定归属、后端角色快照、无 Workspace 管理页 | #9 前端 Pet 可换项目、项目历史分配与独占、首轮普通角色输入 | #9 已实现、实机待验；前端 store 统一分配，角色仅新 Thread 首轮作为普通 skill 输入保存。 |
| 时间与证据 | 活动仅 limit，缩略图支持 start/end；未注入当前时间 | 10-04 已确认简版：首个实际 Turn 注入，距最近已保存注入严格超过一小时才追加；本地偏移证据与显式 start/end | 已实现、真实宿主 / 模型待验；不采用相对窗口、消息接收时刻锚定、时钟工具或额外刷新条件。system 规则版本与时间基准持久化，模型只使用最新有效规则。 |
| 任务执行与写文件 | `use_tools` 懒激活扩展工具，内置 file.write 在固定工作区写入 | 主 Agent 只保留问答、读取与 Codex 委托，判断复杂度、组织上下文并选择新建或 resume 当前 Thread 会话；外层 Wisp Permission，内部用户 Codex 配置与权限，普通工具等待最终结果 | [Issue #10](https://github.com/Lixuhang987/Wisp-Pocket/issues/10) 首版已实现、完整宿主与真实模型待验。现有扩展能力迁移与统一 Tool 终止机制本期暂不做，分别列为后续 TODO；见 ADR 0008。 |

#7 GitHub 正文中的文件根快照与纯文本路径已被本地后续确认修订；#8 的角色快照不包含文件根，执行根从 Workspace 派生。#9 已删除后端 Pet 与角色快照；旧固定归属只作为历史决定保留。

## 本地 spec 的适用范围

- 六月 AgentTrigger 路径迁移与 React Dynamic Tool 移除文档是历史迁移：Swift 直连 Thread、React 不携带工具集合仍成立；“React Thread 没有动态工具”和“只能显式声明工具”已被服务端在线 Provider 默认规则覆盖。#9 的 Workspace 目标已实现；PromptPanel 记忆自身选择，AgentTrigger 独立配置目标。
- Chrome 文件夹选择与默认 Websearch 已实现；真实扩展连接、触发及 provider 验收继续按 manual QA，不能从旧 Background 推断它们仍待开发。
- Context History Plugin 与自进化 Automation spec 的独立插件 / RPC 方案已由 #4 替代；Context History 启停与查询再由 #6 修订。完整模型自主修复仍是后续方向。
- 多宠子树属于 #7 的历史规格。每个子文档应带历史范围说明，保留原验收及设计原因，当前项目与伙伴模型看 #9；#8 的后端设置与逐 Turn 项目规则仍保留。
- [时间简版 spec](./medium-powers/specs/2026-10-04-time-context-draft.md) 已按后续确认替换讨论草案并完成实现；实施记录与 manual QA 保留自动化范围和实机待验。早期相对窗口或消息接收时刻锚定推荐不再作为本期需求或待确认事项。

## 关键实现证据

- [前端 Pet store](../apps/electron-shell/src/main/pets/pets.md) 与 [ThreadStore](../packages/thread-store/src/ThreadStore.ts)：Pet 资料、图片和分配归 Electron main；SQLite 只保存 Workspace 与 Thread，Thread 不携带 Pet 身份或角色快照。
- [Thread](../packages/core/src/thread/Thread.ts)、[Runtime 合约](../packages/core/src/runtime/runtime.md)：实际 Turn 读取根 AGENTS.md；角色是前端首轮普通输入历史。工具策略和项目规则的 system 更新先落盘再请求模型，模型采用最新有效版本；首轮及严格超过一小时的时间注入保存 metadata，恢复沿最近已保存基准判断。
- [默认读取工具](../apps/agent-server/src/actions/DefaultReadTools.ts)、[Swift/Node 历史合约](../apps/agent-server/src/actions/actions.md)：活动与缩略图均支持 ISO/epoch 的 start/end，包含端点、先过滤再倒序和 limit；Swift 保存本地偏移，Node 对旧 Z 证据也转换为后端本地偏移。文件与四个历史读取免 Permission。
- [SettingsApp](../apps/thread-window-web/src/SettingsApp.tsx) 与 [PetWindowCollection](../apps/electron-shell/src/main/windows/petWindowCollection.ts)：分组搜索导航、伙伴画廊与 Workspace 管理；前端唯一分配入口维护独占，轻量观察连接承接任意来源的有效 Permission。
- [Codex 外部适配](../apps/agent-server/src/actions/actions.md) 与 [会话存储](../packages/thread-store/src/src.md)：普通工具等待最终结果；每个 Thread 可保存多个会话，外层 Permission 与内部 CLI 权限分别生效；工作目录不是沙箱，中断不保证子进程停止。
- [共享消息模块](../apps/thread-window-web/src/messages/messages.md)：两端使用同一消息类型与助手内容判断；纯工具历史不产生空气泡，只有建议的等待可从 SQLite 恢复。

时间、共享消息、#9 与设置各分支的自动化证据保留在各自实施记录。本次合并的最终验证由 manual QA 单独记录；既有通过结果不替代合并产物检查，本文不增加真实宿主 / 模型通过结论。Codex CLI 委托首版已实现；删除 `use_tools`、内置 file.write 与失效开关，生产目录只保留默认读取/Web/user.ask/Codex。MCP 与 Dynamic Tool 实现及通道保留，未迁入 Codex。当前检查与烟测范围见 Issue #10 实施记录，完整宿主与真实模型仍按 manual QA 验收。
