# ThreadWindow 后台创建与主动选择隔离

## 用例与范围

用户已授权全功能实机 QA 与缺陷修复。修复前 `main / 52bc459` 包在 macOS 15.5 arm64 连续两次复现：窗口正在显示 A 和草稿，独立客户端仅创建空白 B，窗口便切换到 B。返回 A 后草稿恢复，问题是选择被抢而非持久化丢失。证据见主 checkout `.cache/live-qa-20260914/background-selection-repro.json`，第二轮报 `QA_SELECTION_FAILED`。

修复边界是 ThreadWindow 的选择意图，不改变后端广播、输入队列、桌宠按创建时间选择最新 Thread、窗口焦点恢复或历史持久化。Issue #3 原实施明确保留的问题由本任务独立处理；实现后已移出 bugs，待验收项见 [manual-qa](../../manual-qa.md#threadwindow-后台创建与主动选择隔离)。

## 调用链与数据合约

- 后台：独立客户端 `thread.start` → 后端创建并广播 `thread.started` → Web socket / 输入控制器 → store 投影；只更新列表，不改变 `App.activeThreadId`。
- 本窗口新建：记录本地创建 commandId → 发送 start → 对应 started 更新 store → 一次性消费选择意图并选中目标。外部 commandId、缺失 commandId 或重复回执不取得选择权；对应创建错误清理该意图。
- fallback 首轮：preload initial prompt → 本地登记选择意图 → 既有输入控制器登记 payload → start → store / UI → resume → submit。保持首轮关联和既有调用顺序，不复制 payload 或另建输入队列。
- Swift 主动提交：Swift Thread client 创建并提交首轮 → 既有 `thread_window.focus(threadId)` → Electron runtime → prewarmer → 窄口径 renderer 打开请求 → App 确保缓存、选中、resume → snapshot。目标 ID 不能在 Electron 中被忽略。
- 普通历史入口和无 threadId 的 focus 仍只打开或聚焦窗口；点击历史仍由 App 选择并 resume。选择状态不进入 store 或 Swift。

复用 `FocusThreadWindowCommand.threadId?: string | null`，不新增 Swift command 或改变字段。Electron 增加接收 string Thread ID 的窗口打开方法；renderer 使用与 initial prompt 相同风格的临时 receiver / 待交付请求，覆盖 React effect 尚未安装的时序。preload 不暴露 Node、IPC 或文件系统。

App 只保存待确认的选择 commandId 集合，不保存另一份首轮输入。成功和失败均清理对应 ID，组件销毁清理剩余意图；本轮不重新设计多个本窗口并发创建的到达顺序。

## 诊断检查点

1. 已验证：真实后台创建与第二观察连接收到同一 started，UI 两次切换；不依赖 Swift 或 Electron 打开命令。
2. 修复前已验证：store 文档和现有测试明确不拥有 active Thread；App 的通知回调无条件调用选择 setter。
3. 修复前已验证：Swift 合约已有目标 ID，Electron parser 保留它，但 runtime 的 focus 分支只调用无参 focus / openHistory。
4. 已完成测试先行：实际挂载 React App，验证外部通知更新列表时 A 的正文、草稿、选中行和后续提交目标保持一致；旧实现出现确定失败。
5. 已完成跨宿主自动验证：真实 command parser / runtime / prewarmer 在 Electron 系统边界替身上交付目标 ID，Web 用例再验证选择与 resume；原生 show/focus 的最终表现仍需打包 QA。

## 集成测试先行

- Web `tests/use-cases/thread-selection.test.tsx`：JSDOM 挂载真实 App、store、输入控制器和 socket，仅替换 WebSocket、布局与原生 preload 边界；沿用 Electron 的 Testing Library / JSDOM 版本。
- 覆盖 A 的文字和结构化草稿、后台新增后继续提交 A、无当前选择时后台仅入列表、本地空白创建、交错外部回执、fallback 首轮、重复或错误回执及明确打开已存在 Thread。
- Electron `tests/use-cases/thread-window-commands.test.ts`：用真实 parser、runtime、prewarmer 验证可见、隐藏和重建窗口都交付 `focus(threadId)`，在注入失败时回报失败；无目标的 focus 行为保留。
- preload 与 Web native boundary 测试：React 安装前的打开请求可交付，已有 receiver 不被覆盖，卸载清理，不产生新的 Thread 或首轮提交。
- 无需测试旧错误行为“仍能工作”；所有新增断言均对应受支持的正向选择或交付用例。

## 执行 TODO

- [x] 记录当前包的重复实机复现并提交，退出本轮 App / 后端。
- [x] 从主 checkout 创建独立 worktree，确认 CodeGraph projectPath 为该绝对路径。
- [x] 完成 TypeScript/Web 与 Swift build 基线，阅读所有涉及目录指南及父链到 `handAgent.md`。
- [x] 先添加真实入口集成测试，记录旧实现的确定失败信号。
- [x] 实现最小选择意图过滤和既有目标 ID 交付，复跑回归测试。
- [x] 执行 TypeScript/Web、隔离 home Swift test、Swift build 及 Electron build，更新 owning 文档与 manual QA。
- [x] 分发不继承上下文的独立文档审核，确认计划、代码、目录指南、链接与 QA 一致。
- [x] 主 agent 复核审核结论并提交为 `229d728`。
- [x] 带回 main，重新完成三项检查、正式模式打包、签名和包内 Web/Electron 文件一致性检查。
- [ ] 从 Computer Use 重跑后台复现和 PromptPanel / 历史 handoff；逐项归档提交。

## 自动化结果（2026-09-14）

- 旧实现下新增 Web App 10 项、native 边界 2 项均失败，实际信号为 A 失去 `aria-current`、草稿展示变空或原生目标未交付；Electron 目标交付/失败与 preload 共 6 项出现预期失败。
- 实现后 Web 定向两文件共 24 项通过，Electron 全套 114 项通过。最终 `bash ./scripts/test.sh`、隔离 home 的 `bash ./scripts/swiftw test`、`bash ./scripts/swiftw build` 和 `pnpm --filter handagent-electron-shell build` 均 exit 0；Swift 和后端生产代码未改动。
- 检查日志位于本 worktree `.cache/thread-selection-web-tests.log`、`thread-selection-swift-tests.log`、`thread-selection-swift-build.log`、`thread-selection-electron-build.log`；前三项仅保留 `success` 状态，不能当作逐项实机证据。
- main 的复验与打包记录位于主 checkout `.cache/live-qa-20260914/selection-fixed-*.log`；正式包仍使用既有真实模型设置，未启用 mock。打包通过不代表本节原生回归已通过。
- 独立文档审核已覆盖计划、全部代码与测试变更、目录父链及跨端合约；17 个变更 Markdown 的 96 个本地链接、7 个锚点和冲突检查通过。Chrome P1 保留原文，manual QA 新增四项均待打包实机，未改归档。

## 验证边界

JSDOM 不证明原生窗口焦点、辅助功能或真实后端；Electron 系统替身不证明 macOS 打包环境。最终必须在主 checkout 当前包中确认 A 不被后台抢走，主动 PromptPanel 提交仍打开正确 Thread，手动历史切换与原草稿保留，且桌宠继续选择最新 Thread。
