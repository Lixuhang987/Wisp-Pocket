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
  6. 缩小窗口高度使 popover 上方空间不足，确认 popover 自动翻转到输入框下方，或使用 Radix 可用高度约束完整留在视口内。
  7. 点击历史侧栏某个 thread 的删除按钮，确认删除确认对话框居中显示在全视口上方。
  8. 按 `Escape` 确认对话框关闭，thread 未被删除。
  9. 点击"取消"确认对话框关闭，thread 未被删除。
  10. 再次点击删除按钮，点击"删除"确认 thread 被删除且对话框关闭。


### AgentTrigger 设置二级菜单与默认安装内置触发器

- 完成日期：待实机 QA
- 实现位置：`apps/desktop/Sources/AppServices/AgentTrigger/AgentTriggerStore.swift`、`apps/desktop/Sources/AppServices/AppServices.swift`、`apps/desktop/Sources/Settings/AgentTriggerSettingsViewModel.swift`、`apps/desktop/Sources/Settings/AgentTriggerSettingsView.swift`、`apps/desktop/TestsSwift/AppServices/AgentTriggerStoreTests.swift`、`apps/desktop/TestsSwift/Settings/AgentTriggerSettingsViewModelTests.swift`、`apps/desktop/Sources/Settings/settings.md`
- 修复结论：`AgentTriggerStore` 持有内置 `chrome-bookmarks` / `system-clock` manifest 并提供幂等 `ensureBuiltinPackagesInstalled()`；`AppServices.init` 在构造 `AgentTriggerRuntime` 前调用，使首次启动 reload 即可看到内置 package。Settings → 触发器为两级：一级是已安装 package 行（左侧 name + description，右侧"N 个自动化 >"进入二级），不再有"恢复内置触发器"入口；二级顶部展示 name + description，并按 `providerKind` 渲染对应表单，新增 / 删除 / 多自动化操作均通过 `AgentTriggerSettingsViewModel.createInstanceForCurrentPackage` / `deleteInstance(id:)` 落到 store 并 reload runtime。内置 manifest 的恢复仅由 `AppServices.init` 启动期 `ensureBuiltinPackagesInstalled()` 保证（设置页内无手动恢复按钮）。
- 自动化验证：需执行 `bash ./scripts/swiftw test --filter AgentTriggerStoreTests`、`bash ./scripts/swiftw test --filter AgentTriggerSettingsViewModelTests`、`bash ./scripts/swiftw test`、`bash ./scripts/swiftw build`、`bash ./scripts/test.sh`。
- 手工回归步骤：
  1. 删除 `~/.spotAgent/agent-triggers/` 后启动桌面 App，进入 Settings → 触发器，确认一级直接显示 `Chrome Bookmarks` 与 `System Clock` 两行（左 name + description，右"N 个自动化 >"），无需点"安装内置 Trigger"。
  2. 点击 `Chrome Bookmarks` 行，确认进入二级页面，顶部看到包 name + description 与 `暂无自动化`；顶部"返回"可回一级。
  3. 在 Chrome Bookmarks 二级点"新增自动化"，填写"标题"、"Folders"和"提示词"，保存后回到该二级页面，自动化列表出现一条；空 title 时按"保存"显示"标题不能为空"且不创建，空提示词时显示"提示词不能为空"且不创建。
  4. 进入 System Clock 二级，连续创建两条自动化（不同时间点），确认列表显示两条，磁盘 `instances.json` 也包含两条。
  5. 在二级页面对某条自动化点"删除"，确认列表立即移除该条，runtime reload，对应触发器停止。
  6. 手工删除 `~/.spotAgent/agent-triggers/packages/chrome-bookmarks/`，重启桌面 App（设置页内无"恢复内置触发器"按钮），确认 Chrome Bookmarks 行由启动期 `ensureBuiltinPackagesInstalled()` 重新写入并出现，且未影响已存在的 System Clock manifest（包括用户改过 title 的情况）。
  7. 重启桌面 App，确认所有创建的自动化仍存在并继续触发后台 thread。

### AgentTrigger 新增自动化取消后错误状态残留

- **严重级别**：P3
- **复现步骤**：
  1. 备份并移走 `~/.spotAgent/agent-triggers/` 后，执行 `bash ./scripts/swiftw run HandAgentDesktop` 启动桌面 App。
  2. 通过菜单 `HandAgentDesktop → 设置…` 打开 Settings，进入 `触发器` 页。
  3. 点击 `Chrome Bookmarks`，进入二级页面。
  4. 点击 `新增自动化`，在标题为空时点击 `保存`，页面显示 `标题不能为空` 且 `~/.spotAgent/agent-triggers/instances.json` 未创建。
  5. 点击 `取消` 或收起新增表单，回到二级详情页。
