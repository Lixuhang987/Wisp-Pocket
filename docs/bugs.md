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



### Agent rx_event request-response 收敛

- 完成日期：待实机 QA
- 实现位置：`packages/core/src/protocol/Op.ts`、`packages/core/src/protocol/AgentEvent.ts`、`apps/agent-server/src/agent/AgentRequestBroker.ts`、`apps/agent-server/src/server/server.ts`、`apps/agent-server/src/thread/ThreadCommandRouter.ts`
- 修复结论：permission/workspace ask 不再由 `/api/thread` socket bridge 直接发送。turn 内部请求先进入 Agent `rx_event(server.request)`，app-server 从通道中发布为 `ServerRequest`；React 的 `ClientResponse` 会被 app-server 包装为 `client_response` Op 后投递到 Agent `tx_sub`，再由 `AgentRequestBroker` 唤醒 pending ask。公开 `op.submit` 仍只接受 `UserInput | Interrupt`。
- 自动化验证：需执行 `pnpm exec vitest run packages/core/tests/protocol/op.test.ts apps/agent-server/tests/agent/AgentRequestBroker.test.ts apps/agent-server/tests/thread/ThreadCommandRouter.test.ts apps/agent-server/tests/server/server.test.ts`、`bash ./scripts/test.sh`、`bash ./scripts/swiftw test`、`bash ./scripts/swiftw build`。
- 手工回归步骤：
  1. 启动 mock 或真实桌面 App，提交会触发 tool permission 的 prompt，确认 ThreadWindow 出现 `permission.requested` 面板，ActivityWindow 状态进入 waiting。
  2. 在 ThreadWindow 选择 allow/deny，确认请求面板消失，turn 继续完成或按拒绝结果收敛，ActivityWindow 离开 waiting。
  3. 触发 `workspace.askUser` 的 prompt，确认同一 thread 内 workspace 请求串行出现；选择 workspace 或取消后 turn 正确继续。
  4. 点击停止或关闭 ThreadWindow，确认 running turn 被中断，当前 pending permission/workspace 请求被取消，thread 级临时权限规则被清理，后续新输入不复用本次临时 allow/deny。


### ThreadWindow 无 tab 后台 thread 状态

- 完成日期：待实机 QA
- 实现位置：`apps/thread-window-web/src/App.tsx`、`apps/thread-window-web/src/store/threadWindowStore.ts`、`apps/thread-window-web/src/thread/threadSocketClient.ts`、`apps/thread-window-web/src/components/ThreadWorkspacePane.tsx`
- 自动化验证：需执行 `pnpm --filter handagent-thread-window-web test`、`pnpm --filter handagent-thread-window-web build`、`bash ./scripts/test.sh`。
- 手工回归步骤：
  1. 启动一个会持续流式输出的 thread，切到历史中的另一个 thread，再切回原 thread；右侧应直接显示原 thread 当前已缓存的 assistant delta，不出现 tab 条，也不清空消息。
  2. 在后台 thread 触发 permission 或 workspace 请求后，切回该 thread；对应请求面板仍可见并可回答。
  3. 人为让 `/api/thread` WebSocket 非主动断开时，前端连接状态可变为 `disconnected`，但不得做任何断线恢复：不得自动创建新 WebSocket，不得恢复订阅，不得拉取 snapshot，不得发送任何恢复命令；已有 thread state 保留在最后收到的位置。
