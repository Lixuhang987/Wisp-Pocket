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


- [ ] 移动与位置恢复：拖动角色换位置，松手后可再次点击；重启 App 恢复位置，关闭 ThreadWindow 后桌宠仍可继续交互。

### Issue #1 移动与位置恢复

- **验证日期**：2026-09-13。
- **验证环境**：macOS 15.5 / arm64、1440×932 单屏；指定 `codex/issue-1-pet-main-20260913` worktree 的默认打包产物，源码及通过的 TypeScript/Web、Swift test/build 基线与本次启动验收一致。位置使用 `/tmp/issue1-live-qa-20260913-1030/pet-position-fresh-1230.json`。
- **验证过程**：用系统原生鼠标事件从角色内部 `(1324,830)` 拖到 `(1040,570)`；窗口由 `(1224,700)` 变为 `(940,440)`，位置文件写入 `{right:1132,bottom:648}`。松手后 Computer Use 点击角色，当前 Thread 历史与回复框正常出现。通过 PromptPanel 和本机已配置的历史快捷键打开 ThreadWindow，关闭后再次点击桌宠仍能恢复同一 Thread。展开历史触发边缘避让后收起，退出前最终窗口为 `(940,466,192,208)`、锚点为 `{right:1132,bottom:674}`；系统退出并重新启动后两者精确一致，角色可见。
- **证据**：本轮证据根目录 `/tmp/issue1-live-qa-20260913-1030/` 中的 `evidence/windows-before-drag.txt`、`windows-after-native-drag.txt`、`windows-position-before-restart.txt`、`windows-position-after-restart.txt`、`position-before-restart.json`，以及 `logs/desktop-restart.log`、`desktop-position-restored.log`；Computer Use 的角色、历史和回复框窗口树。
- **结论**：通过。验证覆盖原生拖动、松手后点击、关闭完整窗口后的桌宠交互与重启恢复。
- **工具边界**：Computer Use 的 drag 不移动系统光标；12 秒原生光标采样保持同一点，位置文件也不变。按用户指定的系统 `osascript` 路径发送原生输入后拖动正常，此差异不记为产品缺陷。
- **清理状态**：上一实例及其后端已正常退出；恢复位置的新实例继续用于后续 QA，未修改用户默认位置文件。


- [ ] 文本两区域拖入：从文本编辑器拖出选中文字，松手角色创建 Thread；再次松手气泡或历史追加同一 Thread，输入内容完整保留。

### Issue #1 文本两区域拖入

- **验证日期**：2026-09-13。
- **验证环境**：macOS 15.5 / arm64、1440×932 单屏；用户指定分支的默认打包产物与真实 agent-server，TypeScript/Web、Swift test/build 基线均已通过。源应用为 TextEdit 的本轮临时文稿“未命名2”。
- **验证过程**：用 Computer Use 写入并核对中文选区，以系统原生拖放从 TextEdit 拖至角色。第一段 `QA-ISSUE1-TEXT-A` 创建新 Thread，桌宠历史显示全文。将源文稿改为 `QA-ISSUE1-TEXT-B` 并全选，最终松手在气泡的稳定接收区域，桌宠同一历史新增完整补充文本，随后进入处理状态。
- **证据**：`/tmp/issue1-live-qa-20260913-1030/evidence/text-two-targets.json` 显示相关 Thread 只有 `thread-3714ddbb-e575-47e8-87b0-6a60602e1733`；序列 1 和 8 的两条 user response_item 均含完整中文、对应 text Input Item 和 `inputMode: inspect`。`textedit-windows.txt`、`native-text-drop-a.log`、`native-text-drop-b-final.log`、`windows-text-b-target.txt` 记录源窗口及最终区域；Computer Use 已观察原文选区和包含 A、B 的桌宠历史。
- **结论**：本分项通过；角色新建、气泡追加和输入留存均有真实 UI 与 SQLite 证据。模型服务仍返回空流或 `unexpected EOF`，本结论不涵盖内容理解、建议或后续执行。
- **清理状态**：两个 QA Thread 及 TextEdit 临时文稿继续保留供本轮后续测试，未改用户原有文稿、模型设置或默认桌宠位置。


- [ ] 图片两区域拖入：从 Finder 或图片应用拖入样本，分别松手角色与气泡/历史，确认新建/追加分流及实际图片内容进入读取，历史显示图片。

### 图片两区域拖入

- **验证日期**：2026-09-13（Asia/Shanghai）。
- **验证环境**：用户指定 `codex/issue-1-pet-main-20260913` worktree，源码 `0194a22` 加开始时已有的 8 个未提交文件；macOS 单屏 1440×932，默认 `dist/Wisp Pocket.app`；本轮 TypeScript/Web、Swift test/build 与打包均通过。使用真实 provider/model，临时将同一 provider 的 `llm.api` 从 `responses` 改为已验证可用的 `chat`，结束时恢复。
- **验证过程**：从 Finder 将 `qa-image.png` 原生拖入角色，创建 `thread-dde5d3fb-ca39-43e4-a3b6-42ac787c3a31`；再将不同内容的 `qa-image-b.png` 原生拖入气泡，追加到同一 Thread。每次以最新 Finder 窗口原点与桌宠位置换算坐标，使用系统 `osascript`/CoreGraphics 发送拖放，Computer Use 观察拖放后的真实 UI。
- **可见结果**：历史显示两张图片及文件名。真实模型从第一张图读出“社区花园种植工作坊、9 月 23 日 14:00、手套和笔记本”，从第二张图读出“社区图书馆图书交换、10 月 5 日 10:30、两本小说”，并给出相关建议；这些独有内容均未出现在文件名中。
- **持久化证据**：SQLite 同一 Thread 的 sequence 1、10 分别保存 A/B 两条 `role:user`、`inputMode:inspect` 输入，各有不同 image Input Item 和 Blob 引用；sequence 7、16 保存对应 assistant 内容与建议。总 Thread 数为 86，图片 A 前为 85，追加 B 未再创建 Thread。
- **证据位置**：`/tmp/issue1-live-qa-20260913-1030/evidence/image-two-targets.json`、`native-image-drop-b.json`、`image-b-after-drop.png`、`image-history-bottom.png`；第一张图片的原生拖放证据为 `native-image-drop-a-final.log`。
- **结论**：通过，角色新建、气泡追加、图片历史展示及真实内容读取均有系统证据。
- **清理状态**：应用和后端继续运行以验证后续分项；可丢弃图片及本轮测试 Thread 暂保留作证据；临时模型字段将在本轮结束时恢复。
