### 1. 核心视觉判断 (Core Visual Judgment)

当前 Settings 窗口的视觉比例错位：它在一个 660×520 的桌面级固定视口内，使用了类似 iPad 的大触控目标（56pt 高度的 Tab、48pt 的两翼留白）。对于一个拥有 9 个顶层设置维度的桌面工具来说，这导致了严重的“首屏空间损耗”和视觉噪音。

重构的核心判断是**从“移动端触控面板”转向“Mac 原生高密度精密仪表盘”**。我们需要压缩结构性空间（导航栏、外边距），将像素释放给内容；同时把界面材质从“堆叠的卡片”降级为“安静的纸面（Canvas）”，去除多余的边框和强调色，利用留白（而非线条）来定义信息群组。复杂的说明文字必须被折叠为交互式材质（Tooltip），保持界面的绝对清爽。

### 2. 避免的视觉陈词滥调 (Cliches to Avoid)

*   **iOS 移植感 (The "iPad-on-Mac" Cliche)**：避免使用高度超过 40pt 的巨大分段控制器、巨大的圆角 Toggle 开关，或在桌面端强行使用全宽 List 背景。
*   **过度包装的“SaaS”卡片 (The Dashboard Cliche)**：避免给每一行 Row 或 Section 增加背景色、阴影或外边框。在设置面板中，过度框线会导致视觉过载。
*   **话痨式文案 (The Explanatory Wall-of-Text)**：避免在输入框下方直接暴露三四行灰色的小字说明，这会破坏垂直对齐的节奏感。
*   **喧宾夺主的 Tab 选中态**：避免在顶部 Tab 栏同时使用背景色、边框（accentRing）和底部指示条（accent bar）。三者叠加属于冗余的视觉噪音。

### 3. 候选视觉方向 (Candidate Visual Directions)

#### 方向 A：The Native macOS Toolbar（标准原生偏好设置）
*   **隐喻**：系统级原生偏好设置窗口（如 Safari / 系统设置）。
*   **材质与排版**：顶部无底色，与标题栏融合（Window NSWindow.StyleMask.unifiedTitleAndToolbar）。Tab 采用 32pt 纯图标，下方跟 11pt 纯文本，无边框。
*   **匹配度与风险**：极度符合 Mac 用户直觉，但 9 个 Tab 可能会让标准 Toolbar 显得拥挤，且实现上需要跳出 SwiftUI 基础的 HStack 布局，改用 NSToolbar。

#### 方向 B：The Editorial Canvas（排版级安静画布，基于提供的 DESIGN 规范）
*   **隐喻**：一本排版严谨的说明书索引页。
*   **材质与排版**：背景统一使用 `canvas`（暖白），摒弃 `surfaceSoft` 的色块切分。Tab 栏压缩为极简的文字/小图标组合，依靠文字的字重（Semibold）和底层极细的 `hairline` 区分层级。
*   **组件特征**：以对齐和比例代替边框。Label 极度克制，只出现名词；所有长句被收纳进统一的圆形小问号 `?` 图标中。
*   **匹配度与风险**：完美契合 handAgent 既有的温和色盘（Coral + Canvas），信息密度极高。风险在于如果没有框线，对齐精度（Padding & Spacing）要求极度严苛。

### 4. 推荐设计方案：The Editorial Canvas（排版级安静画布）

推荐采用 **方向 B**。基于你提供的代码和视觉规范，我们应当大幅度“脱水”，将组件尺寸降维到真正的桌面级精度。

以下是具体的 px/pt 数值重构指南：

#### 4.1 Tab 栏重构：横向高密压缩
9 个 Tab 数量多，当前的 `56pt高度 + 24pt间距` 导致其占据了近 80pt 的头部空间。必须将高度压缩至 44pt 以内，并剥离冗余的选中态装饰。

