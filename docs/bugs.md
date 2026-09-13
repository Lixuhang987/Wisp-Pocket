# Bug 清单

本文只记录当前仍未修复、需要排查或实现改动的缺陷。已实现但仍需实机验收的项目放在 [manual-qa.md](/Users/mu9/proj/handAgent/docs/manual-qa.md)。

最后核对日期：2026-09-14。

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
- **本轮边界**：Issue #3 要求保持基线窗口选择规则并单列既有缺陷，原结构重构和后续合并均保留该处理；桌宠按创建时间选择最新 Thread 属于独立产品规则。

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


### 从 Electron 正常退出后 Swift Host 挂起

- **严重级别**：P2。
- **发现日期**：2026-09-14。
- **复现步骤**：主分支 `627e91b` 通过三项检查后重新打包并正常打开；通过 PromptPanel 创建对话，真实模型回复后在前台 ThreadWindow 使用 System Events 发送 `Command+Q`。
- **实际结果**：Electron（PID 71909）和 agent-server（71927）退出，4317 释放；Swift Host（71887）持续存活且无可交互窗口，超过一分钟仍未结束。
- **期望结果**：等待宿主异步清理完成后正常退出，后台能力和进程不会残留；不能通过提前退出丢弃 Automation 的取消落盘。
- **证据**：`.cache/live-qa-20260914/fixed-launch-error.log` 与 `host-exit.sample.txt`；采样主线程为 `ElectronShellProcess.start` 的 MainActor Task → `handleTermination` → `ElectronBackedAppServer.handleTermination` → `AppCoordinator.setupAgentServerHealth` → `NSApplication.terminate` → `_shouldTerminate` 嵌套事件等待。多次 `ps` 确认同一宿主 PID 持续存在。测试内置功能使用独立、默认关闭的数据目录。
- **初步调用链 / 根因边界**：进程退出回调、status 0 处理和宿主退出请求均已验证；卡点位于 AppKit 等待终止回执与 `applicationShouldTerminate` 中 MainActor 异步清理之间，需用真实 AppKit 子进程测试验证调度重入。
- **已验证前置流程**：默认冷启动显示桌宠；全局 `Command+Shift+Space` 唤出、Escape 返回原 iTerm2；本机历史快捷键配置为 `Command+H`，关闭后可重新打开历史。真实 Responses 模型返回 `QA_START_OK`，SQLite Thread `thread-9ab204ee-899d-4d8b-8bb1-304381455132` 保存用户/assistant 与 completed/idle 事件。关闭 ThreadWindow 后后端继续运行。
- **基线与清理**：TypeScript/Web、Swift test（340 项）/build 和正式模型打包成功。本条登记后停止挂起的测试宿主；尚未验证失效 binary 冷启动和完整重启流程，修复后恢复 QA-START。
