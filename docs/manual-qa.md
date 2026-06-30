# 手工验收清单

## 验收前提

- 已完成依赖安装。
- 已通过 `bash ./scripts/test.sh`。
- 已通过 `bash ./scripts/swiftw test`。
- 已通过 `bash ./scripts/swiftw build`。

## 待验收项

### Context History 与自进化 Automation 官方 plugin

- 关键 commit：0b88e68、187c867、12d2201、8b60245、ac018d5、5534f8b、839d70d、9526d31、d678037
- 实现位置：`apps/desktop/Sources/AppServices/PlatformBridge/PluginDynamicTools.swift`、`apps/desktop/Sources/AppServices/AppServices.swift`、`apps/builtin-plugins/`、`Package.swift`、`apps/desktop/TestsSwift/AppServices/PlatformBridge/PluginDynamicToolsTests.swift`、`apps/builtin-plugins/Tests/ContextHistoryPluginCoreTests.swift`、`apps/builtin-plugins/Tests/AutomationRuntimeTests.swift`
- 验收结果：新增官方 Swift plugin 安装/修复流程；AX、screenshot、app/window 原子 plugin 默认启用，其中 app/window plugin 提供 frontmost、list_windows、activate；Context History 与 Automation runtime 默认关闭，启用 manifest 后由 Swift desktop 启动 always-on plugin，并通过常驻 stdin/stdout RPC 响应 dynamic tool 调用。Context History core 已覆盖前台 app/window 变化采样、30 秒周期 activity sample、60 秒截图文件记录和 activity index / sample details / thumbnails / original screenshot 分层查询；Automation 已覆盖 record_start / record_event / record_stop / policy_create / run / history / apply_patch / repair_apply 的 tool 路由、结构化存储、`captureUserEvents` fake live recorder 合并、macOS event tap 生产接入、操作前后 app/window + AX + 截图 evidence 采集、trace events 到受限 Automation Policy 的 fallback 生成、agent 归纳 policy / branch 回填、branch conditions 匹配、conditions 不匹配时进入 repair、受限 AX Policy 执行、waitFor、断言、失败 repair request 落盘、fallback repair patch 自动合入、repair request 队列查询、agent/computer-use branch 回填合入，以及包含目标、匹配 branch/conditions、AX/截图 evidence、repair evidence 的 run/patch history 写入。真实点击、基础 keyDown 文本输入和快捷键录制仍需实机 QA；runtime 自己驱动 LLM 或直接执行 computer use 仍需后续接入与实机 QA 验证。
- 自动化验证：需执行 `bash ./scripts/swiftw test --filter PluginDynamicToolsTests`、`bash ./scripts/swiftw test --filter ContextHistoryPluginCoreTests`、`bash ./scripts/swiftw test --filter AutomationRuntimeTests`、`bash ./scripts/swiftw test`、`bash ./scripts/swiftw build`、`bash ./scripts/test.sh`。
- 手工回归步骤：
  1. 启动桌面 App 后确认 `~/.spotAgent/plugins/handagent-atomic-app-window/plugin.json`、`handagent-atomic-screenshot/plugin.json`、`handagent-atomic-ax/plugin.json`、`handagent-context-history/plugin.json`、`handagent-automation-runtime/plugin.json` 被写入。
  2. 确认三个原子 plugin 的 `enabled` 为 `true`，Context History 与 Automation runtime 的 `enabled` 为 `false`。
  3. 手工把 `handagent-context-history/plugin.json` 的 `enabled` 改为 `true` 后重启桌面 App，新建 thread，确认 dynamic tool 列表包含 `context_history.activity_index`、`sample_details`、`thumbnails`、`screenshot_original`。
  4. 调用 `context_history.activity_index`，确认 tool call 由同一个 always-on Context History plugin 进程响应，且 index 不返回完整 AX 树或原图。
  5. 切换前台 app/window 后等待一个采样 tick，再调用 `context_history.activity_index`，确认新增 activity sample；不切换窗口持续 30 秒后确认会补一条周期 sample；持续 60 秒后确认 `context_history.thumbnails` 出现截图记录。
  6. 手工把 `handagent-automation-runtime/plugin.json` 的 `enabled` 改为 `true` 后重启桌面 App，新建 thread，确认 dynamic tool 列表包含 `automation.record_start`、`record_event`、`record_stop`、`policy_create`、`run`、`history`、`apply_patch`、`repair_apply`。
  7. 调用 `automation.record_start`，用 `automation.record_event` 写入 click / setValue / typeText / hotkey / waitFor / assertion 等结构化事件，确认每个 event 含 before/after app-window、AX、screenshot evidence；再调用 `automation.record_stop` 和 `automation.policy_create`，确认生成的 policy branch 包含对应受限 steps 与 assertions；传入 agent 归纳的 `policy` 或 `branch` 时应按该 payload 保存，并在包含多个带 conditions 的 branch 时只执行当前 AX 状态匹配的分支；若没有 branch conditions 匹配，应进入 repair request / patch 路径。
  8. 调用 `automation.record_start` 时传入 `captureUserEvents: true`，执行一次真实点击、基础 keyDown 文本输入和快捷键；再调用 `automation.record_stop`，确认 trace 包含 `source: "macos_event_tap"` 的 click / typeText / hotkey event，并且每个 event 含 before/after evidence。若 macOS 权限不足，确认响应含 `liveRecording: "unavailable"` 或 `liveRecordingError`，结构化录制仍可继续。
  9. 准备一个最小 policy 写入 `~/.spotAgent/automation/policies/`，调用 `automation.run`；若执行失败，确认 runtime 会写入 run 记录、保存 repair request、生成 fallback policy patch 并自动合入，且 `automation.history` 返回 pending repair request。
  10. 模拟 agent/computer-use 完成当前失败任务后，调用 `automation.repair_apply` 提交 repair branch，确认 policy version 增加、patch 写入，repair request 状态变为 `applied` 并记录 `patchId`；再次对同一 repair request 调用 `repair_apply` 应失败且不重复递增 policy version。
  11. 再次编辑官方 manifest 的其他字段为错误值但保留 `enabled`，重启 App，确认 installer 会修复官方 manifest，同时保留用户的 `enabled` 选择。
  12. 将已启用的 Context History 或 Automation manifest 改回 `enabled: false` 并重启 App，确认对应 always-on plugin 停止，dynamic tool 列表不再包含对应 namespace。
