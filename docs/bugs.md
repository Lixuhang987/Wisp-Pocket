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

- **严重级别**：中
- **发现日期**：2026-06-18
- **复现步骤**：1. 在 `main` 主 checkout 依次执行 `bash ./scripts/test.sh`、`bash ./scripts/swiftw test`、`bash ./scripts/swiftw build`，并保持 packaged app 与 `http://127.0.0.1:4317/thread-window/index.html` 在线。2. 在同一个本地 ThreadWindow Web 页面活连接中提交 `[mock:permission-write] LIVE_QA_PERMISSION_ALLOWDENY_20260618`，观察 `权限请求: file.write` 面板，点击 `允许`，确认出现 `[file.write] {"workspaceId":"qa-workspace","relativePath":"permission-check.txt","bytesWritten":27}` 与 `Mock permission write completed.`。3. 在同一 thread 再提交 `[mock:workspace-ask] LIVE_QA_WORKSPACE_ALLOW_20260618`，先在 `权限请求: workspace.askUser` 点击 `允许`，再在后续 workspace 面板点击 `qa-workspace`，确认出现 `[workspace.askUser] {"workspaceId":"qa-workspace"}` 与 `Mock workspace.askUser completed.`。4. 继续在同一 thread 提交 `[mock:workspace-ask] LIVE_QA_STOP_CLEAR_RULE_20260618`，等待 `请选择 QA 要写入的 workspace` 面板出现后点击 `停止`。5. 等待 4 秒后再次抓取当前页面状态，并检查 `~/.spotAgent/threads.sqlite` 中该 thread 的最新 rollout。
- **实际结果**：步骤 2 和 3 证明 `permission.answered`、`workspace.answered` 正常通过 `client_response` 收敛；但步骤 4 点击 `停止` 后，SQLite 已写入 `turn.completed(status: interrupted)`、`thread.status.changed(value: interrupted)`、`turn_context.status: failed` 与 `run_interrupted` 审计事件，ThreadWindow 页面却仍保留旧的 workspace 请求面板文案 `请选择 QA 要写入的 workspace / qa-workspace / 取消`，没有随着中断清空 pending request，也没有渲染中断提示。
- **期望结果**：当 running turn 因 stop/interrupt 收敛为 `interrupted` 后，当前 thread 的 pending permission/workspace 请求应立即从 ThreadWindow UI 清除，并与 runtime/persistence 的 interrupted 状态一致；后续若再次触发同类请求，应以新的 request 重新出现，而不是残留旧面板。
- **证据**：1. Playwright 活连接成功路径：在本地 ThreadWindow Web 页面中，`[mock:permission-write] LIVE_QA_PERMISSION_ALLOWDENY_20260618` 先显示 `权限请求: file.write`，点击 `允许` 后页面渲染 `[file.write] {"workspaceId":"qa-workspace","relativePath":"permission-check.txt","bytesWritten":27}` 与 `Mock permission write completed.`；`[mock:workspace-ask] LIVE_QA_WORKSPACE_ALLOW_20260618` 先显示 `权限请求: workspace.askUser`，点击 `允许` 后切换到 `请选择 QA 要写入的 workspace`，选择 `qa-workspace` 后页面渲染 `[workspace.askUser] {"workspaceId":"qa-workspace"}` 与 `Mock workspace.askUser completed.`。2. 停止失败路径：点击 `停止` 后 4 秒再次读取 DOM，`document.body.innerText` 仍包含 `请选择 QA 要写入的 workspace\nqa-workspace\n取消`，`hasWaiting: true`，且不包含 `本轮运行已中断`。3. SQLite 证据：thread `thread-e26b2e18-8a36-400b-b913-dbb6844135d4` 的 `thread_items` 最新序列为 `63 event_msg turn.completed payload.status=interrupted`、`64 event_msg thread.status.changed payload.value=interrupted`、`65 turn_context status=failed`，`auditEvents` 含 `message: 本轮运行已中断。`, `code: run_interrupted`。4. 基线命令在同一轮均通过：`bash ./scripts/test.sh`、`bash ./scripts/swiftw test`、`bash ./scripts/swiftw build` 均返回 `success`。
- **初步调用链 / 根因边界**：后端 request-response 链路本身已通。`AgentRequestBroker -> /api/thread ServerRequest -> ClientResponse -> client_response Op` 在 allow 路径与 workspace 串行路径都已被实机证实；中断后 persistence 也正确写入 interrupted。缺陷边界落在 ThreadWindow 前端状态同步：`apps/thread-window-web/src/store/threadWindowStore.ts` 的 `handleRequest()` 会把请求推入 `thread.permissionRequests` / `thread.workspaceRequests`，但 `turn.completed` 与 `thread.status.changed` 分支只更新 `thread.status` 和 `pendingInitialPrompt`，没有在 interrupted/failed 收敛时清空这些 pending request 队列，因此 UI 残留了已经失效的请求面板。