- **实际结果**：新增表单已收起，但页面底部仍显示红色错误 `标题不能为空`。
- **期望结果**：取消或收起新增表单后，应清除本次表单校验错误；错误不应残留在详情页。
- **证据**：
  - `/tmp/handagent-settings-triggers-level1.png`：一级触发器页直接显示 `Chrome Bookmarks` 与 `System Clock`。
  - `/tmp/handagent-settings-triggers-chrome-detail.png`：Chrome Bookmarks 二级页显示包名、描述与 `暂无自动化`。
  - `/tmp/handagent-settings-triggers-chrome-empty-title.png`：空标题保存后显示 `标题不能为空`。
  - `/tmp/handagent-settings-after-cancel.png`：点击取消/收起后新增表单消失，但 `标题不能为空` 仍残留。
  - `find ~/.spotAgent/agent-triggers -maxdepth 2 -type f` 仅显示内置 package 与 bridge 文件，未出现 `instances.json`，证明空标题未创建实例。
- **初步调用链 / 根因边界**：`AgentTriggerSettingsView` 的新增表单把校验错误保存在 `AgentTriggerSettingsViewModel.saveErrorMessage`；空标题保存时 `createInstanceForCurrentPackage()` 设置该错误。`取消` 按钮和 `isAdding` 收起逻辑只执行局部 `resetForm()`，未清空 `viewModel.saveErrorMessage`，因此错误 footer 仍由父视图渲染。
- **发现日期**：2026-06-24
- **基线结果**：`bash ./scripts/test.sh`、`bash ./scripts/swiftw test`、`bash ./scripts/swiftw build` 均返回 `success`。
- **清理状态**：原 `~/.spotAgent/agent-triggers/` 已移动到 `~/.spotAgent/qa-backup-agent-triggers-20260624-015530`；本轮 QA 创建的临时 `~/.spotAgent/agent-triggers/` 仍保留用于后续修复回归。


### 默认 Websearch 工具

- 完成日期：待实机 QA
- 实现位置：`packages/core/src/tools/web/WebTools.ts`、`packages/core/src/runtime/AgentRuntime.ts`、`apps/agent-server/src/actions/ThreadScopedToolRegistry.ts`、`apps/agent-server/src/server/server.ts`、`packages/core/tests/tools/websearch-use-cases.test.ts`、`apps/agent-server/tests/thread/ThreadScopedToolRegistry.test.ts`、`packages/core/tests/permission/security-use-cases.test.ts`
- 修复结论：新增默认公开的 `web_search` 与 `fetch_page`。未激活 thread 默认暴露 `use_tools`、`web_search`、`fetch_page`；调用 `use_tools` 后移除 `use_tools`，但继续保留 websearch 工具并合并 builtin / MCP / dynamic tools。两个 web 工具设置 `requiresPermission=false`，runtime 跳过普通权限审批但仍产出 tool 审计事件。`web_search` 使用 Tavily Search API 并缓存结构化结果；`fetch_page` 只抓取公共 HTTP(S) URL，拒绝本机/私网/metadata 地址和危险重定向，移除非正文 HTML 后截断返回。
- 2026-06-25 修复记录：`fetch_page` 的固定地址 lookup 已兼容 Node 请求层 `all: true` 回调形态，避免在 Node 24 下访问公共网页时抛出 `Invalid IP address: undefined`。
- 自动化验证：需执行 `pnpm exec vitest run apps/agent-server/tests/thread/ThreadScopedToolRegistry.test.ts packages/core/tests/tools/websearch-use-cases.test.ts packages/core/tests/permission/security-use-cases.test.ts`、`bash ./scripts/test.sh`。
- 手工回归步骤：
  1. 在启动 agent-server 的环境设置 `TAVILY_API_KEY`，启动桌面 App。
  2. 提交需要近期信息的问题，例如查询某个官方发布说明，确认未先调用 `use_tools` 也能直接出现 `web_search` tool 调用。
  3. 确认 `web_search` tool result 中每条结果包含 URL、snippet 和 source，最终 assistant 回答引用这些 URL。
  4. 让模型精读某条搜索结果，确认只调用对应 URL 的 `fetch_page`，tool result 是清洗后的正文，不包含 script/style/nav 等 HTML 噪音。
  5. 重复同一 query 或同一 URL，确认响应更快且不会重复产生多次外部请求异常；若去掉 `TAVILY_API_KEY` 重启，确认 `web_search` 返回明确缺 key 错误，App 不崩溃。
  6. 要求模型抓取 `http://localhost`、`http://127.0.0.1` 或私网地址，确认 `fetch_page` 拒绝并返回只支持公共 Web URL 的错误。

### OpenAI-compatible Responses SSE 连续事件解析导致 web_search tool call 前失败

