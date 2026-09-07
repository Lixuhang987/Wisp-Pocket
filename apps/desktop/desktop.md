# desktop

`apps/desktop` 是 [Desktop Experience](/Users/mu9/proj/handAgent/apps/desktop/CONTEXT.md) 的 Swift Host：拥有 macOS 生命周期、PromptPanel、Settings、AgentTrigger、焦点恢复和宿主能力。常驻界面与 agent-server supervision 属于 Electron UI Shell。

## 直接子节点

- [CONTEXT.md](/Users/mu9/proj/handAgent/apps/desktop/CONTEXT.md)：Desktop Experience glossary。
- `HandAgentApp.swift`：Wisp Pocket SwiftUI 入口与系统 termination 接入。
- [Sources/sources.md](/Users/mu9/proj/handAgent/apps/desktop/Sources/sources.md)：生产源码索引。
- `TestsSwift/`：与 `Sources/` 对齐的 Swift 测试。

## 架构红线

- 状态模型使用 Observation：`@Observable`、`@Bindable`、`@State`；非状态依赖标记 `@ObservationIgnored`。不要引入 Combine 状态栈。
- Swift 原生 UI 只保留 PromptPanel 和 Settings。ThreadWindow、StatusBubble 与完整 Thread 状态属于 Electron/React。
- 模块协调统一进入 `AppCoordinator.send(.action)`；窗口生命周期由专用 lifecycle 对象持有。
- 初始上下文只允许用户主动提交的 Input Item。屏幕、窗口、文件、剪贴板和 App 状态通过 Tool 读取。
- Swift 的 `/api/thread` client 只创建 PromptPanel / AgentTrigger Thread 并提交首轮 `UserInput`；持续通知和交互式请求由 React 处理。
- Swift 通过 `/api/dynamic-tools` 暴露原生与 Plugin Dynamic Tool，不在宿主层编排 LLM/Tool 循环。

## 所有权

- `AppServices` 是生产依赖组合点；测试使用 `AppServices.testing(...)` 隔离窗口、进程和系统策略。
- Swift 启动 Electron UI Shell，但不直接启动 agent-server。可提交状态同时依赖 agent-server health 与 hidden ThreadWindow prepared。
- `~/.spotAgent/settings.json` 的模型、Tool 和主题偏好由 Settings 写入；主题由 Swift 解析后同步给 Electron/React。
- Append Prompt manifest 位于 `~/.spotAgent/actions`；Plugin manifest 位于 `~/.spotAgent/plugins`。二者是不同能力。

## 验证

- Swift 行为：`bash ./scripts/swiftw test`、`bash ./scripts/swiftw build`。
- 跨端或 TypeScript 行为：`bash ./scripts/test.sh`。
- 需要真实辅助功能、屏幕录制或窗口行为的项目进入 [manual-qa.md](/Users/mu9/proj/handAgent/docs/manual-qa.md)。
