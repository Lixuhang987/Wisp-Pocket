# Issue #4 合入主分支

## 范围与依据

- 用户授权把 `codex/issue-4-builtin-modules` 合入本地 `main`，并明确保留主分支已实现的 [Issue #1](https://github.com/Lixuhang987/Wisp-Pocket/issues/1)。本次不推送。
- 合并起点：main `8b54aed`，功能分支 `016cc5c`。功能分支包含 [Issue #3](https://github.com/Lixuhang987/Wisp-Pocket/issues/3) 的状态职责拆分和 [Issue #4](https://github.com/Lixuhang987/Wisp-Pocket/issues/4) 的内置模块及退出修复。
- 使用 `/Users/mu9/proj/handAgent/.worktrees/issue-4-main-20260913`；通过主 checkout 的规定脚本完成依赖及 CodeGraph 初始化。
- 主分支基线：`bash ./scripts/test.sh`、`bash ./scripts/swiftw build` 通过。日志位于该 worktree 的 `.cache/issue-4-main-baseline-{web,swift-build}.log`。

## 合并用例与契约

- 桌宠拖入 → `UserInput.mode: inspect` → Thread 保存输入及 Blob → 读取用户交付内容 → 建议等待 → 普通用户回复后执行。保持真实内容读取、持久队列、跨界面唯一请求回执；不改变桌宠布局、大小或窗口行为。
- ThreadWindow 提交 → 输入控制器 → socket FIFO → 后端 Thread 持久接收。忙碌和等待回复时都直接提交；`user.message.recorded` / `turn.started` 驱动 pending 展示，不恢复旧的前端执行队列。
- 首轮创建只由 store 登记一次：控制器读取关联 → store/UI 通知 → resume → submit。事实投影、输入关联和窗口偏好继续分别拥有修改责任，两个 renderer 各自创建 store。
- 桌宠创建入口随 socket 的职责拆分改用自己的输入控制器；保持先更新 store 和当前选择，再 resume 与提交的顺序。过期的前端执行队列用例由两界面后端持久接收的正向用例替代，不为已移除 API 补负向测试。
- Provider 注册及调用同时保留主分支的在线工具快照、token 隔离，以及功能分支的长操作等待、发送失败清理和可消费图片。
- 同连接同身份 hello 更新在线声明并保留 token/在途调用；旧 token 的刷新不影响替换连接。通过 socket 刷新、新 Thread 工具 metadata 和真实工具调用验证。
- 内置 Context History / Automation 继续默认关闭；正常退出等待 Automation 取消落盘，再答复 AppKit。保留 Electron 的 EPIPE 处理与主分支的 PromptPanel 焦点交接。
- 主分支 Runtime 的 assistant 消息 ID 与实时事件保持同一身份；图片消费用例对照最终事件 ID 核验返回消息，不恢复旧的无 ID 消息断言。

## 执行记录

- [x] 读取规格、历史和冲突范围；读取涉及目录指南及父级架构。
- [x] 建立隔离 worktree，确认 CodeGraph projectPath，运行分层基线。
- [x] 先以现有公开流程测试确认 Issue #1 的持久排队、建议等待与共享历史契约；为输入控制器合并增加必要的用例断言。
- [x] 逐项解决代码及文档冲突，保留以上契约；核对自动合并的共享状态、Provider 与图片消费链。
- [x] 执行 TypeScript/Web/Electron/agent-server/core、Swift test/build 及 Electron build；新失败按合并后的链路定位。
- [x] 独立、无上下文继承的文档 agent 核对三个规格、代码和各级文档，更新 manual QA；保留双方已有验收记录及未验边界。
- [x] 确认文档审核结论、检查通过和工作区内容；main 保持原起点且工作区干净，合并结果以独立提交供本地 main 快进。

## 验证入口

- 后端 `pet-conversation`：真实 Thread/Runtime/SQLite/Blob 与两界面消息、建议、排队和附件恢复。
- Web `history-and-composer`、`initial-prompt-flow`：公开 store、真实输入控制器和传输回调；保留主分支立即提交语义，同时验证单一首轮关联与展示。
- Electron `pet-interaction`、`pet-window` 和 `host-shutdown`：桌宠交互、窗口系统边界及退出管道处理。
- Swift Provider 业务用例、`HandAgentAppTests` 和 `AppCoordinatorTests`：模块存储、正常退出取消及焦点顺序。
- 本轮只做合并自动验证，不重新实机验收，不操作已经恢复的旧实例。原实机结论仍以各分支归档的构建版本和证据为准。

## 结果

- 2026-09-14：完整 `bash ./scripts/test.sh`、Swift test/build 与 Electron build 均成功。日志位于合并 worktree 的 `.cache/issue-4-main-final-{web,swift-test,swift-build,electron-build}.log`；汇总为 `final-web-electron.json` 和 `final-swift.json`（均使用 `issue-4-main-` 前缀）。
- 先红用例确认了旧前端队列阻塞发送、旧投影丢失 pending/建议/请求清理、桌宠调用已移除入口以及 hello 刷新丢失工具声明。合并后 Web 目标 38 项、图片消费 8 项通过；桌宠 18 项在完整检查中通过，包括两界面提交后用独立 SQLite reader 核对持久接收及重启恢复。
- 对照主分支核验核心 Thread/Runtime、附件保存与读取、桌宠布局/缩放/命中和输入组件的生产文件；预期外修改为空。桌宠唯一相关生产适配是 `petThreadController` 的首轮交接；核对范围见 `.cache/issue-4-main-protected-paths.json`。
- 独立文档审核通过、无阻塞：核对 76 份 Markdown 和 313 个本地链接，双方 13 条原始实机归档完整保留。manual QA 已记录本次验证及未做新实机验收的边界，TODO 中已完成的合并流程已移除。
- `git diff --check` 与全仓冲突标记扫描通过。本次以双父合并提交保留双方历史，在主 checkout 快进本地 main；最终提交和分支位置由 Git 记录。