- **严重级别**：P1。真实 LLM 的 Responses tool-call 路径失败，阻塞默认 Websearch 工具实机验收。
- **复现步骤**：
  1. 在 main checkout `/Users/mu9/proj/handAgent` 确认工作区干净，执行 `bash ./scripts/test.sh`、`bash ./scripts/swiftw test`、`bash ./scripts/swiftw build`，三项均返回 `success`。
  2. 设置环境中已有 `TAVILY_API_KEY` 与 OpenAI-compatible provider，`~/.spotAgent/settings.json` 指向 `provider=openai-compatible`、`api=responses`、`baseUrl=http://127.0.0.1:8090/v1`，本地 8090 服务由 `axonhub` 监听。
  3. 执行 `bash ./scripts/swiftw run HandAgentDesktop` 启动桌面端，确认 agent-server 监听 `127.0.0.1:4317`，Electron ActivityWindow 可见。
  4. 因本机全局快捷键未唤起 PromptPanel，本轮通过当前 Electron command socket `/tmp/hae-CDED2EF8-EABF-4EE9-BED9-D77BBD802543.sock` 发送 `thread_window.open_initial_prompt`，prompt 为 `WEBSEARCH_QA_20260625 请先调用 web_search 搜索 OpenAI 官方网站 2026 年 6 月发布说明...`。
- **实际结果**：ThreadWindow 创建 `thread-01cca829-9154-484d-ad85-bccbe739703c` 并进入运行态；模型先调用 `use_tools`，随后 Responses stream 中产出 `web_search` function_call，但 agent-server 在解析同一 SSE chunk 内连续的 `response.output_item.done` 与 `response.completed` 两个 JSON 对象时抛出 `JSONParseError`，turn 标记为 `failed`，未执行 `web_search`，也未进入 `fetch_page`。
- **期望结果**：OpenAI-compatible Responses stream 中即使同一 data payload 内包含连续 JSON 事件，也应被拆分/归一化为 AI SDK 可消费的事件；`web_search` tool result 应返回 URL/snippet/source，随后 `fetch_page` 精读一个官方 URL 并产出最终中文回答。
- **证据**：
  - Computer Use：Electron `HandAgent ThreadWindow` 可见，新历史项 `WEBSEARCH_QA_20260625...` 显示 `运行中`，Composer 显示 `停止` 按钮。
  - SQLite：`~/.spotAgent/threads.sqlite` 中 `thread_items` sequence 4 为 `thread.error`，message 以 `JSON parsing failed: Text: {"type":"response.output_item.done"..."name":"web_search"}\n{"type":"response.completed"...` 开头；sequence 5 为 `turn.completed(status:"failed")`，sequence 6 为 `thread.status.changed(value:"failed")`。
  - Network log：`~/.spotAgent/log/2026-06-25/network-001.jsonl` 记录第二次 `/v1/responses` 请求中 tools 已包含 `web_search` / `fetch_page`，响应为 `text/event-stream`；agent-server stderr 记录 `Unexpected non-whitespace character after JSON at position 436 (line 2 column 1)`。
  - Cleanup：记录缺陷后已停止本轮 `swiftw run` 进程链，并手动清理残留 Electron / agent-server；`lsof -nP -iTCP:4317 -sTCP:LISTEN` 无输出。
- **初步调用链 / 根因边界**：`Electron command socket thread_window.open_initial_prompt -> ThreadWindow 创建 thread -> /api/thread op.submit(UserInput) -> agent-server AgentManager -> SettingsBackedLLMClient -> VercelClient.stream -> OpenAI-compatible /v1/responses SSE -> AI SDK parse-json-event-stream`。失败边界在本地 Responses SSE 兼容层：现有包装只处理空 data/event 合并场景，没有处理一个 data payload 内含多个换行分隔 JSON 对象的场景。
- **发现日期**：2026-06-25
- **修复进展**：`websearch-sse-parser-fix` worktree 已在 `packages/core/src/llm/VercelAdapters.ts` 中补充 NDJSON payload 拆分，并在 `packages/core/tests/llm/vercel-client.test.ts` 增加红灯用例；`pnpm exec vitest run packages/core/tests/llm/vercel-client.test.ts`、`bash ./scripts/test.sh`、`bash ./scripts/swiftw test` 和 `bash ./scripts/swiftw build` 已通过。
- **当前阻塞**：修复后实机重跑 `WEBSEARCH_QA_FIX_20260625` 已不再出现 `JSONParseError`，但本地 `http://127.0.0.1:8090/v1/responses` 返回 401 `Encountered invalidated oauth token for user, failing request`，因此无法完成 `web_search` / `fetch_page` 全链路归档。回归 thread：`thread-4a6b253a-bb6d-4ec3-8a9b-f9d4186204ff`；cleanup 后 `127.0.0.1:4317` 无监听。
