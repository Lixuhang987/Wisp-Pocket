# 屏幕捕获边界

HandAgent 有两类屏幕输入，必须保持不同的用户授权语义。

## 当前能力

- PromptPanel 的区域截图是用户主动 Attachment，使用系统 `screencapture -i` 完成圈选；取消不会生成输入。
- `host_macos.screen_capture` 是模型按需调用的 Dynamic Tool，由 Swift Host 的 `MacPlatformProvider` 使用 ScreenCaptureKit / `SCScreenshotManager` 执行。
- Atomic Screenshot Plugin 同样基于 ScreenCaptureKit，向 Host Automation 提供截图与缩略图能力。

## 尚未实现

- `SCStream` 持续捕获。
- `SCContentSharingPicker` 系统目标选择器。
- 系统音频、麦克风、录制与 HDR 工作流。

这些能力属于新产品行为，需要单独 spec；不要从当前使用 `SCScreenshotManager` 推断它们已经可用。

## 所有权

- 用户 Attachment：[SelectionCapture](/Users/mu9/proj/handAgent/apps/desktop/Sources/AppServices/SelectionCapture/selection-capture.md)
- Swift Dynamic Tool：[PlatformBridge](/Users/mu9/proj/handAgent/apps/desktop/Sources/AppServices/PlatformBridge/platform-bridge.md)
- Atomic Screenshot Plugin：[builtin-plugins](/Users/mu9/proj/handAgent/apps/builtin-plugins/builtin-plugins.md)

## 官方资料

- [ScreenCaptureKit](https://developer.apple.com/documentation/screencapturekit)
- [SCScreenshotManager](https://developer.apple.com/documentation/screencapturekit/scscreenshotmanager)
- [SCContentSharingPicker](https://developer.apple.com/documentation/screencapturekit/sccontentsharingpicker)
