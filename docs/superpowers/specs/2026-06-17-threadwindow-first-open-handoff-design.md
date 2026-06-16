# ThreadWindow 首次打开 handoff 防回归设计

## 背景

`PromptPanel -> Electron ThreadWindow` 的控制权切换已经有一条既定语义：Swift 先收起 PromptPanel，再把控制权交给 Electron 的 `BrowserWindow.show()/focus()`。

这条语义之前只在 `submitPrompt` 路径上被显式处理，`showThreadWindow` / `openHistory` 首次打开路径遗漏了同样的 handoff，导致冷启动后首次打开 ThreadWindow 时反复出现竞态回归。

## 触发条件

满足以下条件时容易复现：

1. 桌面 App 冷启动。
2. 用户先打开 Swift PromptPanel。
3. PromptPanel 仍可见时，触发 `showThreadWindow` 快捷键或等价的 `openHistory` 路径。

## 现象

- Electron ThreadWindow 会短暂出现后立即消失。
- PromptPanel 也会一起消失，表面看像“两个窗口都没了”。
- StatusBubble 仍可能显示 thread 已存在，说明不是 thread 创建失败，而是前台焦点被旧应用抢回。

## 根因

根因是两条焦点链路发生竞态：

- Electron 侧：`thread_window.open_history` 触发 `BrowserWindow.show()/focus()`。
- Swift 侧：PromptPanel 失焦时仍按默认语义恢复唤起前的前台应用。

如果在把控制权交给 Electron 之前，没有先执行 `hide(restoringFocus: false)`，那么 PromptPanel 的失焦恢复会把刚拿到前台的 Electron ThreadWindow 再压回后台。

## 不变量

凡是从 PromptPanel 把控制权交给 Electron ThreadWindow 的路径，都必须满足同一条 handoff 不变量：

1. 先执行 `hide(restoringFocus: false)`。
2. 再发送 `thread_window.open_initial_prompt`、`thread_window.open_history` 或后续等价的 open/focus command。

这不是实现偏好，而是防回归红线。`submitPrompt`、`openHistory` 以及未来新增的 PromptPanel -> ThreadWindow 入口都必须复用这条语义。

## 实现要求

### Coordinator

- `submitPrompt` 保持“先 hide，再 open initial prompt”。
- `openHistory` 必须与 `submitPrompt` 对齐，先 hide，再 open history。

### PromptPanel

- `hide(restoringFocus: false)` 必须显式禁用旧前台应用恢复。
- 不能把约束放宽成“最终调过 hide 即可”；必须验证顺序是“hide 在前，open/focus 在后”。

### Diagnostics

- 宿主侧保留 `HANDAGENT_THREADWINDOW_TRACE=1` 诊断开关。
- 至少输出 `coordinator.open_history`、`prompt_panel.hide restoringFocus=false`、`electron.command_ack`、`electron.thread_window_closed`，便于复盘首次打开时序。

## 验证

### 自动化

- `AppCoordinatorTests` 必须覆盖：
  - `openHistory` 会调用 `hide(restoringFocus: false)`。
  - `openHistory` 的调用顺序是先 hide，再 `threadWindow.openHistory`。
- 现有 `submitPrompt` handoff 测试不得删除。

### 手工回归

`docs/manual-qa.md` 必须把以下两条放在同一类 handoff 回归项里：

1. PromptPanel 可见时提交首轮 prompt。
2. PromptPanel 可见时按 `showThreadWindow` / 触发 `openHistory`。

两条都要覆盖首次打开场景，且必须强调这是高频回归点。
