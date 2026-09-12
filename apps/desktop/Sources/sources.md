# Sources

`apps/desktop/Sources` 存放 macOS 宿主源码模块。这里是 Swift 源码层的索引，具体职责由各子目录自己的文档继续展开。

## 子目录索引

| 子目录 | 子文档 | 职责 |
|------|------|------|
| `AppServices/` | [app-services.md](/Users/mu9/proj/handAgent/apps/desktop/Sources/AppServices/app-services.md) | 跨模块共享服务、ElectronShell 运行时、平台桥、设置和热键 |
| `Common/` | [common.md](/Users/mu9/proj/handAgent/apps/desktop/Sources/Common/common.md) | Swift 原生 UI 的通用组件层，承载 Settings / PromptPanel 可复用的前端组件 |
| `Coordinator/` | [coordinator.md](/Users/mu9/proj/handAgent/apps/desktop/Sources/Coordinator/coordinator.md) | `AppCoordinator` 单向事件流、Settings 生命周期和 Electron command lifecycle 接入 |
| `PromptPanel/` | [prompt-panel.md](/Users/mu9/proj/handAgent/apps/desktop/Sources/PromptPanel/prompt-panel.md) | 全局快捷键唤起的输入面板、用户主动附件采集入口和提交 UI |
| `Shared/` | 无 | 跨 PromptPanel 与 Settings 复用的原生 UI 辅助实现，如通用 overlay 滚动条 |
| `Settings/` | [settings.md](/Users/mu9/proj/handAgent/apps/desktop/Sources/Settings/settings.md) | 原生设置窗口 UI 与各设置页 ViewModel |
| `Theme/` | [theme.md](/Users/mu9/proj/handAgent/apps/desktop/Sources/Theme/theme.md) | SwiftUI 原生界面 theme token 与样式约束 |

## 边界

- Swift 宿主负责 PromptPanel、Settings、Hotkey、焦点恢复、Swift <-> Electron command bridge、窄口径 `/api/thread` 直连提交，以及 `/api/dynamic-tools` 原生与内置功能接入。
- Swift 原生 UI 需要常用前端组件时，优先查看 `Common/`，通过 Common 组件或模块薄包装复用；不要重复造轮子，也不要在 Settings / PromptPanel 重新实现 Common 已覆盖的基础组件。
- ThreadWindow 与 StatusBubble 由 `apps/electron-shell` 承载；Swift 不创建 `WKWebView` host，不显示 Swift StatusBubble。
- Swift 只持有 PromptPanel 和 AgentTrigger 首轮提交用的窄口径 thread client；只等待 `thread.started` / `thread.error`，不处理持续 `ThreadNotification` / `ServerRequest`，也不订阅 `/api/activity`。
