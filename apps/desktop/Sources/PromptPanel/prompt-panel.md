# PromptPanel 模块

全局热键唤起的命令面板：输入普通 prompt、追加用户主动附件，或通过 `ActionDefinition` 把 prompt action 追加为上方统一 chip row 中的 skill chip。架构是 **View + ViewModel + Controller + Styles** 四件套。

## 文件

| 文件 | 职责 |
|------|------|
| `PromptPanelView.swift` | 纯 UI：统一 chip row、输入框、action 列表、server 不可用提示和设置按钮 |
| `PromptPanelGrowingTextView.swift` | `NSViewRepresentable` 输入控件：封装 `NSTextView + NSScrollView`，支持自动增高、键盘命令转发 |
| `PromptPanelInputCommand.swift` | 输入区 AppKit command selector 到 PromptPanel 意图的纯解析：Return、Shift/Option+Return、Tab、上下键 |
| `PromptPanelInputLayout.swift` | 输入区布局辅助：根据 editable text 是否有可见内容决定文字编辑区域宽度 |
| `PromptPanelViewModel.swift` | `@Observable` 状态：`inputItems` / 唯一 editable `draft` / `attachments` / `chipItems` / `filteredActions` / `selectedActionId`；Tab/点击/快捷键追加 skill item，提交完整 item 数组 |
| `PromptPanelController.swift` | `NSPanel` 生命周期、ESC / showThreadWindow 局部监听、ViewModel 注入、QuickLook 预览和回调出口 |
| `PromptPanelFocusRestorer.swift` | 记录 PromptPanel 唤起前的前台应用，并在面板因失焦或 ESC 收起后恢复应用焦点 |
| `PromptPanelInputFocusRetrier.swift` | 输入框 AppKit 焦点重试器 |
| `PromptPanelWindow.swift` | `NSPanel` 子类，处理失焦自动隐藏 |
| `PromptPanelStyles.swift` | PromptPanel 容器、action row、trigger pill、icon button 样式 |
| `PromptAttachmentResult.swift` | `PromptAttachmentResult` 枚举；描述 PromptPanel 提交时附带的用户主动输入附件 |
| `ActionDefinition.swift` | prompt action manifest 定义：trigger、title、description、template、globalShortcut、icon、校验和 trigger 冲突处理 |
| `ActionManifestStore.swift` | 从 `~/.spotAgent/plugins/*/plugin.json` 读取 prompt action manifests |
| `ActionInvocation.swift` | 把 `ActionDefinition` 转成 `PromptPanelSkillInputItem` |
| `QuickLookPreviewController.swift` | 把 `imageRegion` 的 base64 写入临时文件，并通过 `QLPreviewPanel` 预览 |

## 数据流

```
Coordinator
  └─ 读取 ActionManifestStore → Controller.register(actions:)
                            └─ 创建或刷新 ViewModel(actions:)
                            └─ ViewModel.onSubmit(inputItems, attachments) 回调到 Controller
                                                                       └─ 转发给 Coordinator.send(.submitPrompt)
ActionShortcut → Coordinator.performActionShortcut(ActionDefinition)
              └─ PromptPanelController.selectActionAndShow(action)
                   └─ ViewModel.appendSkill(action) + show()
PromptPanelGrowingTextView command
  ├─ 上/下键 → ViewModel.moveSelectedAction
  ├─ Return → ViewModel.submit
  ├─ Tab → ViewModel.submitSelectedAction（追加 skill chip，不提交）
  └─ Shift/Option + Return → 插入换行
```

输入框模型是数组：

- 数组里始终只有一个 editable text item。
- `PromptPanelChipItem` 是展示层模型，把 `inputItems` 中的 skill 与 `attachments` 中的用户主动附件统一渲染为上方 chip row。
- 用户可以添加多个 skill chip，也可以用 chip 的删除按钮删除对应 skill 或附件；Backspace 只编辑文本，不删除 chip。
- Return 提交完整 `inputItems + attachments`；如果只有 skill chip 没有文本，也可以提交。
- 手写 trigger 或 `[name: value]` 不再有特殊语义，只是普通文本。

提交后由 Coordinator 通过 Electron initial prompt payload 发送 `PromptUserInput.items`。React 收到后创建 thread，并发送首轮 `op.submit(UserInput)`。`thread.start` 不携带 action binding。

## 编辑此目录的约束

