# Bug 清单

本文只记录当前仍未修复、需要排查或实现改动的缺陷。已实现但仍需实机验收的项目放在 [manual-qa.md](/Users/mu9/proj/handAgent/docs/manual-qa.md)。

最后核对日期：2026-09-14。

## 维护边界

- 修复跨 View / ViewModel / Coordinator / Service / 进程边界 / 系统 API 的 bug 时，必须遵循 [$trace-and-verify-call-chain](/Users/mu9/.agents/skills/trace-and-verify-call-chain/SKILL.md)。
- 修复完成后，从本文移除，并把仍需人工回归的步骤写入 [manual-qa.md](/Users/mu9/proj/handAgent/docs/manual-qa.md)。
- 历史 QA 证据不能直接当作当前缺陷依据；同类问题应按当前代码和当前持久化路径重新复现。

## 当前 bug

### Chrome Bookmarks bridge endpoint 与实际监听端口不一致

- **严重级别**：P1。
- **发现日期**：2026-06-25。
- **复现边界**：首次启动后进入 Settings -> 触发器 -> Chrome Bookmarks 二级页，使用产品 native host 发送 `handagent.bookmarks.hello` 和 `handagent.bookmarks.folderTreeSnapshot`。
- **实际结果**：native host 返回 `{"ok":false,"error":"Could not connect to the server."}`，Settings 显示扩展连接不可用，`folders.json` 未生成。
- **期望结果**：`bridge.json` 指向当前 Swift bridge 正在监听的端口和 token；hello / folderTreeSnapshot 转发成功，Settings 表单可选择收藏夹并保存自动化。
- **关键证据**：发现时 `bridge.json` 写入端口 `53317`，但 HandAgentDesktop 进程只监听旧端口 `53288`；旧端口携带当前 token 返回 `401`，新端口连接失败。
- **排查边界**：历史证据指向 Swift `AgentTriggerRuntime` / `ChromeBookmarksAgentTriggerProvider` / `ChromeBookmarksExtensionBridgeServer` 的 provider lifecycle 或 endpoint 写入，具体失配点仍待当前打包 App 实机定位；Settings UI 和 native host 读取磁盘 endpoint 后展示或转发。
- **当前核对（2026-09-14）**：临时 home 中，真实 runtime、Provider 与 HTTP 连续 20 次 reload 均按磁盘 endpoint 完成认证请求及快照落盘，未复现旧端口错配。本轮没有生产修复，单进程结果不覆盖打包 App、native host、Settings 或共享发现文件的其他进程；保留本项，按 [manual-qa](./manual-qa.md#agenttrigger-设置二级菜单与默认-package) 实机定位。
