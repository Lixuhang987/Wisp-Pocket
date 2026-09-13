# 屏幕捕获边界

Wisp Pocket 区分用户主动 Attachment、Agent 按需 Tool 与用户启用后的后台采样，三者不能混为自动填入 UserInput 的屏幕上下文。

## 当前能力

- PromptPanel 的区域截图是用户主动 Attachment，使用系统 `screencapture -i` 完成圈选；取消不会生成输入。
- `host_macos.screen_capture` 是模型按需调用的 Dynamic Tool，由 Swift Host 的 `MacPlatformProvider` 使用 ScreenCaptureKit / `SCScreenshotManager` 执行。
- Context History 周期截图与 Automation 证据直接共享同一个 `MacPlatformProvider` 的 ScreenCaptureKit 实现。业务查询返回存储图片及关联元数据；采样与录制不能据此声称连续录屏或逐事件截图。

## 尚未实现

- `SCStream` 持续捕获。
- `SCContentSharingPicker` 系统目标选择器。
- 系统音频、麦克风、连续视频录屏与 HDR 工作流。

这些能力属于新产品行为，需要单独 spec；不要从当前使用 `SCScreenshotManager` 推断它们已经可用。

## 所有权

- 用户 Attachment：[SelectionCapture](/Users/mu9/proj/handAgent/apps/desktop/Sources/AppServices/SelectionCapture/selection-capture.md)
- Swift Dynamic Tool：[PlatformBridge](/Users/mu9/proj/handAgent/apps/desktop/Sources/AppServices/PlatformBridge/platform-bridge.md)
- 内置业务证据：[Host Automation](../../apps/host-automation/host-automation.md)

## 官方资料

- [ScreenCaptureKit](https://developer.apple.com/documentation/screencapturekit)
- [SCScreenshotManager](https://developer.apple.com/documentation/screencapturekit/scscreenshotmanager)
- [SCContentSharingPicker](https://developer.apple.com/documentation/screencapturekit/sccontentsharingpicker)