- **View 只读 ViewModel**：不要让 View 直接调 `NSEvent` / `NSPanel` / `KeyboardShortcuts.*` API。
- **ViewModel 不持有 SwiftUI 类型**：只暴露 plain Swift 状态与回调。
- **Controller 是窗口管理 + 事件监听层**：不直接写 thread/turn 逻辑，跨模块意图通过 `onSubmit` / `onOpenSettings` 闭包出口给 Coordinator。
- **PromptPanel 可见时也要消费 app-scoped ThreadWindow 快捷键**：`showThreadWindow` 不能只依赖 Coordinator 的 local monitor；当 PromptPanel 作为 `.nonactivatingPanel` 可见时，Controller 自己必须能识别同一份 shortcut 配置，并把意图通过 `onShowThreadWindow` 交回 Coordinator。
- **Action 全局快捷键**：每个 `ActionDefinition` 通过 `shortcutName = "action.<id>"` 获得可配置全局快捷键名；触发后只追加上方 chip row 中的 skill chip 并显示 PromptPanel。
- **动态 action 刷新**：Controller 可多次 `register(actions:)`；首次创建 ViewModel，后续只刷新 ViewModel action 列表。
- **焦点语义**：凡是从 PromptPanel 把控制权切给 Electron ThreadWindow 的路径，都必须避免恢复旧前台应用。提交 prompt 时，Coordinator 必须在发送 `thread_window.open_initial_prompt` 前调用 `hide(restoringFocus: false)`；PromptPanel 仍可见时若触发 `openHistory`，也必须先 `hide(restoringFocus: false)` 再发送 `thread_window.open_history`。
- **首次 handoff 是高频回归点**：上面这条不能退化成“最终调用过 hide 就行”，而必须保证顺序是“先 hide(restoringFocus: false)，再 open/focus ThreadWindow”。这个 bug 已多次出现；以后改 PromptPanel 焦点恢复、失焦自动隐藏或 `showThreadWindow` 快捷键时，必须把它当强制回归项。
- **server 不可用时不丢草稿**：`submissionDisabledMessage != nil` 时输入框禁用并显示提示，`submit()` 直接返回，不清空 `inputItems` / `attachments`。
- **滚动条样式走 Shared**：PromptPanel 输入框内部 `NSScrollView` 与 action 列表 `ScrollView` 都复用 `Sources/Shared/OverlayScrollbar.swift`；不要在 `PromptPanelStyles.swift` 再维护一份局部滚动条实现。`OverlayScrollbar` 需要同时把 `NSScrollView` 和其 `contentView` 设为透明，并按 overlay 所在区域与各 `NSScrollView` 的几何重叠选择目标；对 SwiftUI `HostingScrollView` 还要在首次更新后做一次短延迟重试，覆盖系统 scroller 的后置装配。
- **这次回归的教训**：PromptPanel 这类“输入框滚动区 + 列表滚动区”并存的界面，不能再用“找到第一个 scroll view”或“靠 sibling 顺序猜目标”的方式注入样式。白底既可能来自系统 `NSScroller`，也可能来自 `NSClipView`；只有同时验证“命中的是正确 scroll view、`contentView` 透明、最终 scroller 已替换”三件事，才算真正修好。
- **测试**：`PromptPanelViewModelTests` 覆盖输入 item 数组、统一 chip 展示/删除/预览、skill-only 提交、过滤和附件；`PromptPanelInputCommandTests` 覆盖键盘命令解析；`OverlayScrollbarTests` 覆盖共享 overlay 滚动条的透明背景、palette、`contentView` 透明化和 PromptPanel 多滚动容器下的几何命中；`PromptPanelAppearanceTests` 覆盖真实渲染后的 action 列表 `HostingScrollView` 透明背景与 `OverlayScroller` 注入；`ActionDefinitionTests` / `ActionInvocationTests` / `ActionManifestStoreTests` 覆盖 manifest 与 skill item 构造。

## 与其他模块的关系

- 由 [Coordinator](/Users/mu9/proj/handAgent/apps/desktop/Sources/Coordinator/coordinator.md) 持有并注入 actions。
- 提交 prompt 后由 Coordinator 通过 [ElectronThreadWindowLifecycle](/Users/mu9/proj/handAgent/apps/desktop/Sources/Coordinator/ElectronThreadWindowLifecycle.swift) 发送 `thread_window.open_initial_prompt`。
- [AgentServer](/Users/mu9/proj/handAgent/apps/desktop/Sources/AppServices/AgentServer/agent-server.md) 可用性变化会同步到 `setSubmissionEnabled`。
- 全局热键来自 [AppServices/Hotkey](/Users/mu9/proj/handAgent/apps/desktop/Sources/AppServices/Hotkey/hotkey.md)。
