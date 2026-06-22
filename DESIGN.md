---
version: alpha
name: handAgent-design-system
description: handAgent 的视觉设计系统。暖色画布底色、珊瑚橘主色、安静高效的日常工具基调。亮暗主题共享暖色底——亮色是奶白，暗色是暖深棕灰，不整页黑化。

colors-light:
  canvas: "#faf9f5"
  surface: "#efe9de"
  surface-soft: "#f5f0e8"
  surface-elevated: "#ffffff"
  surface-muted: "#e8e0d2"
  hairline: "#e6dfd8"
  hairline-soft: "#ebe6df"
  text-primary: "#141413"
  text-secondary: "#6c6a64"
  text-muted: "#8e8b82"
  accent: "#cc785c"
  accent-hover: "#a9583e"
  accent-pressed: "#8f4731"
  accent-subtle: "rgba(204, 120, 92, 0.14)"
  accent-ring: "rgba(204, 120, 92, 0.28)"
  on-accent: "#ffffff"
  success: "#5db872"
  warning: "#d4a017"
  error: "#c64545"
  teal: "#5db8a6"
  amber: "#e8a55a"
  user-bubble: "#f5e7de"
  assistant-bubble: transparent
  tool-bubble: "#f3eee6"

colors-dark:
  canvas: "#2a2522"
  surface: "#211e1b"
  surface-soft: "#262320"
  surface-elevated: "#3a3530"
  surface-muted: "#342f2a"
  hairline: "#3e3833"
  hairline-soft: "#342f2a"
  text-primary: "#efe9de"
  text-secondary: "#b8b2a7"
  text-muted: "#8e8b82"
  accent: "#cc785c"
  accent-hover: "#e09880"
  accent-pressed: "#a9583e"
  accent-subtle: "rgba(204, 120, 92, 0.18)"
  accent-ring: "rgba(204, 120, 92, 0.36)"
  on-accent: "#1a1614"
  success: "#5db872"
  warning: "#d4a017"
  error: "#c64545"
  teal: "#5db8a6"
  amber: "#e8a55a"
  user-bubble: "#3a3530"
  assistant-bubble: transparent
  tool-bubble: "#211e1b"

typography:
  title-lg:
    fontFamily: "Inter, -apple-system, system-ui, sans-serif"
    fontSize: 22px
    fontWeight: 500
    lineHeight: 1.3
  title-md:
    fontFamily: "Inter, -apple-system, system-ui, sans-serif"
    fontSize: 18px
    fontWeight: 500
    lineHeight: 1.4
  title-sm:
    fontFamily: "Inter, -apple-system, system-ui, sans-serif"
    fontSize: 16px
    fontWeight: 500
    lineHeight: 1.4
  body-md:
    fontFamily: "Inter, -apple-system, system-ui, sans-serif"
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.55
  body-sm:
    fontFamily: "Inter, -apple-system, system-ui, sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.55
  caption:
    fontFamily: "Inter, -apple-system, system-ui, sans-serif"
    fontSize: 13px
    fontWeight: 500
    lineHeight: 1.4
  code:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.6
  button:
    fontFamily: "Inter, -apple-system, system-ui, sans-serif"
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1

rounded:
  xs: 4px
  sm: 6px
  md: 8px
  lg: 12px
  xl: 16px
  pill: 9999px
  full: 9999px

spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px

shadow:
  soft: "0 1px 3px rgba(20, 20, 19, 0.08)"
  product-inner: "inset 0 1px 0 rgba(250, 249, 245, 0.08)"

components:
  button-primary:
    backgroundColor: "{colors-light.accent}"
    textColor: "{colors-light.on-accent}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: 12px 20px
    height: 40px
  button-secondary:
    backgroundColor: "{colors-light.canvas}"
    textColor: "{colors-light.text-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: 12px 20px
    height: 40px
  button-icon:
    backgroundColor: transparent
    textColor: "{colors-light.text-secondary}"
    rounded: "{rounded.md}"
    size: 32px
  text-input:
    backgroundColor: "{colors-light.surface-soft}"
    textColor: "{colors-light.text-primary}"
    typography: "{typography.body-md}"
    rounded: "{rounded.sm}"
    padding: 10px 14px
    height: 40px
  message-user:
    backgroundColor: "{colors-light.user-bubble}"
    textColor: "{colors-light.text-primary}"
    rounded: "{rounded.xl}"
    maxWidth: 75%
  message-assistant:
    backgroundColor: transparent
    textColor: "{colors-light.text-primary}"
  message-tool:
    backgroundColor: "{colors-light.tool-bubble}"
    textColor: "{colors-light.text-muted}"
    typography: "{typography.code}"
    rounded: "{rounded.lg}"
  status-bubble:
    height: 60px
    maxWidth: 256px
    rounded: "{rounded.lg}"
    padding: 12px 16px
---

## 概览

handAgent 是一个本地 AI agent 桌面工具。它的界面追求**安静、高效、适合长时间使用**——像一件每天都用的文具，而不是一个需要"展示"的产品页面。

