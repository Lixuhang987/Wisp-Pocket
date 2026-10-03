# desktop

`apps/desktop` 是 [Desktop Experience](/Users/mu9/proj/handAgent/apps/desktop/CONTEXT.md) 的 Swift Host：拥有 macOS 生命周期、PromptPanel、Settings、AgentTrigger、焦点恢复和宿主能力。常驻界面与 agent-server supervision 属于 Electron UI Shell。

## 直接子节点

- [CONTEXT.md](/Users/mu9/proj/handAgent/apps/desktop/CONTEXT.md)：Desktop Experience glossary。
- `HandAgentApp.swift`：Wisp Pocket SwiftUI 入口、常驻 MenuBarExtra 的唯一设置动作与系统 termination 接入。
- [Sources/sources.md](/Users/mu9/proj/handAgent/apps/desktop/Sources/sources.md)：生产源码索引。
- [TestsSwift/tests-swift.md](./TestsSwift/tests-swift.md)：与 `Sources/` 对齐的 Swift 测试。

## 架构红线

- 状态模型使用 Observation：`@Observable`、`@Bindable`、`@State`；非状态依赖标记 `@ObservationIgnored`。不要引入 Combine 状态栈。
- Swift 原生 UI 只保留 PromptPanel 和 Settings。ThreadWindow、桌宠及其 UI 投影属于 Electron/React，权威 Thread 状态属于 core。
- 模块协调统一进入 `AppCoordinator.send(.action)`；窗口生命周期由专用 lifecycle 对象持有。
- 初始上下文只允许用户主动提交的 Input Item；未主动交付的屏幕、窗口、文件、剪贴板和 App 状态通过 Tool 读取。
- Swift 的 `/api/thread` client 创建 PromptPanel / AgentTrigger Thread、提交首轮 `UserInput` 并查询目标 Pet；持续通知和交互式请求由 React 处理。
- Swift 通过 `/api/dynamic-tools` 暴露原生能力与已启用的内置功能，不在宿主层编排 LLM/Tool 循环。

## 所有权

- `AppServices` 是生产依赖组合点；测试使用 `AppServices.testing(...)` 隔离窗口、进程和系统策略。
- Swift 启动 Electron UI Shell，但不直接启动 agent-server。可提交状态同时依赖 agent-server health 与 hidden ThreadWindow prepared。
- 原生 Settings 只写 `~/.spotAgent/native-preferences.json` 外观；模型、Tool、MCP、Permission 和 Pet 管理归后端与 Electron 设置。menu bar 设置通过 command bridge 打开独立 Electron 窗口，PromptPanel 保留原生设置入口；主题由 Swift 解析后同步给全部 Electron/React 窗口。
- Append Prompt manifest 位于 `~/.spotAgent/actions`。Automation 使用独立的 `~/.spotAgent/builtin-features.json` 启用配置，由 [AppServices](./Sources/AppServices/app-services.md) 直接组合。
- Context History 随 Swift Host 常驻采集；Automation 默认关闭，启用后跟随 Swift Host 应用存续，关闭 Settings 或 ThreadWindow 不停止它们。完全退出时取消任务与监听，历史和 Policy 继续保存在业务目录。
- 正常退出先向 AppKit 返回 `terminateLater`，等待 Coordinator 的异步清理完成后再答复一次，确保在途 Automation 的取消结果有机会落盘。重复退出请求共用同一次清理；`applicationWillTerminate` 不能作为异步持久化的等待点。

## 验证

- Swift 行为：`bash ./scripts/swiftw test`、`bash ./scripts/swiftw build`。
- 跨端或 TypeScript 行为：`bash ./scripts/test.sh`。
- 需要真实辅助功能、屏幕录制或窗口行为的项目进入 [manual-qa.md](/Users/mu9/proj/handAgent/docs/manual-qa.md)。
