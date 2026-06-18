# Bug 清单

本文记录当前已知但尚未修复的 bug。功能待办继续放在 [TODO.md](/Users/mu9/proj/handAgent/docs/TODO.md)

最后核对日期：2026-06-18。

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




### ThreadWindow Radix UI 弹出层迁移

- 完成日期：待实机 QA
- 实现位置：`apps/thread-window-web/src/components/Composer.tsx`、`apps/thread-window-web/src/App.tsx`、`apps/thread-window-web/tests/composerInputItems.test.ts`、`apps/thread-window-web/thread-window-web.md`、`docs/dependency-audit.md`
- 修复结论：Composer slash 菜单从手写 `absolute bottom-full` 定位迁移到 `@radix-ui/react-popover`（Portal 渲染、碰撞检测、focus 管理），修复了被所有祖先 `overflow: hidden` 裁剪的 bug。新增 `ArrowUp`/`ArrowDown` 候选列表导航和 `Escape` 清除文本关闭菜单，`Tab` 选择当前高亮 skill 并保持焦点在 textarea。App 删除确认对话框从手写 modal overlay 迁移到 `@radix-ui/react-alert-dialog`（Portal 渲染、focus trap、scroll lock、Escape 关闭）。
- 自动化验证：需执行 `pnpm --filter handagent-thread-window-web exec vitest run tests/composerInputItems.test.ts`、`pnpm --filter handagent-thread-window-web test`、`pnpm --filter handagent-thread-window-web build`、`bash ./scripts/test.sh`。
- 手工回归步骤：
  1. 打开 Electron ThreadWindow，在 Composer 输入框输入 `/`，确认 popover 在输入框上方显示且不被裁剪（bug 修复验证）。
  2. 输入过滤词后按 `ArrowDown`，确认高亮移到第二个候选；按 `ArrowUp` 回到第一个。
  3. 按 `Tab` 确认选中当前高亮 skill（而非始终第一个），textarea 清空且焦点仍在输入框。
  4. 输入 `/` 后按 `Escape`，确认文本被清除、popover 消失。
  5. 点击 popover 外部区域，确认文本被清除、popover 消失。
  6. 缩小窗口高度使 popover 上方空间不足，确认 popover 自动翻转到输入框下方（碰撞检测）。
  7. 点击历史侧栏某个 thread 的删除按钮，确认删除确认对话框居中显示在全视口上方。
  8. 按 `Escape` 确认对话框关闭，thread 未被删除。
  9. 点击"取消"确认对话框关闭，thread 未被删除。
  10. 再次点击删除按钮，点击"删除"确认 thread 被删除且对话框关闭。

### ThreadWindow Radix UI 弹出层迁移 - slash popover 窄高窗口未翻转

- **发现日期**：2026-06-18
- **严重级别**：中。窄高窗口下 slash skill 菜单主要内容跑出视口，影响键盘/视觉选择 skill；常规高度下其余 Radix 行为可用。
- **复现步骤**：1. 在 main 上清理旧 HandAgent / Electron / agent-server / playwright-cli 进程。2. 执行 `bash ./scripts/test.sh`、`bash ./scripts/swiftw build`、`bash ./scripts/package-app.sh --mock-llm` 均通过。3. 以 mock LLM 启动真实 Electron shell / BrowserWindow ThreadWindow，并打开临时 CDP 端口观测。4. 通过 Electron command socket 创建 `THREADWINDOW_RADIX_FLIP_QA_20260618 [mock:assistant-ok]` thread。5. 使用 macOS System Events 将真实 Electron `HandAgent ThreadWindow` 设置为 `920x260`。6. 在 Composer textarea 输入 `/`。
- **实际结果**：slash popover 仍显示在输入框上方，CDP 读取到 `innerHeight=232`、`boxTop=118`、`boxBottom=216`、`menuTop=-206`、`menuBottom=114`、`above=true`、`flipped=false`，菜单顶部跑出视口，没有翻转到输入框下方或被约束在可见区域内。
- **期望结果**：当输入框上方空间不足时，Radix popover 应按验收要求自动翻转到输入框下方，或至少保持完整可见，不应出现负数 top 导致候选内容裁剪。
- **已验证正常的相关行为**：常规高度下输入 `/` 时 popover 位于输入框上方且不被 Composer 祖先裁剪；`ArrowDown` 让第二个候选 `Summarize Text` 变为 `aria-selected=true`，`ArrowUp` 回到第一个候选；输入 `/rev` 后 `ArrowDown` + `Tab` 选择当前高亮 `Review`，textarea 清空且焦点仍在 `TEXTAREA`；`Escape` 与点击外部区域均关闭菜单并清空文本。删除确认对话框可打开，`Escape` / `取消` 不删除 thread，点击 `删除` 后 SQLite 中 `thread-e0a5c9fb-a713-48a3-8d6f-52ed5666e0e4` 计数从 1 变为 0，历史列表不再显示该 thread。
- **证据**：CDP 输出 `slashInitial.side=top`、`afterArrowDown` 第二项 `aria-selected=true`、`afterArrowUp` 第一项 `aria-selected=true`、`afterTabHighlighted { chips:[\"Skill · Review×\"], textarea:\"\", activeTag:\"TEXTAREA\" }`、`afterEscape { menu:false, textarea:\"\" }`、`afterOutsideClick { menu:false, textarea:\"\" }`；真实窗口缩到 `920x260` 后输出 `collisionState { innerHeight:232, textarea:\"/\", visible:true, menuTop:-206, menuBottom:114, boxTop:118, boxBottom:216, flipped:false, above:true }`。
- **初步调用链 / 根因边界**：问题边界在 ThreadWindow renderer 的 `Composer` Radix `Popover.Content` 布局约束。当前 `side=\"top\"` 且内容 `max-h-[320px]`，在上方空间不足时没有按预期 side flip / collision fit；需要检查 Radix Popover 的 collision 配置、Portal 容器、Electron viewport 尺寸和 `max-height` 是否应使用可用高度变量。
- **清理状态**：临时 Electron shell、agent-server 和 4317 / 9222 监听已清理；只保留本次缺陷文档变更，未改代码。
