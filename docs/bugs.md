# Bug 清单

本文记录当前已知但尚未修复的 bug。功能待办继续放在 [TODO.md](/Users/mu9/proj/handAgent/docs/TODO.md)

最后核对日期：2026-06-09。

## 修 bug 约束

- 修复跨 View / ViewModel / Coordinator / Service / 进程边界 / 系统 API 的 bug 时，必须遵循 [$trace-and-verify-call-chain](/Users/mu9/.agents/skills/trace-and-verify-call-chain/SKILL.md)。
- 修复完成后从当前文档中删除，并写入manual-qa文档中

##  测试备注

### mock-llm 不能证明真实 vision；真实 provider token streaming 已单独验证

- 2026-05-19 本轮实机 QA 使用 `bash ./scripts/package-app.sh --mock-llm` 打包启动。
- 图片附件链路可验证到 Quick Look、ThreadWindow 摘要、blob stub 持久化；早期 QA 记录中的 `SessionWindow` 是历史旧称。但 `[mock:image-summary]` 只返回固定文本，不能证明真实 LLM 基于图片内容描述。
- 2026-05-20 已补充 `MockLLMClient.stream()`；`[mock:assistant-ok]` 可验证 mock 模式下 agent-server 到 desktop 的多段 `assistant_message_delta` 渲染链路。
- mock delta 是本地确定性分片，不能证明真实 provider 的网络 streaming 或 token 到达节奏；该项已在 2026-05-21 使用非 mock App 与真实 `text/event-stream` 响应完成单独验证。
- 2026-05-21 直接向 agent-server 发送 PNG 附件的真实 provider thread 已证明 image STUB 会展开为多模态请求，provider 可读出图片 token `VISION_PASS_20260521`。该条历史证据原始文件位于旧目录 `~/.spotAgent/sessions/session-1779350388296-2gmta1.json`；当前持久化数据库为 `~/.spotAgent/threads.sqlite`。
- 2026-05-21 PromptPanel 区域截图 UI 重试已证明 image chip、session image STUB 与真实多模态 provider 请求链路会打通；用户同日手动确认重新授予当前打包 App 权限后，区域圈选路径可正常工作。
- 结论：真实 provider token streaming、真实 vision 底层请求与区域截图附件路径均已归档到 [archive.md](./archive.md)。后续同类问题应按当前实现重新复现，不沿用旧 `sessions/` 证据作为当前 bug 依据。

### `System Events click at` 不适合作为状态气泡点击的唯一证据

- 2026-05-20 状态气泡焦点回跳 QA 中，状态气泡窗口是 `.nonactivatingPanel`，Computer Use 的 accessibility tree 只暴露当前 key ThreadWindow。早期 QA 记录中的 `SessionWindow` 是历史旧称，当前不再作为术语使用。
- 使用 `System Events` 的 `click at {x, y}` 点击状态气泡坐标后，AX 主窗口 / 焦点窗口未稳定切换；改用 CoreGraphics `CGEvent` 发送鼠标 down/up 后，状态气泡点击可稳定触发焦点回跳。
- 结论：验证状态气泡这类 non-activating panel 的真实点击时，应以 Computer Use 前后 UI 状态 + AX 状态为观察证据，实际点击输入优先使用 CGEvent；不要把 `System Events click at` 的失败单独判为产品 bug。

---

## 当前 bug


### 首次 PromptPanel -> ThreadWindow handoff

- 完成日期：待实机 QA
- 实现位置：`docs/superpowers/specs/2026-06-17-threadwindow-first-open-handoff-design.md`、`apps/desktop/Sources/Coordinator/AppCoordinator.swift`、`apps/desktop/Sources/Coordinator/coordinator.md`、`apps/desktop/Sources/PromptPanel/prompt-panel.md`、`apps/desktop/Sources/AppServices/ElectronShell/ThreadWindowDiagnostics.swift`、`apps/desktop/TestsSwift/Coordinator/AppCoordinatorTests.swift`
- 修复结论：失败边界定位为 PromptPanel 把控制权切给 Electron ThreadWindow 时，没有统一满足“先 `hide(restoringFocus: false)`，再 open/focus ThreadWindow”这条 handoff 不变量。`submitPrompt` 之前已经修过，但 `showThreadWindow` / `openHistory` 首次打开路径遗漏了同样处理。首次启动后若 PromptPanel 仍可见，Electron ThreadWindow 首次 `show()/focus()` 与 PromptPanel 失焦恢复会产生竞态，表现为 ThreadWindow 与 PromptPanel 一起消失。修复后首轮 submit 与 `openHistory` 都走同样的 handoff 语义，先隐藏 PromptPanel 且不恢复旧前台应用，再把控制权交给 Electron。
- 防回归级别：高。这个 bug 已多次出现；以后只要改到 `showThreadWindow` 快捷键、`openHistory`、PromptPanel `hide/restoringFocus`、Electron ThreadWindow open/focus/close ack，必须重跑本条自动化与手工步骤，不能凭局部代码阅读跳过。
- 自动化验证：需执行 `bash ./scripts/swiftw test --filter AppCoordinatorTests`、`bash ./scripts/swiftw test --filter PromptPanelControllerTests`、`bash ./scripts/swiftw test --filter ElectronBackedAppServerTests`、`bash ./scripts/swiftw build`。
- 手工回归步骤：
  1. 启动桌面 App，首次唤起 PromptPanel。
  2. 在 PromptPanel 可见时直接提交首轮 prompt，确认 PromptPanel 收起后 Electron ThreadWindow 保持前台可见，不会被提交前的 App 重新盖住。
  3. 关闭 ThreadWindow；再次打开 PromptPanel，在 PromptPanel 可见时直接按 `showThreadWindow` 快捷键，确认 PromptPanel 收起后 ThreadWindow 保持可见，不会与 PromptPanel 一起消失。
  4. 重复第 2-3 步至少 3 次，确认首次与后续行为一致。
  5. 若需要诊断日志，用 `HANDAGENT_THREADWINDOW_TRACE=1` 启动宿主，确认 stderr 顺序满足 `coordinator.open_history -> prompt_panel.hide restoringFocus=false -> electron.command_ack`；异常场景下若还有 `electron.thread_window_closed wasVisible=true`，可继续据此排查 Electron 首次 close 来源。

