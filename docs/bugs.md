# Bug 清单

本文只记录当前仍未修复、需要排查或实现改动的缺陷。已实现但仍需实机验收的项目放在 [manual-qa.md](/Users/mu9/proj/handAgent/docs/manual-qa.md)。

最后核对日期：2026-06-30。

## 维护边界

- 修复跨 View / ViewModel / Coordinator / Service / 进程边界 / 系统 API 的 bug 时，必须遵循 [$trace-and-verify-call-chain](/Users/mu9/.agents/skills/trace-and-verify-call-chain/SKILL.md)。
- 修复完成后，从本文移除，并把仍需人工回归的步骤写入 [manual-qa.md](/Users/mu9/proj/handAgent/docs/manual-qa.md)。
- 历史 QA 证据不能直接当作当前缺陷依据；同类问题应按当前代码和当前持久化路径重新复现。

## 当前 bug

### ThreadWindow 被后台新建 Thread 切换选中项

- **发现日期**：2026-09-13；Issue #3 基线 `a919901` 静态链路确认，待实机复现。
- **触发边界**：用户正在查看 Thread A，PromptPanel / AgentTrigger 等其他入口创建 Thread B。
- **代码行为**：server 的 `ThreadNotificationPublisher` 向所有连接广播 `thread.started`；Web `App` 对每个 started 无条件调用 `setActiveThreadId`，因此后台创建也会切走当前选中项。
- **期望结果**：窗口选择只由相应 UI 发起流程决定；具体选择规则需在独立修复中确认。
- **本轮边界**：Issue #3 要求保持基线窗口选择规则并单列既有缺陷，本次结构重构不修改该处理。

### AgentTrigger 新增自动化取消后错误状态残留

- **严重级别**：P3。
- **发现日期**：2026-06-24。
- **复现边界**：Settings -> 触发器 -> Chrome Bookmarks 二级页，新增自动化时空标题保存会显示 `标题不能为空`；随后点击取消或收起表单。
- **实际结果**：新增表单已收起，但详情页底部仍残留红色错误。
- **期望结果**：取消或收起新增表单后清除本次表单校验错误。
- **根因边界**：`AgentTriggerSettingsViewModel.saveErrorMessage` 由空标题保存设置；取消按钮和 `isAdding` 收起逻辑只重置局部表单，没有清空 view model 的错误状态。
- **基线结果**：发现时 `bash ./scripts/test.sh`、`bash ./scripts/swiftw test`、`bash ./scripts/swiftw build` 均返回 `success`。

### Chrome Bookmarks bridge endpoint 与实际监听端口不一致

- **严重级别**：P1。
- **发现日期**：2026-06-25。
- **复现边界**：首次启动后进入 Settings -> 触发器 -> Chrome Bookmarks 二级页，使用产品 native host 发送 `handagent.bookmarks.hello` 和 `handagent.bookmarks.folderTreeSnapshot`。
- **实际结果**：native host 返回 `{"ok":false,"error":"Could not connect to the server."}`，Settings 显示扩展连接不可用，`folders.json` 未生成。
- **期望结果**：`bridge.json` 指向当前 Swift bridge 正在监听的端口和 token；hello / folderTreeSnapshot 转发成功，Settings 表单可选择收藏夹并保存自动化。
- **关键证据**：发现时 `bridge.json` 写入端口 `53317`，但 HandAgentDesktop 进程只监听旧端口 `53288`；旧端口携带当前 token 返回 `401`，新端口连接失败。
- **根因边界**：问题在 Swift `AgentTriggerRuntime` / `ChromeBookmarksAgentTriggerProvider` / `ChromeBookmarksExtensionBridgeServer` 的 provider lifecycle 或 endpoint 写入；Settings UI 和 native host 只是读取磁盘 endpoint 后展示或转发。


### P1：正常退出未等待 Automation 取消落盘，Run 永久保留 running

- **严重级别**：P1，已终止执行留下不可信运行状态，阻断 AU3 退出验收。
- **发现日期**：2026-09-13。
- **复现步骤**：启动 b22c542 对应签名包并启用 Automation；经真实 Dynamic Tool Provider 创建流程，激活受控窗口、填写标记、等待永不存在的控件，再点击 Apply。单一 Python 进程在磁盘确认前两步完成且 Run 为 running 后，立即用 osascript 核对 Host 前台并发送 Command-Q。
- **实际结果**：1.521 秒内 Host 80432、Electron 80438、Node 80445 全部退出，无 EPIPE 残余；Run 42907AFB-0358-44BC-BC68-40B30C55D110 仍为 running，只有两个 completed 步骤，没有取消原因/阶段/证据。调用因服务退出断连；没有新增 Repair Request。
- **期望结果**：正常退出应先取消宿主操作并等待其保存 cancelled Run，再允许进程结束；保留已完成进度，后续 Apply 不执行，也不生成修复请求。
- **证据**：.cache/issue-4-qa/au3-exit-fixed-{pending,verdict}.json、shutdown-evidence.jsonl。Run SHA-256 650b369958992ec2fd7f594c097ce3e91f14e3693152fa3b1d7a3364b5c5e8f9。CUA 在退出后确认 QA Input 为 au3-exit-fixed reached，Saved 仍是上次成功内容。macOS 15.5 (24F74)，新包主程序 SHA-256 01fb70d79aa78a8e0f718c1e58e6731bff311bc0b266149f28f309233d0750b4，Electron bridge SHA-256 edcf5250ad107b88ed8e9668d2726bdd85056d5dc757f9963669b0c389425cab，签名通过。
- **初步调用链 / 根因边界**：Command-Q → applicationShouldTerminate → Coordinator.shutdown → BuiltinFeatures.stop → AutomationModule.stop / Task.cancel → applicationShouldTerminate 返回 terminateNow。进程结束与磁盘 running 已实证；需通过入口回归核验取消任务在 AppKit 允许退出前是否有机会保存，不能以调用了 cancel 代替取消完成。
- **基线与清理状态**：Web、Swift test/build/package 均在 b22c542 前通过；本次新发现后暂停 live QA。本任务 Host/Electron/Node 已全部退出，受控 fixture 保留，无活动采集或录制。原有失败、修复、重跑和禁用取消证据保留。
