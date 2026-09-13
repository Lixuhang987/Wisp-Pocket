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

### Issue #4：后台 Swift Host 激活应用失败

- **发现日期**：2026-09-13
- **严重级别**：P1，阻断跨应用 Automation 实机验收。
- **状态**：已确认，待修复；修复用例及拟采用的系统路径见 [Issue #4 实施计划](./medium-powers/plans/2026-09-13-issue-4-builtin-modules.md)。
- **复现步骤**：运行本分支实施提交 `8911eaf` 的签名产物及受控 AppKit fixture；经真实 Provider 的 `app_list` 确认 Swift Host `isActive:false` 且仍在运行，再经 server → Dynamic Tool bridge → Swift Provider 调用 `host_macos.app_activate`，目标为该 Host 的 bundleId。复现命令：`python3 .cache/issue-4-qa/activation-use-case.py resume-background-red`。
- **实际结果**：前台 Host 激活 fixture 可成功；Host 退到后台后，请求激活自身返回 `success:false`、`action_failed: macOS refused to activate the running app`。同一产物通过 LaunchServices 重启后仍复现；此前受控 Automation 也停在激活步骤。
- **期望结果**：在已授予系统控制权限且目标仍运行时完成请求的应用切换，确认目标稳定处于前台后返回成功；系统权限或目标失效时仍应明确失败。
- **证据**：macOS 15.5 (24F74)，产物 SHA-256 `b3596abbecd8a2f8089c6154d90fae7845e7bd836078ef246e176b469e72c503`；`.cache/issue-4-qa/responses/` 下的 `resume-activate-fixture.json`、`resume-background-red-apps.json`、`resume-background-red-activate-host.json`，以及 `.cache/issue-4-qa/activation-use-case-evidence.jsonl`。后台前提与失败响应来自同一真实工具入口；此前 Automation 失败见 `CH1-evidence.jsonl`。
- **系统对照**：同一 `osascript` / System Events 脚本设置 Host `frontmost=true` 后，实际前台 PID 与目标一致，再发送 Command-Q。已有系统控制权限下存在可用激活路径；这只是系统对照，不是产品修复或验收通过的证据。
- **初步调用链 / 根因边界**：真实 Provider 请求 → `activateRunningApplication` → `NSRunningApplication.activate(options: [.activateAllWindows])` 被拒绝，尚未进入稳定前台等待。拟补的 Accessibility 路径与权限失败边界仍待实施、验证；工具或 AX 方法返回成功不能替代实际前台状态。
- **验证与清理**：缺陷产物对应的 Web/Swift test/build、打包与签名检查已通过。2026-09-13 本次复现后暂停后续 QA，以 `osascript` 正常退出宿主，核对宿主退出、4317 监听释放，并关闭 fixture。HOST1 的读取、输入、图片及完整清理验收仍未完成，修复后恢复原完整条目继续；后续运行重新记录进程与清理状态。
