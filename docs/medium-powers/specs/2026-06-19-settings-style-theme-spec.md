# Settings 风格与主题约束 Spec

## Background

当前 macOS 原生 Settings 窗口包含模型、外观、工具、AgentTrigger、Append Prompt、MCP、权限、快捷键和工作区九个 Tab。各 Tab 已经部分复用 `SettingsRow`、`SettingsSection`、`SettingsFieldStyle` 等共享样式，但页级结构、空状态、错误展示、动作区、表单控件和二级页面仍存在各自实现。PromptPanel 也有自己的按钮、容器和滚动条样式辅助，说明原生 SwiftUI UI 已经出现跨模块重复。

暗色主题下已经出现表单 placeholder 或输入内容对比不足的问题，说明 Settings 修改时容易绕过 `AppTheme` token，导致主题遗漏。

当前仓库没有 SwiftLint 约束 Settings 主题写法，主题遗漏主要依赖人工 review 发现。

## Goal

统一 Settings 内容区的视觉与交互结构，并把主题正确性提升为硬约束。

新增桌面原生 UI 的 `Common` 通用组件层，沉淀常用前端组件：页级容器、区块、表单行、输入框、文本编辑器、按钮、图标按钮、底部动作区、空状态、错误提示、分隔线和 segmented control。Settings 的共享组件应优先复用 `Common`，只有 Settings 特有语义才保留薄包装。

Settings 新增或修改 UI 时，应优先使用 `Common` 或 Settings 薄包装组件。共享组件必须消费 `@Environment(\.appTheme)`，并覆盖 light / dark 两套主题下的文本、placeholder、边框、背景、禁用态、错误态和危险操作样式。

引入 SwiftLint 作为 Swift UI 静态约束入口。Settings 相关规则应能阻止常见主题违规，例如在 Settings View 中直接使用裸输入控件、裸动作按钮、硬编码颜色或绕过主题 token 的前景/背景样式。

最终效果是：九个 Tab 保持各自信息结构，但在页级容器、区块间距、行布局、空状态、错误展示、表单控件和动作按钮上呈现一致的 macOS 原生工具设置风格。

## Non-Goals

不重做 Settings 顶部 Tab Bar 的交互模型。

不把 Settings 改成卡片化、营销式或大面积装饰性布局。

不改变任何设置项的数据模型、配置文件格式或写入语义。

不新增 Swift ThreadWindow、StatusBubble 或其他常驻原生 UI。

不引入新的 UI 框架替代现有 SwiftUI + `AppTheme` 体系；SwiftLint 只作为约束工具。

不把 `Common` 做成完整 Chakra 类组件库，不追求覆盖所有 SwiftUI 控件。只封装当前 PromptPanel / Settings 已经重复使用或容易出主题问题的常用组件。

不为了兼容历史局部定制而保留多套等价样式。没有明确产品必要性的差异，可以在迁移时磨平。

不强制把 PromptPanel 的专用交互和布局全部迁入 `Common`。只有跨 Settings / PromptPanel 都适用的基础控件、容器和样式才进入 `Common`。

## Use Cases

- Trigger：用户在 light 或 dark 主题下打开任意 Settings Tab。
- Expected result/effect：页面背景、文字、分隔线、控件边框和控件内容均使用统一主题 token，保持可读且风格一致。

- Trigger：用户打开包含表单的 Settings 页面，例如 AgentTrigger 新增自动化、Append Prompt 新增项或 MCP 新增 server。
- Expected result/effect：输入框 placeholder、已输入文本、禁用态、错误提示和表单按钮在 light / dark 主题下都清晰可读。

- Trigger：开发者为 Settings 增加新的输入控件、空状态、错误提示或动作按钮。
- Expected result/effect：开发者使用 `Common` 或 Settings 薄包装组件，而不是直接散落裸 `TextField`、`TextEditor`、裸 `Button`、裸错误 `Text` 或手写空状态布局；违反规则时 SwiftLint 能在本地检查中提示。

- Trigger：开发者在 Swift 原生 UI 中需要常见前端组件，例如按钮、图标按钮、输入框、表单动作区、空状态或错误提示。
- Expected result/effect：开发者先查看 `apps/desktop/Sources/Common/`，复用已有通用组件；如果确实有模块特有语义，再在模块内做薄包装，而不是重复造轮子。

- Trigger：开发者运行提交前检查。
- Expected result/effect：SwiftLint 与现有 Swift build / test 一起执行，主题违规不会只依赖人工 review 才被发现。

- Trigger：用户在列表型 Tab 中执行新增、删除、刷新或添加示例等操作。
- Expected result/effect：普通操作、次要操作和危险操作有一致的位置、文案层级、图标风格和主题色。

- Trigger：用户进入 AgentTrigger 这类二级 Settings 页面。
- Expected result/effect：二级页继续沿用同一页级容器、标题、表单行、分隔线和底部动作区规则，不出现与其他 Tab 脱节的暗色主题或布局问题。
