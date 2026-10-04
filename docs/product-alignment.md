# 产品、规格与实现对齐记录

核对日期：2026-10-04。范围为 GitHub Issues #1–#9 的正文与评论、全部本地 spec、产品 / surface、相关架构与关键代码路径；九个 issue 当前均无评论。本文记录决定演进、实现差距与适用范围；[PRODUCT](./PRODUCT.md) 直接表达最终产品意图，不承载实现状态。

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
| [#8 设置与项目](https://github.com/Lixuhang987/Wisp-Pocket/issues/8) | 开放 | 设置、Workspace/Pet 拆分、逐 Turn 项目规则与一级项目历史已合入（`1c322ae4`）；当前代码基线，完整宿主 / 真实模型待验，MCP 运行刷新未实现。 |
| [#9 Pet 前端化](https://github.com/Lixuhang987/Wisp-Pocket/issues/9) | 开放 | 已确认并发布，尚未实现；后端移除 Pet、Thread 仅归 Workspace，前端统一分配伙伴。它是下一轮目标，不应退回 #8 的固定伙伴归属。 |

除 #5 外，当前开放 issue 均仍标记 `ready-for-agent`；这些标签与本地实现状态不完全一致，不能据此重复实施。本轮只读取 GitHub 历史，未修改 issue 正文、评论、标签或开闭状态。

追溯入口：[规格集合](./medium-powers/medium-powers.md)、[桌宠 / 其他 surface](./surfaces/surfaces.md)、[后端 DAG](./backend-state-ownership.md)、[#3 实施记录](./issue-3-design.md)、[ADR 集合](./adr/adr.md)、[manual QA](./manual-qa.md)。

## 影响产品判断的替代关系

| 主题 | 原要求 | 后续已确认决定 | 当前与目标的界线 |
| --- | --- | --- | --- |
| 首次输入与阅读 | #1 首次文字走 PromptPanel，输入焦点保持展开 | #5 点击角色直接输入，仅 hover 展开，移出保留输入 | 已实现；#9 保留这条交互，不引入固定消息面板。 |
| 资料与执行 | #1 自动预读、图片 / PDF 副本、首轮只分析 | #6 按需免确认读取、取消阶段；10-03 使用 `file_reference` | 已实现；资料原文件与角色图片副本、PromptPanel 截图副本分别处理。 |
| 历史采集 | Plugin spec / #4 默认关闭，动态查询 | #6 常驻采集，Node 直接读取保存证据 | 已实现；Automation 的开关与已有修复数据入口仍保留。 |
| 项目与伙伴 | #7 Pet 直接拥有文件根、替代 Workspace | #8 独立 Workspace、固定 Pet 归属与 Thread 双归属 | #8 已实现；同目录共享文件，不合并各 Thread 的模型历史。 |
| 伙伴重新安排 | #8 固定归属、后端角色快照、无 Workspace 管理页 | #9 前端 Pet 可换项目、项目历史分配与独占、首轮普通角色输入 | #9 待实现；当前固定归属和后端快照是迁移对象，不能当作永久产品原则。 |
| 时间与证据 | 活动仅 limit，缩略图支持 start/end；未注入当前时间 | 10-04 已确认简版：首个实际 Turn 注入，距最近已保存注入严格超过一小时才追加；本地偏移证据与显式 start/end | 已实现、真实宿主 / 模型待验；不采用相对窗口、消息接收时刻锚定、时钟工具或额外刷新条件。system 规则版本与时间基准持久化，模型只使用最新有效规则。 |

#7 GitHub 正文中的文件根快照与纯文本路径已被本地后续确认修订；#8 的角色快照不包含文件根，执行根从 Workspace 派生。#9 将进一步删除后端 Pet 与角色快照，不代表本轮已执行迁移。

## 本地 spec 的适用范围

- 六月 AgentTrigger 路径迁移与 React Dynamic Tool 移除文档是历史迁移：Swift 直连 Thread、React 不携带工具集合仍成立；“React Thread 没有动态工具”和“只能显式声明工具”已被服务端在线 Provider 默认规则覆盖。#9 的 Workspace 目标仍待实现。
- Chrome 文件夹选择与默认 Websearch 已实现；真实扩展连接、触发及 provider 验收继续按 manual QA，不能从旧 Background 推断它们仍待开发。
- Context History Plugin 与自进化 Automation spec 的独立插件 / RPC 方案已由 #4 替代；Context History 启停与查询再由 #6 修订。完整模型自主修复仍是后续方向。
- 多宠子树属于 #7 的历史规格。每个子文档应带历史范围说明，保留原验收及设计原因，当前项目模型看 #8，下一轮产品目标看 #9。
- [时间简版 spec](./medium-powers/specs/2026-10-04-time-context-draft.md) 已按后续确认替换讨论草案并完成实现；实施记录与 manual QA 保留自动化范围和实机待验。早期相对窗口或消息接收时刻锚定推荐不再作为本期需求或待确认事项。

## 关键实现证据

- [PetRegistry](../packages/core/src/pet/PetRegistry.ts) 与 [ThreadStore](../packages/thread-store/src/ThreadStore.ts)：后端 Pet、固定项目引用、基础 Pet 与角色快照仍存在，说明 #9 尚未迁移。
- [Thread](../packages/core/src/thread/Thread.ts)、[Runtime 合约](../packages/core/src/runtime/runtime.md)：实际 Turn 读取根 AGENTS.md，当前角色仍来自已有快照；system 更新先落盘再请求模型，规则保留版本但模型只使用最新有效值。首轮及严格超过一小时的时间注入保存 metadata，恢复沿最近已保存基准判断；#9 的首轮普通角色输入仍待迁移。
- [默认读取工具](../apps/agent-server/src/actions/DefaultReadTools.ts)、[Swift/Node 历史合约](../apps/agent-server/src/actions/actions.md)：活动与缩略图均支持 ISO/epoch 的 start/end，包含端点、先过滤再倒序和 limit；Swift 保存本地偏移，Node 对旧 Z 证据也转换为后端本地偏移。文件与四个历史读取免 Permission。
- [SettingsApp](../apps/thread-window-web/src/SettingsApp.tsx) 与 [PetWindowCollection](../apps/electron-shell/src/main/windows/petWindowCollection.ts)：当前 AI / Agent / Pets 导航、后端身份观察与按所属 Pet 召回，尚无 #9 的前端伙伴分配。

本对齐记录修订只同步文档职责、状态与过期说明，未新增功能代码或执行新一轮实机验收。时间实现与共享消息投影合并后，TypeScript/Web、隔离 Foundation home 的 Swift test、Swift build 已通过；内部 system 隐藏和纯建议等待恢复均保留。其后合入 PRODUCT 最终意图的纯文档提交，生产代码与已通过检查的合并版本一致；原有实机待验项继续保留。
