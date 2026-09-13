# Bug 清单

本文只记录当前仍未修复、需要排查或实现改动的缺陷。已实现但仍需实机验收的项目放在 [manual-qa.md](/Users/mu9/proj/handAgent/docs/manual-qa.md)。

最后核对日期：2026-06-30。

## 维护边界

- 修复跨 View / ViewModel / Coordinator / Service / 进程边界 / 系统 API 的 bug 时，必须遵循 [$trace-and-verify-call-chain](/Users/mu9/.agents/skills/trace-and-verify-call-chain/SKILL.md)。
- 修复完成后，从本文移除，并把仍需人工回归的步骤写入 [manual-qa.md](/Users/mu9/proj/handAgent/docs/manual-qa.md)。
- 历史 QA 证据不能直接当作当前缺陷依据；同类问题应按当前代码和当前持久化路径重新复现。

## 当前 bug

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


### 桌宠悬停历史应为原位主气泡上方的独立浮动气泡

- **严重级别**：P2，视觉与交互形态不符合用户确认的目标。
- **发现日期**：2026-09-13。
- **复现步骤**：在 `codex/issue-1-pet-main-20260913` 的打包 App 中创建含多轮用户与 assistant 消息的 Thread；先把鼠标移出气泡，观察最新 assistant 消息；再悬停气泡查看历史。
- **实际结果**：收起状态为一个最新回复气泡；悬停后替换为带整块背景的历史面板，消息、建议与回复框包在同一外框中，不能保持“最新气泡原位、旧气泡浮在上方”的形态。
- **期望结果**：按用户本轮明确要求，收起时仍只显示最新 assistant 消息；悬停时该气泡的屏幕位置保持不变，其上方直接浮出多条独立消息气泡，历史容器无背景。历史滚动、用户消息方向与回复能力仍需保留。
- **证据**：`/tmp/issue1-live-qa-20260913-1030/evidence/hover-before-collapsed.jpg` 记录收起样式，`image-history-bottom.png` 与 `image-b-after-drop.png` 记录展开历史样式；`hover-before-geometry.json` 记录原生窗口从 `(956,445,368,370)` 扩为 `(956,175,368,640)`。用户在同一运行环境直接指出该视觉问题。
- **初步调用链 / 根因边界**：原生鼠标进入 → renderer 悬停状态 → 历史投影与布局 → Electron 窗口尺寸；输入、真实模型读取与 Thread 持久化已在其他分项通过，问题定位在桌宠呈现层，具体布局与窗口锚点需在独立修改中核对。
- **基线与覆盖**：本轮 TypeScript/Web、Swift test/build 与打包均通过；启动与首次文字、移动与位置恢复、文本和图片两区域拖入已归档。公共链接测试仅打开源网页，尚未提交拖入；其余分项保持待验。
- **清理状态**：测试 App、Electron 与 agent-server 已退出，4317 无监听；`llm.api` 已恢复 `responses` 且原始文件 SHA256 一致，临时密钥备份已删除。本轮 TextEdit 文稿及 Finder materials 窗口已关闭；浏览器空间 51 已由用户接管，保留且不再操作。证据为 `model-config-restored.json`、`qa-paused-cleanup.json`。本轮 live QA 到此结束，修复作为独立编码阶段处理。
