# Common 模块

Swift 原生 UI 的通用组件层。这里放 Settings 与 PromptPanel 都可能复用、且已经在产品中反复出现的基础前端组件；它不是完整 design system，也不替代 SwiftUI。

## 文件

| 文件 | 职责 |
|------|------|
| `CommonComponents.swift` | 通用 page、section、row、divider、input、text editor、action button、icon button、form actions、empty state、error footer、segmented control |
| `common.md` | 本文件，说明 Common 的组件边界和使用优先级 |

## 组件边界

属于 Common：

- 页级滚动容器、section、label/control 行、行分隔线、section 分隔线。
- 常规文本输入、安全输入、文本编辑器；placeholder 必须由 Common 控制真实渲染颜色，不能只依赖 macOS 原生 prompt 着色。
- 普通/主要/危险动作按钮、图标按钮、表单底部动作区。
- 空状态、错误提示、segmented control。

不属于 Common：

- Settings 的 Tab 枚举、Tab Bar、具体设置项数据写入。
- PromptPanel 的 growing text view、chip 行、action 搜索/选择交互、窗口布局和焦点恢复。
- Theme token 来源；颜色、字体、间距、圆角仍来自 [Theme/theme.md](/Users/mu9/proj/handAgent/apps/desktop/Sources/Theme/theme.md) 的 `AppTheme`。
- 只在单个页面出现且没有复用价值的局部排版。

## 使用约束

- Swift 原生 UI 新增常用前端组件时，先查 Common，再决定是否需要模块薄包装。不要在 Settings 或 PromptPanel 重复造轮子。
- Settings 可以通过 `SettingsStyles.swift` 暴露同名薄包装或 typealias，但绘制逻辑应留在 Common。
- PromptPanel 可以复用 Common 的基础控件；如果复用会磨平 PromptPanel 专用 hover、输入或窗口语义，应保留 PromptPanel 局部实现并在文档说明边界。
- Common 组件只负责 UI 呈现，不持有 store、ViewModel 或配置写入逻辑。
