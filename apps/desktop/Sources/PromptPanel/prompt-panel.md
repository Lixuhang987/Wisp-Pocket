# PromptPanel

PromptPanel 是 [Desktop Experience](/Users/mu9/proj/handAgent/apps/desktop/CONTEXT.md) 的瞬时输入界面。它编辑结构化 UserInput、展示用户主动 Attachment，并把 Append Prompt 追加为 chip。

## 直接文件

- `PromptPanelView.swift`、`PromptPanelStyles.swift`：SwiftUI 展示与主题样式。
- `PromptPanelViewModel.swift`：Input Item、Attachment、Append Prompt 候选和提交状态。
- `PromptPanelController.swift`、`PromptPanelWindow.swift`：NSPanel 生命周期与事件出口。
- `PromptPanelGrowingTextView.swift`、`PromptPanelInputCommand.swift`、`PromptPanelInputLayout.swift`：文本输入、键盘命令和布局。
- `PromptPanelFocusRestorer.swift`、`PromptPanelInputFocusRetrier.swift`：AppKit 焦点边界。
- `PromptAttachmentResult.swift`、`QuickLookPreviewController.swift`：用户主动 Attachment 与图片预览。
- `ActionDefinition.swift`、`ActionManifestStore.swift`、`ActionInvocation.swift`：Append Prompt manifest、候选和 Input Item 转换。

## 输入模型

- Input Item 数组始终只有一个可编辑 text item；Append Prompt 在协议中序列化为 `skill` item。
- chip row 同时展示 Append Prompt 与 Attachment，但两者保留独立身份和删除行为。
- Return 提交完整输入；Shift/Option+Return 插入换行；Tab 只追加当前 Append Prompt。
- 手写 trigger 没有特殊语义。只有选择候选、点击或已注册快捷键才追加 Append Prompt。
- server 不可用时保留草稿、Input Item 和 Attachment，不执行清空。

## 提交与焦点

1. Controller 先以 `hide(restoringFocus: false)` 隐藏 PromptPanel。
2. Swift thread client 创建 Thread 并提交首轮 UserInput。
3. 收到 Thread ID 后，Electron UI Shell 打开或聚焦 ThreadWindow。

这个顺序是强约束：handoff 期间恢复旧前台 App 会导致 ThreadWindow 被带离焦点。打开历史时也要先无恢复地隐藏 PromptPanel。

## 模块边界

- View 只读取 ViewModel；AppKit window/event API 留在 Controller 和专用 adapter。
- ViewModel 只暴露 plain Swift 状态与回调，不持有 SwiftUI 类型或 Thread 生命周期。
- 跨模块意图通过 Coordinator；PromptPanel 不组装 LLM message、不读取 runtime 状态。
- 通用控件和 theme-safe 样式复用 `Sources/Common`；输入、chip、窗口和焦点语义留在本模块。
- 多滚动容器的 overlay scroller 选择必须按几何归属，不能依赖“第一个 scroll view”或 sibling 顺序。

## 验证

- ViewModel/Input Item：`PromptPanelViewModelTests`、`ActionDefinitionTests`、`ActionInvocationTests`。
- 键盘与焦点：`PromptPanelInputCommandTests`、`PromptPanelControllerTests`。
- 主题和滚动容器：`PromptPanelAppearanceTests`、`OverlayScrollbarTests`。
