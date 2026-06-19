# Settings 风格与主题约束 Spec

## Background

当前 macOS 原生 Settings 窗口包含模型、外观、工具、AgentTrigger、Append Prompt、MCP、权限、快捷键和工作区九个 Tab。各 Tab 已经部分复用 `SettingsRow`、`SettingsSection`、`SettingsFieldStyle` 等共享样式，但页级结构、空状态、错误展示、动作区、表单控件和二级页面仍存在各自实现。

暗色主题下已经出现表单 placeholder 或输入内容对比不足的问题，说明 Settings 修改时容易绕过 `AppTheme` token，导致主题遗漏。

## Goal

统一 Settings 内容区的视觉与交互结构，并把主题正确性提升为硬约束。

Settings 新增或修改 UI 时，应优先使用 Settings 共享组件。共享组件必须消费 `@Environment(\.appTheme)`，并覆盖 light / dark 两套主题下的文本、placeholder、边框、背景、禁用态、错误态和危险操作样式。

最终效果是：九个 Tab 保持各自信息结构，但在页级容器、区块间距、行布局、空状态、错误展示、表单控件和动作按钮上呈现一致的 macOS 原生工具设置风格。

## Non-Goals

不重做 Settings 顶部 Tab Bar 的交互模型。

不把 Settings 改成卡片化、营销式或大面积装饰性布局。

不改变任何设置项的数据模型、配置文件格式或写入语义。

不新增 Swift ThreadWindow、StatusBubble 或其他常驻原生 UI。

## Use Cases

- Trigger：用户在 light 或 dark 主题下打开任意 Settings Tab。
- Expected result/effect：页面背景、文字、分隔线、控件边框和控件内容均使用统一主题 token，保持可读且风格一致。

- Trigger：用户打开包含表单的 Settings 页面，例如 AgentTrigger 新增自动化、Append Prompt 新增项或 MCP 新增 server。
- Expected result/effect：输入框 placeholder、已输入文本、禁用态、错误提示和表单按钮在 light / dark 主题下都清晰可读。

- Trigger：开发者为 Settings 增加新的输入控件、空状态、错误提示或动作按钮。
- Expected result/effect：开发者使用 Settings 共享组件，而不是直接散落裸 `TextField`、`TextEditor`、裸 `Button`、裸错误 `Text` 或手写空状态布局。

- Trigger：用户在列表型 Tab 中执行新增、删除、刷新或添加示例等操作。
- Expected result/effect：普通操作、次要操作和危险操作有一致的位置、文案层级、图标风格和主题色。

- Trigger：用户进入 AgentTrigger 这类二级 Settings 页面。
- Expected result/effect：二级页继续沿用同一页级容器、标题、表单行、分隔线和底部动作区规则，不出现与其他 Tab 脱节的暗色主题或布局问题。
