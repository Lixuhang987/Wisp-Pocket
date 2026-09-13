# 桌宠常态收紧与悬停统一滚动实施计划

## 状态与需求来源

2026-09-14 用户通过 `$implement` 确认实施；规格为 [Issue #5](https://github.com/Lixuhang987/Wisp-Pocket/issues/5)。实现、必需检查、两轴代码审核与独立文档审核已完成；当前包的常态布局、悬停浏览、输入焦点和顶部裁剪已核对。完整证据与尚待人工复验的边界见下文。

工作区：`.worktrees/pet-compact-hover-20260914`，分支 `codex/pet-compact-hover-20260914`；CodeGraph projectPath 为 `/Users/mu9/proj/handAgent/.worktrees/pet-compact-hover-20260914`。代码审核以启动提交 `ca1c02b` 为基点。

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
- 首次接收等待期间只接受一次发送；以匹配的 `user.message.recorded` 确认接收，创建返回不误清首轮草稿，确认不擦掉随后新编辑的文字；创建/提交失败时保留可继续编辑的输入，重试已有空 Thread 也等待接收确认。
- 同一入口验证长历史每次展开回到底部、单次展开底部跟随、当前建议移入统一浏览区与回复草稿持续保留。
- `tests/use-cases/pet-window.test.ts`：若调整尺寸或布局桥接，先验证回复列/角色锚点、屏幕可用高度与裁剪命中合约。
- CSS 高度、窗口穿透、原生焦点与中文输入法不能用 JSDOM 的手工几何证明；通过当前构建的桌面 UI 验证，并记录实际证据。
- 不为被移除的 × 或旧嵌套滚动分别增加否定测试，以新的用户交互流程验证替代行为。

## 执行 TODO

- [x] 获得完整设计确认；从主 checkout 使用仓库脚本创建任务 worktree，确认 CodeGraph projectPath 与索引。
- [x] 跑 TypeScript/Web 与 Swift build 分层基线；后端超时项降低并发复跑通过，详情见下方证据。
- [x] 阅读修改目录与父级指南到 `handAgent.md`，扩展用户流程并完成常态裁剪、统一滚动、点击显隐、首次文字和主动聚焦。
- [x] 最终专项交互/原生边界 29 项、真实 Thread/SQLite 桌宠用例 19 项及完整 Electron build 通过。
- [x] 最终 `bash ./scripts/test.sh` 通过。
- [x] 最终 `bash ./scripts/swiftw test` 通过。
- [x] 完成首轮失败重试、空 snapshot 占位和附件读取期间隐藏修正后的专项与仓库回归。
- [x] 完成最终 `bash ./scripts/swiftw build`。
- [x] 独立且不继承上下文的子 agent 核对 Issue #5、计划、代码及逐级目录文档，更新设计、renderer、窗口、preload、测试与首轮输入说明。
- [x] 已实现产品目标移出 TODO，并更新 manual QA；原 Issue #1 无关待验项保留，不手动归档。
- [x] 使用当前打包产物核对本次关键原生行为，其余未完整覆盖的分项继续保留在 manual QA。
- [x] 主 agent 使用 skill 脚本归档已完整通过的“常态紧凑布局”单项。
- [x] 主 agent 确认独立审核返回、文档一致及必需检查后提交。

## 当前证据与交付边界

本轮日志位于 worktree 的 `.cache/pet-compact-hover/`，不把历史分支或旧包的实机结果算入本轮。

- 初次 `baseline-web.log` 的 Web/Electron 阶段通过，后端/core 有 8 项并发超时；使用 `--maxWorkers=2` 复跑为 299 passed / 1 skipped，原超时均通过，见 `baseline-core-retry.log`。Swift 基线构建通过，见 `baseline-swift.log`。
- 首轮交互红阶段为 11 failed / 14 passed，见 `interaction-red.log`；实现后的交互与原生窗口边界为 27 passed，见 `interaction-green.log`。
- 真实 Thread/SQLite 的 `pet-conversation` 为 19 passed，见 `pet-backend.log`；完整 Electron build 包含 renderer 类型检查，通过结果见 `electron-build.log`。
- Spec 审核发现并关闭两项问题：首次提交失败后，已有空 Thread 的重试也须等待持久记录，且不能把 snapshot 的本地占位误认作已接收；附件异步读取完成不得覆盖期间的主动隐藏。对应红阶段见 `retry-snapshot-red.log`、`drop-hidden-red.log`，最终 22 项 renderer + 7 项窗口边界全部通过，见 `review-fixes-green.log`。
- 修正后的仓库 TypeScript/Web、Swift test/build 均通过，见 `final-web-after-review.log`、`final-swift-test.log`、`final-swift-build.log`。`bash ./scripts/package-app.sh --mock-llm` 通过，见 `package.log`；包内 25 个 Electron 产物与本 worktree 构建完全一致，见 `package-consistency.json`。
- Standards 最终复核为 0 项违规、0 项需报告的代码异味；Spec 最终复核已关闭全部发现。独立文档审核已同步受影响的当前行为说明与 DFS 索引，旧浮动气泡方案显式标为历史。

## 当前包原生验证（2026-09-14）

运行本 worktree 的 `dist/Wisp Pocket.app`，使用 mock LLM、独立位置文件和本地 WebSocket 夹具。屏幕为 1440×932，可用区从 y=34 开始；Computer Use 提供可见 UI、输入和滚动操作，只读 DevTools 几何与夹具命令记录用于交叉核对。夹具只验证呈现和通知关联，真实 Thread/SQLite 接收由上面的业务用例证明。

- **常态几何**：零、一、四个有效选项均为 210px 对话列和 44px 回复框。零选项时最新短气泡与回复框仅隔 8px；一项和四项均自然向上排列，窗口分别为 208px、383px 高。长正文的行高为 21.45px，常态正文高度为 64.34px，截图只显示开头三行。见 `05-no-suggestions.json`、`06-one-suggestion.json`、`07-four-suggestions.json`。
- **统一滚动与焦点**：展开后最新正文解除三行限制，和历史、选项共享滚动区，回复框始终位于屏幕 y=814。上翻后追加内容，scrollTop 保持 1092.5；移出后回常态，保留输入焦点和草稿并可继续键入。再次进入后回到底部 1796.5，后续增量继续跟随到 1861。见 `09-expanded-bottom.json`、`11-reading-older.json` 至 `15-follow-bottom.json`，并与本轮 Computer Use 截图核对。
- **首条输入**：无历史时点击即显示空回复框，未发送前没有 `thread.start`；隐藏再打开保留草稿。模拟连续两次保存失败，文字仍可编辑；匹配接收通知后清空，后续回复仍提交同一 Thread。见 `02-empty-focused.json`、`03-retry-failed.json`、`04-first-input-commands.json`。
- **顶部裁剪**：通过独立位置文件把角色底部设在 y=320，常态与展开窗口均限制为 286px 高；回复框 y=268、角色位置在两状态间不变。常态裁掉上方内容，展开可滚动查看历史。见 `17-edge-start.json`、`17-edge-compact.json`、`18-edge-expanded.json`、`19-edge-scrolled.json`。

### 未验边界与清理

- 中文粘贴和英文连续输入已核对；中文输入法候选、Enter/Shift+Enter 组合、多屏与四角移动、真实系统透明穿透仍在 [manual QA](../../manual-qa.md)。不把这些整项标为通过。
- Computer Use 的指针事件可触发 renderer hover/滚动，但透明间隙操作请求的位置为屏幕约 (1128, 264)，系统光标仍在 (933.18, 166.35)。角色移动和下层点击的系统命中未被可靠触发；证据见 `native-pointer-evidence.log`、`underlay-clicks.json`，不据此判断产品缺陷。
- 重启夹具时曾遗漏 Thread 列表的 `updatedAt`，导致排序异常；已补齐夹具字段并使用新的通知 ID，再完成顶部验证。早期六选项样本也超过现有协议上限四项，改用全部四项验收；本轮未改协议上限。
- 本轮 App、Electron、agent-server、夹具和测试底板已停止，4317、4328、9237 端口均释放。真实模型设置及主 checkout 的用户文档、截图改动均未修改。
