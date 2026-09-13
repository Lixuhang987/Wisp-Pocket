# AppServices

`AppServices/` 保存 Swift Host 的系统服务和跨进程 adapter。它们由 Coordinator 注入，不拥有产品 UI。

## 直接子节点

- [AgentServer/agent-server.md](/Users/mu9/proj/handAgent/apps/desktop/Sources/AppServices/AgentServer/agent-server.md)：agent-server health 与 Swift 窄口径 thread client。
- [ElectronShell/electron-shell.md](/Users/mu9/proj/handAgent/apps/desktop/Sources/AppServices/ElectronShell/electron-shell.md)：Swift 到 Electron UI Shell 的进程桥。
- [PlatformBridge/platform-bridge.md](/Users/mu9/proj/handAgent/apps/desktop/Sources/AppServices/PlatformBridge/platform-bridge.md)：原生与 Plugin Dynamic Tool Provider。
- [AgentTrigger/agent-trigger.md](/Users/mu9/proj/handAgent/apps/desktop/Sources/AppServices/AgentTrigger/agent-trigger.md)：AgentTrigger Package、Instance、Provider 和 runtime。
- [AgentSettings/agent-settings.md](/Users/mu9/proj/handAgent/apps/desktop/Sources/AppServices/AgentSettings/agent-settings.md)：Settings 持久化。
- [Appearance/appearance.md](/Users/mu9/proj/handAgent/apps/desktop/Sources/AppServices/Appearance/appearance.md)：主题偏好解析和变化观察。
- [Hotkey/hotkey.md](/Users/mu9/proj/handAgent/apps/desktop/Sources/AppServices/Hotkey/hotkey.md)：全局快捷键名称与注册。
- [Lifecycle/lifecycle.md](/Users/mu9/proj/handAgent/apps/desktop/Sources/AppServices/Lifecycle/lifecycle.md)：宿主 activation policy。
- [SelectionCapture/selection-capture.md](/Users/mu9/proj/handAgent/apps/desktop/Sources/AppServices/SelectionCapture/selection-capture.md)：用户主动文本/区域 Attachment。

## 组合边界

- `AppServices.defaultRuntime` 是生产组合点；`AppServices.testing` 提供无窗口、无进程副作用的替身。
- 启动支持文件必须在 AgentTrigger reload 前准备，确保内置 Package 和 Native Messaging manifest 可见。
- Electron UI Shell health、ThreadWindow command、桌宠显示、Swift thread client 与 Dynamic Tool Provider 使用同一组显式服务，不通过全局单例互找。
- enabled Plugin 的安装、生命周期和 Tool 列表属于 Swift Host；agent-server 只看到 Provider 暴露的 spec。
- Shutdown 必须清理进程、socket、observer 和 callback，避免旧服务事件进入下一次启动。