视觉基调建立在一块**暖色画布**上：亮色是奶白底 (`#faf9f5`)，暗色是暖深棕灰 (`#2a2522`)，两者都带有明显的暖色调。珊瑚橘 (`#cc785c`) 是唯一的强调色，只用在主要按钮和少量状态指示上，其余界面保持安静。

字体用系统无衬线体 (Inter / SF Pro)，不需要装饰性字体。等宽体 (JetBrains Mono) 只出现在 tool 执行结果和代码片段中。

**核心特征：**
- 暖色画布底色，亮暗都有温度感
- 珊瑚橘主色，克制使用
- 信息密度高，留白适度，不浪费空间
- 按钮和图标清楚，文字简短
- 详细说明收进 `?` 提示，界面保持干净
- 没有装饰性动效，状态变化用颜色和透明度表达

## 颜色

### 主色

- **珊瑚橘 / Primary** (`#cc785c`)：唯一的强调色。用在主要操作按钮、选中态指示、运行状态指示灯。亮暗主题下都用同一个色值。
- **珊瑚橘 Active** (`#a9583e`)：按下状态，稍深。
- **Teal** (`#5db8a6`)：辅助色，用在 tool 执行中的状态指示。
- **Amber** (`#e8a55a`)：辅助色，用在等待状态指示。

### 表面

表面颜色构成界面的层级系统。亮色越高层越白，暗色用"下沉式"逻辑：canvas 是地表，功能区（输入框、tool 结果）向下沉更深，浮层向上抬更亮。

**亮色：**
- **Canvas** (`#faf9f5`)：页面底色，暖奶白
- **Surface Soft** (`#f5f0e8`)：输入框底色、Tab 栏底色
- **Surface Card** (`#efe9de`)：卡片背景，比 canvas 深一阶
- **Surface Cream Strong** (`#e8e0d2`)：hover 底色、选中底色
- **Surface Elevated** (`#ffffff`)：弹窗、浮层

**暗色：**
- **Canvas** (`#2a2522`)：页面底色，暖深棕灰（不是纯黑）
- **Surface** (`#211e1b`)：比 canvas 更深的凹槽——输入框内部、tool 执行面板
- **Surface Soft** (`#262320`)：canvas 和 surface 之间的过渡
- **Surface Elevated** (`#3a3530`)：弹窗、浮层，比 canvas 亮
- **Surface Muted** (`#342f2a`)：hover 底色

### 文字

- **Ink** (`#141413`)：亮色主文字，暖黑
- **Body** (`#3d3d3a`)：亮色正文
- **Muted** (`#6c6a64`)：亮色次要文字
- **Muted Soft** (`#8e8b82`)：占位符、时间戳
- **On Dark** (`#efe9de`)：暗色主文字，骨白（不是纯白，纯白在暖底上会割眼）
- **On Dark Soft** (`#8e8b82`)：暗色次要文字，和亮色 muted-soft 一致

### 分割线

- **Hairline** (`#e6dfd8` 亮 / `#3e3833` 暗)：标准 1px 分割线
- **Hairline Soft** (`#ebe6df` 亮 / `#342f2a` 暗)：更弱的分割线

### 语义色

所有语义色亮暗一致，不另造暗色变体：

| 用途 | 色值 | 使用场景 |
|------|------|---------|
| Success | `#5db872` | 完成状态 |
| Warning | `#d4a017` | 警告提示 |
| Error | `#c64545` | 错误状态、删除操作 |

### 气泡色

| 角色 | 亮色 | 暗色 | 说明 |
|------|------|------|------|
| User | `#f5e7de` | `#3a3530` | 用户消息，暖粉底 / 抬升 |
| Assistant | transparent | transparent | 直接印在 canvas 上 |
| Tool | `#f3eee6` | `#211e1b` | tool 执行结果，更轻 / 下沉 |

## 字体

系统级无衬线体，不引入装饰性字体。Swift 侧用系统字体 (SF Pro)，React 侧用 Inter。

| 用途 | 字号 | 字重 | 场景 |
|------|------|------|------|
| title-lg | 22px | 500 | 很少用，仅大标题 |
| title-md | 18px | 500 | Settings section 标题 |
| title-sm | 16px | 500 | 列表项标题 |
| body-md | 15px | 400 | 正文、消息文字 |
| body-sm | 14px | 400 | 辅助文字、设置项 label |
| caption | 13px | 500 | 标签、chip、section header |
| code | 14px | 400 | tool 执行结果、代码片段 (JetBrains Mono) |
| button | 14px | 500 | 按钮文字 |

**原则：** 不用粗体强调信息层级，用字号差和颜色差。weight 400 是正文，500 是标签和标题，600 只用在极少数场合。

## 间距

4px 基准网格：

