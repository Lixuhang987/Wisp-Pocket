# 桌宠常态收紧与悬停统一滚动实施计划

## 状态与需求来源

2026-09-14 `grill-with-docs` 访谈的六项选择已收敛，待用户确认完整理解后发布 GitHub 规格并实施。当前仅更新设计记录与术语，没有修改代码或新增实机验收结论。

本次调整替代 [Issue #1](https://github.com/Lixuhang987/Wisp-Pocket/issues/1) 及[旧浮动气泡方案](./2026-09-13-pet-floating-bubbles.md)的部分展示约束。术语以 [Desktop Experience](../../../apps/desktop/CONTEXT.md) 为准。

## 已确认目标

- 对话列由 280px 缩小四分之一至约 210px，回复框约 44px 高；回复框作为常态与悬停的固定锚点。
- 常态由下向上放回复框、全部当前建议选项、最新非空 assistant 气泡；无选项不占位。正文显示开头最多三行，超出直接裁剪。
- 仅对话区 hover 触发展开；鼠标离开即回常态，保留输入焦点与草稿，聚焦本身不展开历史。
- 展开后上方历史、最新消息和当前选项进入一个滚动容器；最新消息使用与历史相同的组件并完整展开。回复框留在滚动区外。
- 两种展示都按上方容器裁剪溢出。每次进入 hover 回到底部，不保存跨次展开的阅读位置；单次展开内复用现有底部跟随行为。
- 点击角色切换整套对话显隐，唤出时自动聚焦；移除气泡 ×。无既有 Thread 时也可打开回复框，并在首次发送时创建 Thread。

## 用例与接口边界

| 用例触发 | 复用或扩展路径 | 可观察结果与验证边界 |
| --- | --- | --- |
| Thread 通知生成正文与建议 | `PetThreadController` → 现有 store 投影 → renderer 常态布局 | 零选项不留白、全部选项自然叠加、正文三行裁剪；像素几何由真实 renderer 验证 |
| 进入/离开对话区 | renderer hover 状态 → `PetConversation` 与固定 `PetReply` | 单一滚动区、展开全文、每次展开到底部；回复节点、焦点和草稿持续保留 |
| 单击角色 | renderer 点击入口 → controller hide/reveal → 回复框聚焦 | 隐藏与恢复不改变 Thread；拖动结束不误触切换；系统焦点另做原生验证 |
| 无历史时首次发送文字 | `ThreadInputController.startInitialPrompt` → `thread.start` → 首轮 UserInput 关联 | 打开空框不创建 Thread，发送才创建；随后回复追加同一 Thread |
| 选项增高或屏幕高度不足 | renderer 内容布局 → preload 布局/命中上报 → 原生窗口边界 | 回复框与角色锚点固定，顶部裁剪；可见内容可交互、裁剪部分不拦截外部点击 |

- Thread、UserInput、建议与请求继续使用既有协议；不新增另一套历史、输入队列或后端消息类型。
- 首条纯文字采用普通 UserInput；拖入继续采用既有 inspect 语义与最终松手分流。Permission/Workspace 保持既有唯一回执。
- 对话显隐、hover、草稿与滚动属于 renderer；Electron main 只拥有窗口、系统焦点与命中，不能持有 Thread 内容。
- 初始纯文字复用输入控制器的 clientRequestId 关联与缓冲；接收失败时的界面处理需沿用既有错误通道，不能将本地发送调用返回误当作持久接收确认。
- 主动隐藏仍保留草稿，后台通知不解除隐藏；再次点击或主动拖入恢复。hover 与后台更新不主动聚焦。

## 先验证的用例

- `tests/activity-window/pet-interaction.test.tsx`：用真实 React、store 和输入控制器串起通知、hover、角色切换、自动聚焦、首次发送及后续回复；仅替换 socket/宿主边界。
- 同一入口验证长历史每次展开回到底部、单次展开底部跟随、当前建议移入统一浏览区与回复草稿持续保留。
- `tests/use-cases/pet-window.test.ts`：若调整尺寸或布局桥接，先验证回复列/角色锚点、屏幕可用高度与裁剪命中合约。
- CSS 高度、窗口穿透、原生焦点与中文输入法不能用 JSDOM 的手工几何证明；通过当前构建的桌面 UI 验证，并记录实际证据。
- 不为被移除的 × 或旧嵌套滚动分别增加否定测试，以新的用户交互流程验证替代行为。

## 执行顺序

1. 获得完整设计确认后，从主 checkout 使用 `scripts/create-worktree.sh` 创建任务 worktree，核对脚本输出的 CodeGraph projectPath。
2. 先跑仓库 TypeScript/Web 分层基线；涉及桌面启动链路则追加 Swift build。沿目标目录指南向上核对到 `handAgent.md`，再浏览与修改代码。
3. 扩展上述用例，调整消息/选项与固定回复框的组合、常态裁剪、单一滚动、点击显隐、首次文字和主动聚焦。
4. 跑专项用例及仓库 TypeScript/Web、Swift test/build、所需 Electron build；完成与本次改动有关的原生验收。
5. 派不继承上下文的独立子 agent 审核规格、修改目录文档链和代码，更新 DESIGN、renderer、窗口与测试约定。
6. 将已实现项目从 TODO 迁入 manual QA，区分自动检查与原生通过项；确认文档审核已返回后提交。

## 当前证据与交付边界

只读检查已定位固定控件最小高度、焦点保持展开、三处滚动面与点击仅恢复等旧行为。没有执行应用测试或实机操作；`manual-qa.md` 仍描述当前实现，待代码完成后同步替换相关验收要求。