### ThreadWindow 左侧历史侧栏 UI 增强

- **严重级别**：中
- **发现日期**：2026-06-18
- **复现步骤**：1. 在 `main` 主 checkout 保持 packaged mock app 在线，打开 `http://127.0.0.1:4317/thread-window/index.html`。2. 在空白 thread 中提交 `[mock:assistant-ok] LIVE_QA_BACKGROUND_A2_20260618`，等待右侧消息列表出现 user message 与 `Mock assistant response: main chain is reachable.`。3. 不刷新页面，观察左侧 `默认对话` 历史列表。4. 运行 `sqlite3 ~/.spotAgent/threads.sqlite "select thread_id, preview, updated_at from threads where thread_id=thread-96834f8e-a97b-43a3-9823-9cf36915b88e;"`，确认 SQLite 中已经持久化该 thread。5. 直接对当前页面执行 `reload`，再在搜索框输入 `BACKGROUND_A2_20260618` 过滤历史。
- **实际结果**：步骤 2 完成后，右侧 thread workspace 已显示新消息，SQLite 中也已有 `thread-96834f8e-a97b-43a3-9823-9cf36915b88e | [mock:assistant-ok] LIVE_QA_BACKGROUND_A2_20260618 | 2026-06-17T22:31:51.062Z`，但左侧历史列表在当前 live 会话中没有出现这条新 thread，无法立即点击切回。只有在步骤 5 手动 reload 后，搜索框过滤结果里才出现 `"[mock:assistant-ok] LIVE_QA_BACKGROUND_A2_20260618"` 的历史 row。
- **期望结果**：新建并完成的 thread 应在当前 live 会话中即时进入左侧历史侧栏，并保持 preview/updatedAt 与当前 thread 状态同步；用户不应依赖 reload 才看到新 thread。
- **证据**：1. Live UI：提交 `[mock:assistant-ok] LIVE_QA_BACKGROUND_A2_20260618` 后，右侧消息区渲染 user bubble 与 assistant 文案 `Mock assistant response: main chain is reachable.`；紧接着左侧历史中仍只显示旧的 permission/tool thread，没有新出现 `BACKGROUND_A2` row。2. SQLite 持久化：thread `thread-96834f8e-a97b-43a3-9823-9cf36915b88e` 的 rollout 已完整写入 `session_meta`、`response_item(user)`、多条 `assistant.delta`、`response_item(assistant)`、`turn.completed`、`thread.status.changed`。3. Reload 对照：对同一页面执行 `reload` 后，再在搜索框输入 `BACKGROUND_A2_20260618`，左侧立刻出现 `"[mock:assistant-ok] LIVE_QA_BACKGROUND_A2_20260618"` 历史 row，证明数据已存在，只是 live 列表没更新。4. 定向自动化覆盖仍通过：`pnpm --filter handagent-thread-window-web exec vitest run tests/historySidebar.test.ts` 结果为 `5 passed`。
- **初步调用链 / 根因边界**：问题边界在 ThreadWindow 前端 store/history 同步，而不是持久化或样式。`HistorySidebar` 只读取 `state.history`；`thread.started` / `user.message.recorded` / `turn.completed` 分支会更新 `threadsById` 和右侧消息，但不会把新 thread 插入 `history`。当前 `history` 主要依赖 socket 建连时的 `thread.listed` 快照刷新，因此 live 创建的新 thread 只在 reload 或重新连接后才进入侧栏。渲染层 `ThreadItem` / `groupThreadsByWorkspace` 本身没有证据表明会丢弃这条数据。


### ThreadWindow 无 tab 后台 thread 状态

