# builtin-plugins

`apps/builtin-plugins` 存放随 HandAgent 发布的官方 Swift plugin。它们由 Swift desktop 的 `BuiltinPluginInstaller` 写入或修复到 `~/.spotAgent/plugins/<id>/plugin.json`，再由 `PluginDynamicToolManager` 启动和路由。

## 直接子节点

- `Sources/Support/`：`HandAgentPluginSupport` library target，包含 newline JSON plugin RPC、本地 manifest peer client、Context History store / collector / tool router、Automation Policy store / runtime / repair patch 核心。
- `Sources/AtomicAppWindow/`：`HandAgentAtomicAppWindowPlugin`，提供 `app_window.frontmost`、`app_window.list_windows` 与 `app_window.activate`。
- `Sources/AtomicScreenshot/`：`HandAgentAtomicScreenshotPlugin`，提供 `screenshot.capture` 与 `screenshot.thumbnail`。
- `Sources/AtomicAX/`：`HandAgentAtomicAXPlugin`，提供 `ax.snapshot` 与基于 selector 的 `ax.action` 入口。
- `Sources/ContextHistory/`：`HandAgentContextHistoryPlugin`，提供 `context_history.activity_index`、`sample_details`、`thumbnails`、`screenshot_original` 查询入口。
- `Sources/Automation/`：`HandAgentAutomationPlugin`，提供 `automation.record_start`、`record_event`、`record_stop`、`policy_create`、`run`、`history`、`apply_patch`、`repair_apply` 等 Automation runtime 入口。
- `Tests/`：`HandAgentPluginSupportTests`，覆盖 Context History 分层查询和 Automation Policy 执行 / repair patch 合入。

## 边界

- 官方 plugin 进程只通过 line-delimited JSON RPC 与 Swift desktop 的 plugin manager 通信，不连接 `/api/thread`。
- Context History 和 Automation runtime 需要原子能力时，通过 `LocalManifestPluginPeerClient` 读取 `~/.spotAgent/plugins` 中 enabled 的原子 plugin manifest，并用同一 JSON RPC envelope 调用对应 plugin。
- `Context History` 与 `Automation` 默认关闭；原子 plugin 默认启用。用户启用对应 manifest 后，Swift desktop 才启动 always-on runtime 并把 tools 放入 dynamic tool 列表。
- Context History 的数据写入 `~/.spotAgent/context-history`；Automation 的 policy、run、patch、trace、repair request 写入 `~/.spotAgent/automation`。
- Context History 采集调度会轮询前台 app/window：前台 app/window 变化时写 activity sample；未变化时按 30 秒周期补 sample；截图按 60 秒周期写入原图/缩略图文件路径并关联最近 activity sample。
- Automation 的 `record_start` / `record_event` / `record_stop` / `policy_create` 当前是 runtime API 与结构化存储骨架：`record_start(captureUserEvents: true)` 会在 Automation always-on plugin 进程内启动 macOS event tap，捕获点击、基础 keyDown 文本输入和快捷键；`record_event` 仍可补充结构化事件；`record_stop` 会为事件采集前后 app/window、AX、截图证据并保存 trace payload。runtime 可将 trace events 转成受限 Automation Policy，执行受限 AX policy，失败时保存 agent/computer-use repair request 并记录 repair patch；`history` 会返回 pending/applied repair requests，agent 完成 computer-use 修复后可通过 `repair_apply` 回填 branch 并自动合入 policy。当前尚不等同于 runtime 自己驱动 LLM 或直接执行 computer use。
- 当前原子 plugin 是 host capability 迁移起点；`host_macos.*` 仍保留，后续可在原子 plugin 稳定后逐步删除重复能力。
