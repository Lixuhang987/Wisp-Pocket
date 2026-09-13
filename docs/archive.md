# 实机验收归档

本文件保存已通过实机验收的原始清单条目和证据。尚未通过的项目继续留在 [manual-qa.md](./manual-qa.md)，产品缺陷记录在 [bugs.md](./bugs.md)。


- [ ] 启动与首次文字：首次启动只有月见八千代角色，默认位于主屏工作区右下角；已有历史不自动弹出，首次纯文字仍通过 PromptPanel，桌宠不新增空白输入入口。
  - 2026-09-13 验证进度：Computer Use 已观察到仅角色；CGWindow 显示主屏 1440×932、角色窗口 `(1224, 700, 192, 208)`，位于工作区右下角。测试包 `/tmp/issue1-live/app/Wisp Pocket.app`，临时后端数据 `/tmp/issue1-live/data`。Computer Use 读取无普通窗口的 Swift 宿主持续超时，快捷键尚无可确认的窗口变化；主线程采样处于正常事件等待，暂不判为产品缺陷。本项保持待验，等待补齐首次文字与有历史重启证据。
  - 2026-09-13 续验：默认打包路径正常启动，Computer Use 的窗口树只有月见八千代按钮，图片可见；真实 SQLite 原有 83 个 Thread，启动未弹出历史。已配置快捷键确为 ⌘⇧Space；从文本编辑发送后仍无 PromptPanel，读取无普通窗口的宿主超时，已请求真实键盘对照，尚不能判定产品缺陷。首次文字与无既有位置文件的默认位置仍待补证；系统证据见本轮 `evidence/windows-default-startup.txt`、`windows-after-shortcut.txt` 和 `logs/desktop-default.log`。

### Issue #1 启动与首次文字（续验）

- **验证日期**：2026-09-13。
- **验证环境**：macOS 15.5 / arm64，单屏 1440×932，工作区为 `(0, 34, 1440, 898)`；用户指定的 `codex/issue-1-pet-main-20260913` worktree，`0194a22` 加开始时已有的 8 个未提交文件。使用默认 `dist/Wisp Pocket.app`、真实 agent-server 与当前模型设置，桌宠位置文件独立保存。源码快照和日志根目录为 `/tmp/issue1-live-qa-20260913-1030/`。
- **基线**：`bash ./scripts/test.sh`、`bash ./scripts/swiftw test`、`bash ./scripts/swiftw build`、`bash ./scripts/package-app.sh` 均通过。
- **验证过程**：确认新的位置文件不存在后启动，首次原生窗口为 `(1224, 700, 192, 208)`，右下角锚点为 `{right:1416,bottom:908}`；Computer Use 观察到月见八千代图像及唯一角色按钮。真实 SQLite 启动前已有 83 个 Thread，未自动显示历史。按用户指导使用 `osascript` 发送系统 ⌘⇧Space，Computer Use 读取 PromptPanel、写入完整中文 QA 消息，再用系统 Return 提交；ThreadWindow 正常打开。关闭完整窗口后桌宠仍显示该 Thread 的结果。退出并重启后，窗口树再次只有角色按钮，没有气泡或空白回复入口。
- **证据**：`evidence/windows-fresh-restart-before-cua.txt`、`pet-position-fresh-1230.json`、`evidence/first-text-thread.json`、`logs/desktop-default.log`、`logs/desktop-restart.log`；Computer Use 会话中的角色和 PromptPanel 截图、两端窗口树。测试 Thread 为 `thread-beb5b37d-bd9b-455f-8222-4a3ba1ccf502`，用户消息完整保存为 response_item，日志出现 `coordinator.submit_prompt`、`hide restoringFocus=false`、`electron.command_ack kind=focus ok=true`。
- **结论**：本分项通过。模型返回 `AI SDK stream finished without assistant content or tool calls`，两端均显示失败、输入已保存并等待回复；本结论只覆盖启动、首次文字入口及历史不自动弹出，不代表模型理解或建议流程通过。
- **工具边界**：全局快捷键须通过系统 `osascript` 发送；Computer Use 的 `typeText` 未完整输入中文，改用 settable 文本控件并在提交前核对全文。二者均不记为产品缺陷。
- **清理状态**：首次进程已正常退出；重启实例继续用于下一项 QA。测试 Thread 保留为验收证据，用户模型设置未修改。