| Token | 值 | 常见用途 |
|-------|---|---------|
| xxs | 4px | 最小间隔 |
| xs | 8px | 元素内间距、行间 |
| sm | 12px | 组件内边距 |
| md | 16px | 标准内边距 |
| lg | 24px | 区域间距 |
| xl | 32px | 大区域间距 |
| xxl | 48px | 仅用于少数场合 |

**原则：** 宁紧勿松。桌面工具的信息密度应该高于移动端。留白用来分组，不用来装饰。

## 圆角

| Token | 值 | 用途 |
|-------|---|------|
| xs | 4px | trigger pill（键帽风格） |
| sm | 6px | 小按钮、输入框 |
| md | 8px | 标准按钮、Tab、Action 行高亮 |
| lg | 12px | 面板容器、卡片、消息气泡 |
| xl | 16px | 大容器 |
| pill | 9999px | 胶囊标签、Composer 输入框 |

## 阴影

极少用阴影。大部分层级靠背景色差和分割线表达。

| 场景 | 值 |
|------|---|
| Soft | `0 1px 3px rgba(20, 20, 19, 0.08)` |
| 浮动面板 | `0 18px 50px rgba(72, 58, 42, 0.10)` (亮) / `0 20px 56px rgba(0, 0, 0, 0.24)` (暗) |
| 内嵌线 | `inset 0 1px 0 rgba(250, 249, 245, 0.08)` |

不要为普通卡片或列表项加阴影。阴影只用在 PromptPanel 浮动面板、Composer 输入框、弹窗这类真正浮在桌面上的元素。

## 组件

### 按钮

**主按钮**：珊瑚橘底 + 白字，14px/500，padding 12px×20px，高 40px，圆角 md (8px)。只用在最重要的操作（发送、新建、允许）。

**次按钮**：canvas 底 + hairline 边框 + ink 字。同样的 padding 和高度。用在取消、拒绝等次要操作。

**图标按钮**：透明底，32×32 或 28×28，hover 时 surfaceHover 底色。用在新建、设置、关闭等工具栏操作。

**文字按钮**：透明底，primary 色字。用在内联操作。

### 输入框

canvas 底 + hairline 边框，padding 10px×14px，高 40px，圆角 sm (6px)。focus 时 primary 色边框 + accent ring。

### 消息气泡

- **User**：右对齐，userBubble 底色 + hairline 边框，圆角 xl (16px)，最大宽 75%
- **Assistant**：全宽，透明底，直接印在 canvas 上
- **Tool**：全宽，toolBubble 底色，无边框，等宽字体 (code)

### PromptPanel

热键唤起的浮动面板。canvas 底 + hairline 边框 + 阴影。内边距 16px，宽 600px，高度由内容决定（保持 minHeight 420）。

### StatusBubble

浮动状态指示气泡。60px 高，最大 256px 宽，圆角 lg (12px)。状态指示灯颜色直接使用主题色：

| 状态 | 颜色 | 来源 |
|------|------|------|
| 空闲 | `#8e8b82` | muted-soft |
| 运行中 | `#cc785c` | primary |
| 工具调用 | `#5db8a6` | teal |
| 等待输入 | `#e8a55a` | amber |
| 完成 | `#5db872` | success |
| 错误 | `#c64545` | error |

## 做和不做

### 做

- 所有页面都用暖色画布底。亮色 `#faf9f5`，暗色 `#2a2522`。
- 珊瑚橘只用在主要按钮和状态指示，其他地方保持安静。
- 暗色模式保持暖色调，不整页黑化。功能区（输入框、tool 面板）用更深的暖色层表达"下沉"。
- 文字层级用字号和颜色差表达，不用粗体。
- 详细说明收进 `?` 图标提示，界面默认只显示短标题和必要状态。
- 用图标代替文字标签，减少阅读负担。
- 保持高信息密度，间距紧凑但不拥挤。

### 不做

- 不用纯黑 (`#000000` / `#121212`) 做暗色底。纯黑没有温度。
- 不给普通列表项和卡片加阴影。阴影只用在真正浮动的元素。
- 不用装饰性渐变或光晕。如果保留，强度控制在 6% 以下。
- 不用大字号（>22px）做界面标题。大字号是营销页的语言，不是工具的。
- 不在界面上堆说明文字。一句话能说清的不写两句。
- 不给按钮和列表项加 hover 位移动画 (translateY)。颜色变化就够了。
- 不发明新的强调色。珊瑚橘 + teal + amber 三个辅助色已经够用。
- 不在暗色主题中为语义色（success/error/warning/teal/amber）另造变体，直接复用亮色色值。

## 迭代指南

1. 改一个组件就改一个组件，不要一次改整个页面的所有东西。
2. 颜色永远引用 token，不要内联 hex。
3. 新增组件时先看有没有现有组件可以复用。
4. 暗色主题的 surface 层级是"下沉式"的：canvas 是地表，功能区向下更深，浮层向上更亮。不要按亮色的"越高越白"逻辑套。
5. 如果一个设计决策让界面变得更"好看"但更复杂，选择更简单的那个。工具的美来自精确和克制。