*   **容器高度与材质**：取消 `surfaceSoft` 背景色，改用透明或统一的 `canvas` 颜色。底部保留一条 0.5px 的 `hairline` 作为与内容区的唯一分割界限。
*   **间距配置**：HStack spacing 调整为 `8px` 或 `4px`。Padding horizontal 调整为 `24px`，Padding vertical 调整为 `8px`。整体 Tab 区总高控制在 `48pt`。
*   **单个 Tab 结构**：
    *   保留 VStack 排列，但高度从 56pt 砍到 `32pt`。
    *   **图标 (Icon)**：尺寸从 20pt 缩减至 `14pt`，frame 高度限定为 `16pt`。
    *   **文字 (Title)**：字号使用 11pt，字重在未选中时 Regular，选中时 Semibold。
    *   **间距 (Spacing)**：VStack spacing 从 4 缩小为 `2`。
*   **选中态 (Active State) 极简处理**：
    *   **去除**：现有的 `canvas` 背景填充、`accentRing` 边框。
    *   **保留**：文字/图标颜色变为 `ink`。仅使用底部的 2pt `accent` 指示条（长度与文字等宽，约 20-24px，而不是固定的 28px），贴底排列。

#### 4.2 窗口尺寸调整
*   **建议尺寸**：`680 × 560`（宽 +20，高 +40）。
*   **原因**：660 容纳 9 个横向 Tab 极其勉强（约每个 60px 宽度）。加宽 20px 可以让 HStack 呼吸感更好；增加 40px 高度是为了弥补因说明文字折叠而带来的视觉重心上移，给内容区底部留出 `section` 级的白方块。

#### 4.3 内容区全局间距调整 (Padding Redesign)
现有的 `xxl(48px)` 水平边距在 660 的窗口中切掉了近 15% 的可用面积，导致中间内容区被挤压。

*   **Horizontal Padding**：从 48px 缩减为 `32px (xl)`。
*   **Vertical Padding**：顶部第一段距离 Header 缩减为 `16px (md)`，底部留白保持 `24px (lg)`。
*   **整体信息宽度**：680 - 32×2 = `616px` 有效内容宽。

#### 4.4 行布局与表单重构 (Row Layout & Proportions)
打破固定的 120/340 比例，为深层设置腾出空间。

*   **Label 区**：宽度增加至 `140px`。右对齐。字号 `13px`（而非 bodyFont 的 14px/16px），颜色 `body`。
*   **中轴间距 (Spacing)**：从 `32px (xl)` 缩减至 `16px (md)`。
*   **Control 区**：最大宽度扩大至 `420px`。左对齐。
*   **Row 纵向间距**：Padding vertical 从 16px 缩减至 `12px`，让紧密相关的设置项（如 MCP 配置）能在一屏内展现更多。
*   **分割线 (Divider)**：Leading padding 对应新的 Label 宽度，调整为 `140 + 32(边距) + 16(中轴) = 188px` 起始位置，精准对齐 Control 区的左边缘。颜色使用最轻的 `hairline-soft`。

#### 4.5 Section Header 样式克制化
*   **排版**：使用 `12px` (caption-uppercase 规则)，字重 Semibold，字母间距（tracking） +1px，颜色 `muted`。
*   **位置**：打破原来的全宽填充。让 Header 文本的 X 轴起点精准对齐 **Control 区的左边缘**（即距离窗口左侧 140+32+16=188px），而不是从最左侧开始。这种非对称的对齐方式会极大提升面板的“专业排版感”（Mac 原生设置常用此手法）。
*   **间距**：Padding top `24px`，Padding bottom `12px`。

#### 4.6 解释性说明文字的收纳 (The "?" Tooltip System)
禁止在 Control 区的输入框下方直接写灰色的长说明。采用“渐进式展开”的信息架构：

*   **入口位置**：在 Row 的 Control 组件（如 TextField 或 Toggle）的最右侧，或者直接紧贴在 Label 文本的右侧（若 Label 很短）。推荐：**放置在 Control 区内组件的后方（Trailing）**。
*   **图标样式**：尺寸 `14 × 14px`，`systemName: "questionmark.circle"`。颜色常态为 `muted-soft`，Hover 态变为 `ink`。不需要背景框。
*   **交互材质 (Tooltip)**：
    *   采用 Mac 原生的 `NSPopover` 或 SwiftUI 的 `.help()` / 自定义 Hover 浮层。
    *   浮层材质：背景使用 `surfaceDark` 或纯深色，文字使用 `onDark`（参考 DESIGN.md 中的 dark 表面设定，形成对比）。
    *   排版：内边距 `12px`，字号 `12px (body-sm)`，行高 1.4。
    *   最大宽度：`260px`（超出自动换行），确保长说明可以阅读但不会遮挡太多底层 UI。

