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
- **复现边界**：Settings -> 触发器 -> Chrome Bookmarks 二级页，新增自动化时先选择文件夹，空标题保存会显示 `标题不能为空`；随后点击取消。重新展开，不选文件夹保存会显示 `至少选择一个收藏夹文件夹`，随后点击收起。
- **实际结果**：新增表单已收起，但详情页底部仍残留红色错误。
- **期望结果**：取消或收起新增表单后清除本次表单校验错误。
- **根因边界**：`AgentTriggerSettingsViewModel.saveErrorMessage` 由空标题保存设置；取消按钮和 `isAdding` 收起逻辑只重置局部表单，没有清空 view model 的错误状态。
- **基线结果**：发现时 `bash ./scripts/test.sh`、`bash ./scripts/swiftw test`、`bash ./scripts/swiftw build` 均返回 `success`。
- **当前复现（2026-09-14）**：主 checkout `main` 的 `2920af8`，macOS 15.5 arm64，使用包含 `984a04b` 生产代码的 `dist/Wisp Pocket.app`；三项检查已通过。Computer Use 确认两条关闭路径均隐藏输入与保存按钮，但上述红色错误仍可见，列表仍为“暂无自动化”。宿主 PID `38290`、Electron `38303`、agent-server `38321` 均来自本轮主 checkout；正常退出后进程结束、4317 释放。操作与产物哈希见 `.cache/live-qa-20260914/trigger-form-repro.json`；尚未修复。

### Chrome Bookmarks bridge endpoint 与实际监听端口不一致

- **严重级别**：P1。
- **发现日期**：2026-06-25。
- **复现边界**：首次启动后进入 Settings -> 触发器 -> Chrome Bookmarks 二级页，使用产品 native host 发送 `handagent.bookmarks.hello` 和 `handagent.bookmarks.folderTreeSnapshot`。
- **实际结果**：native host 返回 `{"ok":false,"error":"Could not connect to the server."}`，Settings 显示扩展连接不可用，`folders.json` 未生成。
- **期望结果**：`bridge.json` 指向当前 Swift bridge 正在监听的端口和 token；hello / folderTreeSnapshot 转发成功，Settings 表单可选择收藏夹并保存自动化。
- **关键证据**：发现时 `bridge.json` 写入端口 `53317`，但 HandAgentDesktop 进程只监听旧端口 `53288`；旧端口携带当前 token 返回 `401`，新端口连接失败。
- **排查边界**：历史证据指向 Swift `AgentTriggerRuntime` / `ChromeBookmarksAgentTriggerProvider` / `ChromeBookmarksExtensionBridgeServer` 的 provider lifecycle 或 endpoint 写入，具体失配点仍待当前打包 App 实机定位；Settings UI 和 native host 读取磁盘 endpoint 后展示或转发。
- **当前核对（2026-09-14）**：临时 home 中，真实 runtime、Provider 与 HTTP 连续 20 次 reload 均按磁盘 endpoint 完成认证请求及快照落盘，未复现旧端口错配。本轮没有生产修复，单进程结果不覆盖打包 App、native host、Settings 或共享发现文件的其他进程；保留本项，按 [manual-qa](./manual-qa.md#agenttrigger-设置二级菜单与默认-package) 实机定位。
