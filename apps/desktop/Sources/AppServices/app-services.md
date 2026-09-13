# AppServices

`AppServices/` 保存 Swift Host 的系统服务和跨进程 adapter。它们由 Coordinator 注入，不拥有产品 UI。

## 直接子节点

- [AgentServer/agent-server.md](/Users/mu9/proj/handAgent/apps/desktop/Sources/AppServices/AgentServer/agent-server.md)：agent-server health 与 Swift 窄口径 thread client。
- [ElectronShell/electron-shell.md](/Users/mu9/proj/handAgent/apps/desktop/Sources/AppServices/ElectronShell/electron-shell.md)：Swift 到 Electron UI Shell 的进程桥。
- [PlatformBridge/platform-bridge.md](./PlatformBridge/platform-bridge.md)：共享 macOS 能力、内置功能组合与 Dynamic Tool Provider。
- [AgentTrigger/agent-trigger.md](/Users/mu9/proj/handAgent/apps/desktop/Sources/AppServices/AgentTrigger/agent-trigger.md)：AgentTrigger Package、Instance、Provider 和 runtime。
- [AgentSettings/agent-settings.md](/Users/mu9/proj/handAgent/apps/desktop/Sources/AppServices/AgentSettings/agent-settings.md)：Settings 持久化。
- [Appearance/appearance.md](/Users/mu9/proj/handAgent/apps/desktop/Sources/AppServices/Appearance/appearance.md)：主题偏好解析和变化观察。
- [Hotkey/hotkey.md](/Users/mu9/proj/handAgent/apps/desktop/Sources/AppServices/Hotkey/hotkey.md)：全局快捷键名称与注册。
- [Lifecycle/lifecycle.md](/Users/mu9/proj/handAgent/apps/desktop/Sources/AppServices/Lifecycle/lifecycle.md)：宿主 activation policy。
- [SelectionCapture/selection-capture.md](/Users/mu9/proj/handAgent/apps/desktop/Sources/AppServices/SelectionCapture/selection-capture.md)：用户主动文本/区域 Attachment。

## 组合边界

- `AppServices.defaultRuntime` 是生产组合点；`AppServices.testing` 提供窗口和进程替身，AgentTrigger 的 Store 与 Provider home 仍须分别隔离，见 [测试边界](../../TestsSwift/AppServices/app-services.md)。
- 启动支持文件必须在 AgentTrigger reload 前准备，确保内置 Package 和 Native Messaging manifest 可见。
- Electron UI Shell health、ThreadWindow command、桌宠显示、Swift thread client 与 Dynamic Tool Provider 使用同一组显式服务，不通过全局单例互找。
- `defaultRuntime` 创建同一个 `MacPlatformProvider`，供原生 Dynamic Tool、Context History 与 Automation 直接共享。两个业务模块来自 [Host Automation](../../../host-automation/host-automation.md)，`BuiltinFeatures` 持有它们与明确的启用配置。
- Coordinator 启动和停止内置模块；窗口与 agent-server 连接的变化不控制采集。设置成功写入后立即切换模块并更新 Provider 声明。
- 内置功能配置及业务存储默认使用用户 home；`HANDAGENT_HOST_DATA_HOME` 可将这三项重定向到独立 home，用于隔离实机数据。它不重定向模型、Thread、AgentTrigger 或其他设置，边界见 [开发说明](../../../../docs/dev.md)。
- 程序化 `terminateApplication` 必须通过主 run loop 的延迟 selector 调用 AppKit，让当前 Task / 主队列回调先返回；仅切到 MainActor 不足以避免 `terminateLater` 嵌套等待阻塞异步清理。正常退出仍等待 Automation 取消落盘，回执与去重合约见 [应用入口](../../desktop.md)。
- Shutdown 必须清理进程、socket、observer 和 callback，避免旧服务事件进入下一次启动。
