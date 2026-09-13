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


### P1：完全退出时 Electron 回执触发 EPIPE 并残留异常对话框

- **严重级别**：P1，阻断正常完全退出与后续验收清理。
- **发现日期**：2026-09-13。
- **复现步骤**：使用本 worktree 的 `dist/Wisp Pocket.app`，正常启动并打开 Settings；通过 `osascript` 核对 Host 前台 PID 后发送 Command-Q；观察 Electron 与 Node 子进程。
- **实际结果**：Swift Host 退出、服务端口关闭，但 Electron 弹出 `A JavaScript error occurred in the main process / Uncaught Exception: Error: write EPIPE` 并持续运行，Node 为僵尸；60 秒退出检查失败。
- **期望结果**：宿主关闭输出管道后，已启动的 shutdown 清理仍完成，停止 agent-server 并退出 Electron，不弹出未处理异常或遗留进程。
- **证据**：macOS 15.5 (24F74)，二进制 SHA-256 `b86c404631a0bb81b1a62ac0624e30770ac06c2a1b94eb9cb6a8b6c14cc95be7`。CUA 直接读取残余 Electron PID 43008 的警告对话框；堆栈为 `Writable.write → JsonLineBridge.send → main.send → ElectronShellRuntime.ack`。Host 43006 已退出，Node 43020 为 `Z / defunct`。`.cache/issue-4-qa/au2-old-electron.sample.txt` 显示此前 PID 40111 主线程停在 `NSAlert.runModal`；`shutdown-evidence.jsonl`、`shutdown-dialog-evidence.jsonl` 记录两轮 60 秒进程检查。
- **初步调用链 / 根因边界**：原生 Command-Q → Swift shutdown 发送及退出 → Electron 收到 shutdown → ack 写 stdout → 宿主读取端已关闭，异步 stream error 无接收者 → Electron 默认异常对话框 → 清理被模态循环阻断。GUI 与系统证据已定位到输出流错误边界；接下来以真实断开管道构造可重复回归。
- **基线与清理状态**：此前 Web、Swift test/build/package 均已通过，生产代码未变化；本轮 live QA 暂停。Host/采集/录制已停止，残余 Electron 错误框待确认后清理；AU3 的禁用取消已验证，退出取消的一轮先发生 AX snapshot 错误，不能计作取消通过。