### 缺陷记录

- **严重级别**：P1
- **复现步骤**：
  1. 在 `main` 分支执行基线检查通过后，使用 `bash ./scripts/package-app.sh --mock-llm` 重新打包，并启动 `dist/HandAgentDesktop.app`。
  2. 通过 PromptPanel 提交 `HANDAGENT_PACKAGED_MAIN_CHAIN_20260618 [mock:assistant-ok]`，确认 thread 已创建；随后关闭 `HandAgent ThreadWindow`，窗口列表只剩 `HandAgent Activity`。
  3. 使用全局快捷键打开 PromptPanel；系统窗口查询显示 `HandAgentDesktop` 有 1 个 `AXSystemDialog` 窗口。
  4. 在 PromptPanel 仍可见时按 `showThreadWindow` 默认快捷键 `Command+H`。
- **实际结果**：`HandAgent ThreadWindow` 没有重新出现；`osascript` 读取 `process "Electron"` 的窗口名仍只有 `HandAgent Activity`。与此同时，`127.0.0.1:4317` 上的 agent-server 仍保持监听，说明不是后端退出。
- **期望结果**：在 PromptPanel 可见时按 `showThreadWindow`，应先完成 `hide(restoringFocus: false)` handoff，再重新显示 `HandAgent ThreadWindow`，用于恢复历史 thread。
- **证据**：
  1. 关闭 ThreadWindow 后：`process "Electron"` 窗口列表为 `HandAgent Activity`。
  2. PromptPanel 打开后：`process "HandAgentDesktop"` 窗口计数为 `1`，窗口子角色为 `AXSystemDialog`。
  3. 在 PromptPanel 可见时按 `Command+H` 后：`process "Electron"` 窗口列表仍为 `HandAgent Activity`，未出现 `HandAgent ThreadWindow`。
  4. 同一运行实例中，直接向 `HANDAGENT_ELECTRON_COMMAND_SOCKET=/tmp/hae-3425800C-1D94-4AEA-9FD9-DA7D22E626A4.sock` 发送 `{"channel":"electron_shell","type":"thread_window.open_history","commandId":"qa-open-history-2"}` 后，`process "Electron"` 窗口列表立即变为 `HandAgent Activity, HandAgent ThreadWindow`。这证明 `thread_window.open_history` 命令链本身可用，失败点不在 Electron prewarmer / openHistory 命令执行。
  5. 当前历史 thread `thread-9d0da056-16dc-41b0-8077-aa5a35cd3f4c` 已在 `~/.spotAgent/threads.sqlite` 持久化，包含 user message、assistant delta、assistant final response、`turn.completed(status=completed)` 与 `thread.status.changed(idle)`。
- **初步调用链 / 根因边界**：期望链路是 `showThreadWindow 快捷键 -> AppCoordinator.setupHotkey() 的本地 keyUp monitor -> send(.openHistory) -> ElectronBackedAppServer.openHistory() -> thread_window.open_history command -> Electron ThreadWindowPrewarmer.openHistory()`。代码与文档都表明 `showThreadWindow` 当前通过 `NSEvent.addLocalMonitorForEvents(matching: .keyUp)` 注册，仅在 HandAgent 持有焦点时生效；而 PromptPanel show 路径又刻意不激活整个应用。实机上 PromptPanel 可见时 `HandAgentDesktop` 仍非 frontmost，因此失败边界落在“快捷键事件没有进入 Coordinator”这一跳，`openHistory` command path 已被 direct socket 验证为正常。
- **发现日期**：2026-06-18