### 总结视图骨架 (Visual Skeleton Summary)
```text
[Window 680x560]
|-- TabBar ----------------------------------------------------|
| 高度 48pt, 背景 transparent, 底边 0.5px hairline                 |
| [图] [图] [图] [图] [图] [图] [图] [图] [图]                 |
|  字   字   字   字   字   字   字   字   字                  |
|  ▔▔                                                          | <- accent bar 贴底
|--------------------------------------------------------------|
| [ScrollView]  padding-x: 32px                                |
|                                                              |
|                     SECTION HEADER (对齐中轴后方, 12px 宽距)    |
|                                                              |
|        Label(140px) | (16px) | [Control(420px)] [?](14px)    |
|                     |        |                               |
|                     |--------| 极弱分割线 (对齐Control)         |
|                     |        |                               |
|     Longer Label(140) | (16) | [Control]                     |
|                                                              |
```
---

## Original Prompt

```text
为 handAgent 的 Swift Settings 窗口生成详细的视觉重构设计方案。

## Settings 是什么
macOS 原生设置窗口，固定 660×520，顶部 Tab 栏 + 下方内容区。9个 Tab：模型、外观、工具、触发器、追加、MCP、权限、快捷键、工作区。

## 当前代码结构和视觉问题

### Tab 栏（SettingsStyles.swift SettingsTabBar）
- 背景: surfaceSoft
- HStack spacing: sm(12px)，padding horizontal lg(24px)，vertical sm(12px)
- 每个 Tab 按钮高度 56pt：
  - icon: 20pt，frame高24
  - title: 11pt字号
  - VStack spacing:4
  - 选中态：canvas背景 + accentRing边框 + accent底部指示条(28×2)
  - 未选中态：transparent背景 + clear边框
- 9个Tab挤在一行，总高度约 56+12+12=80pt，占窗口15%
- 当前问题：Tab太大、图标太大、文字太小、视觉层级不清

### 内容区
- CommonPage: ScrollView > VStack spacing:0，padding vertical lg(24px)
- CommonSectionHeader: captionFont.semibold，muted色，padding horizontal xxl(48px)，top lg(24px)，bottom xs(8px)
- CommonSection: VStack spacing:0，padding vertical lg(24px)，horizontal xxl(48px)
- CommonRow: HStack spacing:xl(32px)
  - label: bodyFont，body色，固定宽度 120px 右对齐
  - control: 最大宽度 340px 左对齐
  - padding vertical md(16px)
- CommonRowDivider: hairline色，leading padding 152px
- 窗口固定 660×520

### 问题
1. Tab 栏太高占 80pt，图标20pt+文字11pt的组合视觉笨重
2. 内容区 horizontal padding 48px 太大（660宽只留 564 内容区）
3. Row label 固定 120px + control 340px = 460px，剩余104px是边距
4. 大量说明文字占空间（设计方向要求：默认只保留短标题和必要状态，详细说明放到?图标提示）

## 设计方向
安静高效、信息密度高、图标清楚。Tab栏压缩但保持清晰。允许调整信息结构。说明文字压缩到?提示。

## 请提供
1. Tab 栏重新设计：高度、图标大小、文字大小、间距、选中态样式
2. 内容区 padding 调整
3. Row 布局调整：label宽度、control宽度、间距
4. SectionHeader 样式调整
5. 窗口尺寸是否需要调整
6. 说明文字处理方式（? 图标的位置、样式、tooltip/dialog 的建议）
所有建议给具体的 px/pt 数值。
```

### Referenced Files
- /Users/mu9/proj/handAgent/apps/desktop/Sources/Settings/SettingsView.swift
- /Users/mu9/proj/handAgent/apps/desktop/Sources/Settings/SettingsStyles.swift
- /Users/mu9/proj/handAgent/apps/desktop/Sources/Common/CommonComponents.swift
- /Users/mu9/proj/handAgent/DESIGN.md