- 完成日期：待实机 QA
- 实现位置：`apps/thread-window-web/src/App.tsx`、`apps/thread-window-web/src/store/threadWindowStore.ts`、`apps/thread-window-web/src/thread/threadSocketClient.ts`、`apps/thread-window-web/src/components/ThreadWorkspacePane.tsx`
- 自动化验证：需执行 `pnpm --filter handagent-thread-window-web test`、`pnpm --filter handagent-thread-window-web build`、`bash ./scripts/test.sh`。
- 手工回归步骤：
  1. 启动一个会持续流式输出的 thread，切到历史中的另一个 thread，再切回原 thread；右侧应直接显示原 thread 当前已缓存的 assistant delta，不出现 tab 条，也不清空消息。
  2. 在后台 thread 触发 permission 或 workspace 请求后，切回该 thread；对应请求面板仍可见并可回答。
  3. 人为让 `/api/thread` WebSocket 非主动断开时，前端连接状态可变为 `disconnected`，但不得做任何断线恢复：不得自动创建新 WebSocket，不得恢复订阅，不得拉取 snapshot，不得发送任何恢复命令；已有 thread state 保留在最后收到的位置。

- **严重级别**：中
- **发现日期**：2026-06-18
- **复现步骤**：1. 在主 checkout `main` 先确认 `bash ./scripts/test.sh` 与 `bash ./scripts/package-app.sh --mock-llm` 通过，并启动 packaged mock app，保持 `http://127.0.0.1:4317/thread-window/index.html` 可访问。2. 在同一个 ThreadWindow 页面点击“新建对话”，在输入框提交 `[mock:workspace-ask] LIVE_QA_STOP_CLEAR_RULE_RERUN`。3. 等待右侧出现 `权限请求: workspace.askUser`，参数为 `{"prompt":"请选择 QA 要写入的 workspace","candidateIds":["qa-workspace","tmp"]}`，并显示 `允许` / `拒绝`。4. 不刷新页面，等待本轮运行自然结束，再次抓取页面 DOM 与 SQLite 线程落盘结果。
- **实际结果**：本轮运行结束后，页面上的 `停止` 按钮已经消失，thread 也已经写入终态；但 ThreadWindow 仍残留旧的 `权限请求: workspace.askUser` 面板与 `允许` / `拒绝` 按钮。与此同时，消息区已经出现 `[workspace.askUser] 用户拒绝执行该 tool` 与 `Mock workspace.askUser completed.`，说明请求在后端已收敛成失败/完成结果，但前端 request panel 没有跟着清理。
- **期望结果**：无论 request 最终因 interrupt、tool failed、turn completed 还是 thread 回到 `idle` 而收敛，当前 thread 上对应的 permission/workspace request panel 都应立即清空；页面只保留最终消息和 thread 状态，不应继续暴露已经失效的 `允许` / `拒绝` 操作。
- **证据**：1. Playwright 快照 `.playwright-cli/page-2026-06-17T23-02-31-512Z.yml` 记录了同一页面同时出现 `[workspace.askUser] 用户拒绝执行该 tool`、`Mock workspace.askUser completed.` 与旧的 `权限请求: workspace.askUser` 面板。2. 直接执行 `PLAYWRIGHT_CLI_SESSION=threadwindow-main-live bash /Users/mu9/.agents/skills/playwright/scripts/playwright_cli.sh eval "document.body.innerText"`，返回文本同时包含 `用户拒绝执行该 tool`、`Mock workspace.askUser completed.` 以及旧的 `权限请求: workspace.askUser ... 允许 ... 拒绝`。3. SQLite 证据：`thread-3e69d82b-92cf-4760-aef3-8202e4824ee2` 的 `thread_items` 最新序列包含 `4 event_msg tool.finished payload.status=failed`、`12 event_msg turn.completed payload.status=completed`、`13 event_msg thread.status.changed payload.value=idle`，证明这次不是 stop/interrupt 专属问题，而是 thread 已自然收敛到 completed/idle 后 UI 仍残留旧 request。4. 当前 bug 文档里已有一条 stop/interrupt 场景的 request 残留；这次 live QA 证明缺陷边界更宽，终态清理本身存在漏洞。
- **初步调用链 / 根因边界**：缺陷边界仍在 ThreadWindow 前端状态同步，而不是 broker 或持久化。`workspace.requested` 已经被 UI 渲染出来，后端随后又正确写入 `tool.finished(failed)`、`turn.completed(completed)` 与 `thread.status.changed(idle)`；但前端 store/UI 没有在 request 被回答后、或在非 interrupt 的终态收敛时清掉旧 request state。需要重点检查 `apps/thread-window-web/src/store/threadWindowStore.ts` 中 `handleRequest()`、`resolveWorkspaceRequest()`、`resolvePermissionRequest()` 以及 `tool.finished` / `turn.completed` / `thread.status.changed` 分支之间的生命周期收敛是否一致。

