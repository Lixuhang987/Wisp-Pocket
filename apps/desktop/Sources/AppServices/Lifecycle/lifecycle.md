# Lifecycle 模块

应用激活策略协调。

## 文件

| 文件 | 职责 |
|------|------|
| `AppActivationPolicyCoordinator.swift` | 根据 SettingsWindow 状态切换 `NSApp.activationPolicy` |

## 行为

- 有 SettingsWindow 打开 → `.regular`（Swift 宿主出现在 Dock 与 Cmd+Tab）。
- SettingsWindow 关闭 → `.accessory`（Swift 宿主回到后台；Electron ThreadWindow 使用 Electron app 自己的 Dock / app switcher 入口）。

## 设计备注

- Settings 窗口走 `policyAfterUpdatingSettingsWindow(isOpen:)`。
- PromptPanel 从后台唤起时可以由 `PromptPanelController` 临时提升宿主，隐藏后 Coordinator 会重新应用当前 Settings 派生策略。

## 编辑此目录的约束

- 策略派生是纯逻辑，不调 `NSApp`；切换由 [Coordinator](/Users/mu9/proj/handAgent/apps/desktop/Sources/Coordinator/coordinator.md) 中的 `setActivationPolicy` 闭包完成（测试可注入 mock）。
- 不要在此处依赖 SwiftUI / AppKit。
- 测试：[AppActivationPolicyCoordinatorTests](/Users/mu9/proj/handAgent/apps/desktop/TestsSwift/AppServices/Lifecycle/AppActivationPolicyCoordinatorTests.swift)。

## 与其他模块的关系

- 由 [Coordinator](/Users/mu9/proj/handAgent/apps/desktop/Sources/Coordinator/coordinator.md) 创建；设置窗口开关通过 `SettingsLifecycle.openOrFocus / handleClosed` 更新，PromptPanel 隐藏时读取当前策略进行回落。
