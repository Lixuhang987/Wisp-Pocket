# Bug 清单

本文只记录当前仍未修复、需要排查或实现改动的缺陷。已实现但仍需实机验收的项目放在 [manual-qa.md](/Users/mu9/proj/handAgent/docs/manual-qa.md)。

最后核对日期：2026-09-14。

## 维护边界

- 修复跨 View / ViewModel / Coordinator / Service / 进程边界 / 系统 API 的 bug 时，必须遵循 [$trace-and-verify-call-chain](/Users/mu9/.agents/skills/trace-and-verify-call-chain/SKILL.md)。
- 修复完成后，从本文移除，并把仍需人工回归的步骤写入 [manual-qa.md](/Users/mu9/proj/handAgent/docs/manual-qa.md)。
- 历史 QA 证据不能直接当作当前缺陷依据；同类问题应按当前代码和当前持久化路径重新复现。

## 当前 bug

### ThreadWindow 被后台新建 Thread 切换选中项

- **严重级别**：P2。
- **发现日期**：2026-09-13 静态确认；2026-09-14 当前主分支包实机连续复现两次。
- **复现步骤**：在 ThreadWindow 查看 A 并留下 `QA_SELECTION_DRAFT_A`；独立 WebSocket 客户端向真实 `/api/thread` 只发送 `thread.start`，不发送宿主打开窗口命令或模型输入。
- **实际结果**：新建 B 出现在列表并抢走选中项，正文变成“等待输入”，Composer 为空；点击 A 后原消息与草稿恢复。再次后台创建仍复现。
- **期望结果**：外部创建通知只更新可见列表与事实投影，不擅自切换当前 Thread。用户在本窗口主动新建、点击历史或宿主明确打开目标 Thread 的流程仍可选中相应目标；桌宠按创建时间选最新 Thread 的独立规则不变。
- **证据**：主 checkout `.cache/live-qa-20260914/background-selection-repro.json`，`main` / `52bc459` 当前包、macOS 15.5 arm64。创建者与独立观察连接收到同一 `thread.started`，其 `commandId` 不属于 ThreadWindow；Computer Use AX / 截图确认两次选中项变化，SQLite 保留 A 和两个空白 B。第二轮 UI 断言报 `QA_SELECTION_FAILED`。
- **调用链边界**：独立客户端 start → 真实后端创建并广播 → Web 接收外部 started → 当前显示切换。既有静态记录指向 `App` 无条件调用 `setActiveThreadId`；修复前仍需用集成测试隔离 Web 通知处理、宿主回调与 store 默认选择。该最小复现不等同于完整 AgentTrigger 实测。
- **基线与清理**：TypeScript/Web、隔离 home Swift test、Swift build、正式模式打包与签名检查通过。记录后正常退出 Host/Electron/后端，4317 释放；测试 Thread 保留用于回归。

### Chrome Bookmarks bridge endpoint 与实际监听端口不一致

- **严重级别**：P1。
- **发现日期**：2026-06-25。
- **复现边界**：首次启动后进入 Settings -> 触发器 -> Chrome Bookmarks 二级页，使用产品 native host 发送 `handagent.bookmarks.hello` 和 `handagent.bookmarks.folderTreeSnapshot`。
- **实际结果**：native host 返回 `{"ok":false,"error":"Could not connect to the server."}`，Settings 显示扩展连接不可用，`folders.json` 未生成。
- **期望结果**：`bridge.json` 指向当前 Swift bridge 正在监听的端口和 token；hello / folderTreeSnapshot 转发成功，Settings 表单可选择收藏夹并保存自动化。
- **关键证据**：发现时 `bridge.json` 写入端口 `53317`，但 HandAgentDesktop 进程只监听旧端口 `53288`；旧端口携带当前 token 返回 `401`，新端口连接失败。
- **排查边界**：历史证据指向 Swift `AgentTriggerRuntime` / `ChromeBookmarksAgentTriggerProvider` / `ChromeBookmarksExtensionBridgeServer` 的 provider lifecycle 或 endpoint 写入，具体失配点仍待当前打包 App 实机定位；Settings UI 和 native host 读取磁盘 endpoint 后展示或转发。
- **当前核对（2026-09-14）**：临时 home 中，真实 runtime、Provider 与 HTTP 连续 20 次 reload 均按磁盘 endpoint 完成认证请求及快照落盘，未复现旧端口错配。本轮没有生产修复，单进程结果不覆盖打包 App、native host、Settings 或共享发现文件的其他进程；保留本项，按 [manual-qa](./manual-qa.md#agenttrigger-设置二级菜单与默认-package) 实机定位。
