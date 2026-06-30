# handAgent 设计系统

`DESIGN.md` 只记录跨界面设计原则和使用边界。可执行 token 的源头是 [design/tokens.json](/Users/mu9/proj/handAgent/design/tokens.json)；修改颜色、间距、圆角、字体或动画值时先改 token，再运行 `pnpm generate:theme-tokens`。

## 视觉基调

handAgent 是本地 AI agent 桌面工具，界面应安静、高效、适合长时间使用。它不是营销页，不用大字号英雄区、装饰性渐变、光晕或展示型动效。

亮暗主题都使用暖色画布：亮色是奶白，暗色是暖深棕灰，不整页黑化。珊瑚橘是唯一主强调色，只用于主要按钮、选中态和关键运行状态；teal / amber / success / warning / error 只表达状态，不扩展成新的品牌色。

## Token 边界

- 运行时 token 源是 `design/tokens.json`，Swift / React 主题适配层都应从生成结果取值。
- 组件内不要内联 hex、rgba 或孤立字号；确需新增视觉常量时先判断它是否应该成为 token。
- 暗色 surface 不是亮色 surface 的机械反转：canvas 是地表，输入框和 tool 面板更深，浮层更亮。
- 语义状态色亮暗一致；不要为 dark mode 另造 success / warning / error / teal / amber 变体。

## 排版和密度

- React 侧使用 Inter / 系统无衬线体，Swift 侧使用系统字体；等宽体只用于代码和 tool 输出。
- 正文权重以 400 为主，标题和 label 用 500；不要靠粗体堆层级。
- 工具型界面保持高信息密度。留白用于分组，不用于装饰。
- 标题字号保持克制，普通产品界面不要使用大于 22px 的标题。

## 组件原则

- 主按钮只用于最重要的提交 / 新建 / 允许动作；次要动作使用弱表面、边框或文字按钮。
- 图标按钮用于工具栏、关闭、删除、更多操作等熟悉命令；需要说明时用 tooltip，不在界面堆长解释。
- 普通列表项和卡片不加阴影；阴影只用于真正浮动的 PromptPanel、Composer 或弹窗。
- User 消息使用右对齐气泡；Assistant 消息直接排在画布上；Tool 输出使用更紧凑的可折叠块。
- 详细说明默认收进 `?` 提示，页面上只保留短标题、必要状态和可操作控件。

## 禁止项

- 不用纯黑或高对比纯白作为大面积底色。
- 不用装饰性渐变、光晕、hover 位移动画或营销式大留白。
- 不发明新的强调色或一次性状态色。
- 不用阴影表达普通列表层级。
- 不把设计 token 表复制到其他文档；需要说明时链接本文件或 `design/tokens.json`。

## 相关文档

- 视觉重构实施资料：[docs/visual-refactor-design.md](/Users/mu9/proj/handAgent/docs/visual-refactor-design.md)
- ThreadWindow 样式约束：[thread-window-web.md](/Users/mu9/proj/handAgent/apps/thread-window-web/thread-window-web.md)
- Swift 主题桥接：[theme.md](/Users/mu9/proj/handAgent/apps/desktop/Sources/Theme/theme.md)
