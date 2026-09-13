# 桌宠独立气泡与角色缩放

本文保留 2026-09-13 的需求与证据。焦点保持展开、主气泡原位、正文与历史分开滚动等展示约束已由 [Issue #5 实施计划](./2026-09-14-pet-compact-hover.md)替代；后续实机验收使用当前 [manual QA](../../manual-qa.md)，不再按下文旧展示要求判定。

## 用户确认的目标

2026-09-13 用户先要求悬停时保留最新气泡原位、历史在上方独立浮动；看到首版后进一步要求统一为随内容收紧的小气泡，角色位于气泡左下方，角色右侧上方常驻模型选项、下方常驻输入框，并缩小角色、支持仅缩放角色。

## 本次用例

1. 当前 Thread 有 assistant 回复时，最新回复使用与历史相同的紧凑气泡，不保留固定高度大卡片；常态只显示最新 assistant 正文。
2. 鼠标悬停对话或输入保持焦点时，旧消息在最新气泡上方独立展开，外层透明；切换前后最新气泡、选项、输入框和角色的屏幕位置不变。
3. 角色位于左下方，右侧形成对话列：最新回复在上，当前模型选项居中，输入框在下。选项与输入框无需悬停即可使用；点击建议和自由输入继续发送普通 UserInput。
4. 默认角色为旧图集显示尺寸的三分之二；右键角色打开大小滑杆，可在新默认尺寸的 50%–150% 间调整并恢复默认。重启恢复选择，存储不可用时仍可操作。
5. 缩放仅改变角色及其命中区域，以角色右下角为锚点；不改变消息字号、气泡宽度、输入框大小或对话列的位置。
6. 长历史与最新长正文分别滚动，查看旧消息时新消息不抢历史位置；透明间隙穿透，实际控件仍可输入、点击、拖入。靠近上缘时压缩历史高度，不推动已显示的主气泡和角色。

## 现有流程与接口

- `PetThreadController` 与既有 store 继续提供当前 Thread、最新 assistant、建议和输入入口；不新增 Thread 状态或后端协议。
- `App` 维持最新气泡、当前选项和回复框节点，悬停/焦点仅决定历史是否展示；`PetConversation` 只投影较早消息及 Permission/Workspace 请求。
- 新的 `PetReply` 承载当前建议和普通回复。`PetSizeControl` 管理角色大小的本地偏好与滑杆，renderer localStorage 只保存大小数值，不存消息或窗口坐标。
- `petWindowLayout.ts` 共享角色图集尺寸、默认显示比例、角色锚点和窗口布局常量；renderer 与原生窗口复用，避免左右布局各自猜测锚点。
- `handAgentPet` 继续只接收三种布局、可见本地矩形和移动意图；大小不走页面 zoom 或窗口整体缩放。renderer 在大小/滚动变化后刷新实际命中区域。
- `ActivityWindowController` 继续存储角色右下角的 `PetPosition { right, bottom }`。窗口向角色右侧容纳对话列，展开只向上增加高度；屏幕限制和拖动仍归 main。

## 用例调用链与验证

| 检查点 | 预期结果 | 首先增加或调整的用例 |
| --- | --- | --- |
| Thread 通知 → 常态控件 → 普通提交 | 最新正文、建议与输入常驻；焦点/悬停只展开历史 | `tests/activity-window/pet-interaction.test.tsx` |
| 右键 → 滑杆 → 角色样式/命中 → 重新挂载 | 只改变角色尺寸，偏好恢复，文本控件保持同一节点 | 同一真实 React + 协议 fixture |
| preload → IPC → controller → 位置文件 | 各布局保持角色右下锚点；拖动、恢复和上缘限制有效 | `tests/use-cases/pet-window.test.ts` |
| 原生鼠标/键盘 → 真实 renderer | 紧凑气泡、左右位置、仅角色缩放、透明间隙与焦点有效 | 当前打包 App、系统事件、截图与 DOM 几何 |

## 实施顺序

- [x] 复用已初始化并通过基线的 Issue #1 worktree；首版实现为 `fc5ce67`，进入续改时仍保留原有 8 项未提交差异。
- [x] 收尾首版原生观察，停止临时 App 与 fixture；旧截图仅为过程记录，不作为最终视觉验收。
- [x] 阅读 renderer、窗口与测试目录文档链到 `handAgent.md`，按用户新增要求更新本计划。
- [x] 先更新常驻交互、角色缩放及原生锚点用例，修复前为 8 项失败、11 项通过，修复后 19 项通过；记录见 `/tmp/pet-small-bubbles-20260913/red.log` 与 `focused.log`。
- [x] 实现紧凑气泡、左侧角色、常驻选项/回复与角色独立缩放。
- [x] 通过相关 19 项测试、TypeScript/Web、Swift test/build 与 Electron build；日志位于 `/tmp/pet-small-bubbles-20260913/`。
- [x] 完成当前实现的打包，renderer、窗口控制器和共享布局产物逐一核对一致；记录见 `package-manifest.json`。
- [x] 独立无上下文文档审核，已同步紧凑气泡、常驻交互、共享锚点与缩放偏好的模块合约，并更新 manual QA；原有待验项与进入任务前的修改均保留。
- [x] 本轮实现与文档已提交为 `2d21c16`；进入本轮的原有 8 项未提交差异完整保留。
- [ ] 使用当前包完成视觉、缩放、锚点和相关交互实机复验，逐项归档并提交。

## 验证边界

JSDOM 不证明像素位置、透明穿透或系统焦点。原生验证使用可丢弃 Thread fixture 时必须明确记录，不代表真实模型理解能力。原 Issue #1 尚未完成的其他 QA 分项继续保留。

## 暂停交接（2026-09-13）

用户要求先整理现状再暂停。当前代码已实现并提交，最终实机验收未完成；本轮没有归档任何新增 QA 分项，不能据此宣称 Issue #1 完成。

- 工作目录：`/Users/mu9/proj/handAgent/.worktrees/issue-1-pet-main-20260913`。
- 分支：`codex/issue-1-pet-main-20260913`。主要提交：`fc5ce67` 为首版浮动历史，`b7a42ab` 为追加要求的计划，`2d21c16` 为紧凑气泡与角色独立缩放。
- 已完成独立文档审核、19 项专项测试、仓库 TypeScript/Web、Swift test/build、Electron build、打包及源码产物一致性核对。原始 wrapper 日志只输出 `success`，专项红/绿日志保留完整结果。
- 当前打包产物：该 worktree 的 `dist/Wisp Pocket.app`；包含进入任务前的已有修改。

### 实机停止点

只完成了可丢弃 Thread fixture 的常态展示观察，屏幕上的默认角色已缩小，右侧短回复、两个模型选项与输入框可见；尚未操作本版右键缩放，也未完成悬停前后对照。

| 已观察表面 | 屏幕位置与尺寸（DIP，约值） |
| --- | --- |
| 最新回复气泡 | `(1048, 659.66, 232, 39.45)`，已随短内容收紧 |
| 角色 | `(912, 727.34, 128, 138.66)` |
| 回复框 | `(1048, 804, 280, 54)` |
| 原生窗口 | `compact`，`(840, 530, 496, 336)` |

外层 computed background 为透明、无公共阴影；透明间隙的真实点击穿透尚未验证，测试底板点击计数仍为 0。最新一次系统鼠标移动请求目标为 `(400, 400)`，紧接读取到 `(793.75, 617.855...)`；未复核事件队列处理后的坐标，后续应先确认实际光标位置，不能把这一现象认定为产品缺陷。

### 证据与清理

- 本轮证据目录：`/tmp/pet-small-bubbles-20260913/`。常态几何为 `compact.json`，桌面合成截图为 `compact-desktop.png`，产物核对为 `package-manifest.json`，检查日志为 `red.log`、`focused.log`、`electron-build.log`、`test-all.log`、`swift-test.log`、`swift-build.log`、`package.log`。
- 暂停时 Swift App、Electron/后端、fixture 与原生测试底板均已退出；4317、4328、9237 无监听，清理证据为 `pause-cleanup.json`。未重新启动真实 App。
- 本轮没有修改真实模型设置；`~/.spotAgent/settings.json` 的 `llm.api` 仍为 `responses`，SHA256 为 `3813c808035b5a8b10ef6dfb67448fdb9da02f80f0a3a029e88990128b33fb93`。
- 临时 fixture 只提供本轮 UI 数据，没有向真实 Thread 数据库提交测试回复；用户历史保留。用户接管的浏览器空间 51 保留，不继续操作。
- `/tmp` 中的辅助脚本和截图可能被系统清理；本文保留的提交、检查结论、几何和待验边界不依赖它们存在。

### 未提交内容保护

以下 8 项是进入本轮时已有的修改，不能混入本任务提交；快照位于证据目录的 `original-files.json`、`original-files/` 和 `pre-existing-changes.patch`。其中 renderer 指南的重连 snapshot 段落仍保留为未提交改动。

- `apps/agent-server/tests/tests.md`
- `apps/agent-server/tests/use-cases/pet-conversation.test.ts`
- `apps/electron-shell/src/activity-window/activity-window.md`
- `docs/medium-powers/plans/2026-09-13-desktop-pet.md`
- `packages/core/src/protocol/protocol.md`
- `packages/core/src/thread/Thread.ts`
- `packages/core/src/thread/thread.md`
- `packages/core/src/thread/types/ThreadServices.ts`

主 checkout 的 `docs/TODO.md` 是用户已有修改，本轮未触碰。

### 恢复顺序

收到继续指令后，先核对 worktree、分支、上述未提交内容和当前打包产物，再按 [manual QA](../../manual-qa.md) 逐项验证：悬停锚点与独立历史；50%/100%/150% 缩放、重启恢复、对话尺寸与草稿隔离；滚动、焦点、透明点击及上缘布局。每项完成后用 `project-live-qa` 脚本归档、检查 diff 并立即提交。原 Issue #1 的链接、PDF 等其他待验项继续保留。

临时环境可重用证据目录中的 `fixture.mjs`（4328）、`electron-debug.sh`（9237）、`position.json` 和 `inspect.mjs`。启动打包 App 时设置 `HANDAGENT_NODE_PATH=/opt/homebrew/bin/node`、`HANDAGENT_ELECTRON_BINARY` 指向该 wrapper、`HANDAGENT_PET_POSITION_PATH` 指向该位置文件、`HANDAGENT_PET_THREAD_WEBSOCKET_URL=ws://127.0.0.1:4328/api/thread`。快捷键必须用系统 `osascript`；原生拖动同样用 `osascript` + CoreGraphics，中文输入用 CUA `setValue`。
