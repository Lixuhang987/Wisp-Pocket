# PromptPanel 模块

全局热键唤起的命令面板：输入普通 prompt、追加用户主动附件，或通过 `ActionDefinition` 把 prompt action 追加为输入框内的 skill chip。架构是 **View + ViewModel + Controller + Styles** 四件套。

## 文件

| 文件 | 职责 |
|------|------|
| `PromptPanelView.swift` | 纯 UI：输入框、内嵌 skill chip、action 列表、附件 chip、server 不可用提示和设置按钮 |
| `PromptPanelGrowingTextView.swift` | `NSViewRepresentable` 输入控件：封装 `NSTextView + NSScrollView`，支持自动增高、键盘命令转发和文本起点 Backspace 删除前一个 chip |
| `PromptPanelInputCommand.swift` | 输入区 AppKit command selector 到 PromptPanel 意图的纯解析：Return、Shift/Option+Return、Tab、上下键、Backspace |
| `PromptPanelInputLayout.swift` | 输入区布局辅助：根据 editable text 是否有可见内容决定文字编辑区域宽度 |
| `PromptPanelViewModel.swift` | `@Observable` 状态：`inputItems` / 唯一 editable `draft` / `attachments` / `filteredActions` / `selectedActionId`；Tab/点击/快捷键追加 skill item，提交完整 item 数组 |
| `PromptPanelController.swift` | `NSPanel` 生命周期、ESC 局部监听、ViewModel 注入、QuickLook 预览和回调出口 |
| `PromptPanelFocusRestorer.swift` | 记录 PromptPanel 唤起前的前台应用，并在面板因失焦或 ESC 收起后恢复应用焦点 |
| `PromptPanelInputFocusRetrier.swift` | 输入框 AppKit 焦点重试器 |
| `PromptPanelWindow.swift` | `NSPanel` 子类，处理失焦自动隐藏 |
| `PromptPanelStyles.swift` | PromptPanel 容器、action row、trigger pill、icon button 和滚动条样式 |
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
  ├─ Shift/Option + Return → 插入换行
  └─ Backspace at text start → ViewModel.deleteChipBeforeText
```

输入框模型是数组：

- 数组里始终只有一个 editable text item。
- skill chip 永远排在 editable text 前面。
- 用户可以添加多个 skill chip，也可以用 chip 删除按钮或文本起点 Backspace 删除前一个 chip。
- Return 提交完整 `inputItems + attachments`；如果只有 skill chip 没有文本，也可以提交。
- 手写 trigger 或 `[name: value]` 不再有特殊语义，只是普通文本。

提交后由 Coordinator 通过 Electron initial prompt payload 发送 `PromptUserInput.items`。React 收到后创建 thread，并发送首轮 `op.submit(UserInput)`。`thread.start` 不携带 action binding。

## 编辑此目录的约束

- **View 只读 ViewModel**：不要让 View 直接调 `NSEvent` / `NSPanel` / `KeyboardShortcuts.*` API。
- **ViewModel 不持有 SwiftUI 类型**：只暴露 plain Swift 状态与回调。
- **Controller 是窗口管理 + 事件监听层**：不直接写 thread/turn 逻辑，跨模块意图通过 `onSubmit` / `onOpenSettings` 闭包出口给 Coordinator。
- **Action 全局快捷键**：每个 `ActionDefinition` 通过 `shortcutName = "action.<id>"` 获得可配置全局快捷键名；触发后只追加 skill chip 并显示 PromptPanel。
- **动态 action 刷新**：Controller 可多次 `register(actions:)`；首次创建 ViewModel，后续只刷新 ViewModel action 列表。
- **焦点语义**：提交 prompt 时是 Electron ThreadWindow handoff，Coordinator 必须在发送 `thread_window.open_initial_prompt` 前调用 `hide(restoringFocus: false)`。
- **server 不可用时不丢草稿**：`submissionDisabledMessage != nil` 时输入框禁用并显示提示，`submit()` 直接返回，不清空 `inputItems` / `attachments`。
- **测试**：`PromptPanelViewModelTests` 覆盖输入 item 数组、skill chip 追加/删除、skill-only 提交、过滤和附件；`PromptPanelInputCommandTests` 覆盖键盘命令解析；`ActionDefinitionTests` / `ActionInvocationTests` / `ActionManifestStoreTests` 覆盖 manifest 与 skill item 构造。

## 与其他模块的关系

- 由 [Coordinator](/Users/mu9/proj/handAgent/apps/desktop/Sources/Coordinator/coordinator.md) 持有并注入 actions。
- 提交 prompt 后由 Coordinator 通过 [ElectronThreadWindowLifecycle](/Users/mu9/proj/handAgent/apps/desktop/Sources/Coordinator/ElectronThreadWindowLifecycle.swift) 发送 `thread_window.open_initial_prompt`。
- [AgentServer](/Users/mu9/proj/handAgent/apps/desktop/Sources/AppServices/AgentServer/agent-server.md) 可用性变化会同步到 `setSubmissionEnabled`。
- 全局热键来自 [AppServices/Hotkey](/Users/mu9/proj/handAgent/apps/desktop/Sources/AppServices/Hotkey/hotkey.md)。
