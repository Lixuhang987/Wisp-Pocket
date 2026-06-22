**1. 核心视觉判断 (Core Visual Judgment)**

当前的 PromptPanel 被当作一个“静态页面区块”来设计（巨大的 32px 内边距、固定的 640x420 大尺寸、24px 的松散行距）。但作为一个由全局热键唤起的命令面板（Command Palette），它的本质是一个**瞬态的高频工具**。

它的视觉隐喻不应该是“一张海报”或“一个表单页”，而应该是一张**“带有打字机编辑光标的索引卡片” (Editorial Command Slip)**。它必须具备极高的信息密度、紧凑的肌肉记忆反馈，并且在视觉上保持极度的安静。我们应当将其空间占用压缩至最低限度，剥离不必要的装饰性边框与色块，利用紧凑的字号对比和微小的间距来构建专业的工具感，同时严格继承 Claude 设计系统中特有的“暖色画布 (Warm Canvas)”与“发丝线 (Hairline)”美学。

**2. 应当避免的陈词滥调 (Cliches to Avoid)**

*   **极客终端模拟 (Cyberpunk Terminal)：** 避免使用冷灰/深黑的毛玻璃、高饱和度荧光色边框或纯等宽字体堆砌。面板必须保留 Anthropic 的人文与编辑属性（暖调、克制）。
*   **SaaS 仪表盘气泡 (SaaS Dashboard Bubble)：** 避免为 Chip 或 Action 行添加厚重的投影、巨大的 24px 圆角或过强的块状背景。过度包装会阻碍用户的视线扫视。
*   **笨重的空面板 (Hollow Dialog)：** 避免强制设定巨大的最小高度（如 420px）。当没有 Action 或草稿时，面板应该像一条简单的输入带一样克制。

**3. 候选视觉方向 (Candidate Visual Directions)**

*   **方向 A：纯文本游标卡片 (The Pure Typographic Slip)**
    *   *隐喻与主体*：一张只能看到文字和光标的纯净纸条。
    *   *材质与排版*：完全移除 Chip 和 Action 列表的可见边界，仅通过排版缩进和颜色的明暗（`textPrimary` vs `muted`）来区分层级。
    *   *适用性与风险*：极致的高级感和安静，但对于包含复杂附件（Image/Skill）和不同状态（Error）的交互来说，缺乏足够的视觉锚点，用户可能难以识别可点击区域。
*   **方向 B：编辑部命令面板 (The Editorial Command Palette)**
    *   *隐喻与主体*：精密的排字盘。输入区是主轴，附件与候选动作紧密吸附在主轴周围。
    *   *材质与排版*：保留基础的 `canvas` 暖调底色，极大压缩内边距。所有的背景高亮（Hover 状态）采用极低对比度的 `surfaceSoft`，所有的边框降级为 0.5px 的 `hairline`。采用极细的间距网格（2px/4px/8px）。
    *   *适用性与风险*：完美契合高频生产力工具的诉求，信息密度高，鼠标移动路径短。风险在于如果去掉了过多的边框，对开发层面的 SwiftUI 间距把控要求极高，多 1px 都会显得松垮。

**4. 推荐视觉方向与详细实施细则 (Recommended Direction: The Editorial Command Palette)**

推荐使用**方向 B (编辑部命令面板)**。通过紧凑的排版布局和极简的材质表达，将视觉噪音降到最低，让用户的视线 100% 聚焦于输入的文本（Prompt）与高亮的动作（Action）。

以下是针对您提出的 6 个维度的具体重构数值与逻辑：

### 1. 容器样式调整 (Container Mechanics)
面板必须从“固定尺寸的沉重窗口”转变为“随内容呼吸的轻量卡片”。
*   **Padding (内边距):** 从 32px (`xl`) 大幅缩减为 **水平 16px，垂直 16px**。
*   **Min-Size (最小尺寸):** 宽度缩小至 **600px**。**移除最小高度 (minHeight: 420)**，改为由内容自适应撑开（建议设定 `maxHeight: 480`，超出部分列表内部滚动）。当只有输入框时，面板整体高度应该仅在 60px 左右。
*   **Corner Radius (圆角):** 保持 **12px (`radius.lg`)**。由于内边距缩小，12px 能产生更紧致的包裹感。
*   **Shadow (阴影):** 当前的 `radius: 26, y: 18, opacity: 0.14` 太重且位置太低。修改为：**`color: ink.opacity(0.12), radius: 32, x: 0, y: 12`**。让面板感觉离桌面更近，且光晕更柔和。

### 2. 布局顺序建议 (Layout Architecture)
当前的顺序（Chips -> Input -> Banner -> Actions）在视觉上是头重脚轻的。附件（Chips）不应该压在输入框头顶，干扰打字视线。
*   **全新顺序建议：**
    1.  **Input Row (首行输入框 + 设置图标)** - 最高优视觉锚点。
    2.  **Chip Row (附件流)** - 作为输入的补充，紧贴在输入框下方。
    3.  **Banner (报错/状态信息)** - 发生异常时插入。
    4.  **Divider (发丝线分隔)**
    5.  **Action List (动作列表)**

### 3. VStack 各元素间距调整 (Vertical Rhythm)
当前的 `spacing: lg (24px)` 使得组件四分五裂。改用更紧密的编排：
*   **整体 VStack Spacing:** 改为 **0**（完全由各模块自身的 padding 和精准的 spacer 控制，避免被全局间距带偏）。
*   Input 与 Chips 之间：**8px**。
*   Chips 与 Divider 之间：**16px**。
*   Divider 与 Action List 之间：**8px**。

### 4. 输入行优化 (Input Row Dynamics)
*   **间距:** Input 与 Settings 按钮之间的间距缩减为 **12px**。
*   **输入框形态:** 移除输入框自带的所有边框背景，让文字直接浮于面板 `canvas` 之上，字号使用 18px (`title-md` 级别)，行高 1.4，颜色使用最深的 `ink`。
*   **设置按钮位置与态势:** 保持 32x32，但默认颜色改为极浅的 `mutedSoft` (透明度降低)，只有在 Hover 时才恢复为 `textSecondary` 并浮现背景。让它在用户输入时“隐身”。

### 5. Chip 区域优化 (Attachment Chips)
目前的 Chip 像厚重的卡片，应当将其降维为轻巧的“标签（Tag）”。
*   **HStack 间距:** 从 12px 缩小至 **6px**。
*   **Chip 内部 Padding:** 修改为 **垂直 4px，水平 8px** (内部 xmark 间距 4px)。
*   **材质与边框:**
    *   取消默认的 `hairline` 边框，改为纯底色表达。
    *   普通 Chip：背景 `surfaceSoft`，无边框。
    *   Image/Skill Chip：背景 `surfaceCard` (稍深一层)，无边框，Icon 使用 `accentRing` 颜色。
    *   Error Chip：背景 `surfaceSoft`，1px `error` 颜色边框。
*   **字号:** 统一下降到 12px (`caption-uppercase` 大小，但保持常规大小写和 weight 400)。

### 6. Action 列表优化 (Action List Density)
Action 列表是用户高频上下切换的区域，间距必须紧凑，产生“菜单项”而非“信息流”的错觉。
*   **行间距 (LazyVStack Spacing):** 从 8px (`xs`) 缩减为 **2px**。
*   **行内布局 (ActionRowModifier):**
    *   Padding 改为 **垂直 8px，水平 12px**。
    *   Title：14px (StyreneB 500)，Description：12px (StyreneB 400, `muted`)。两者间距缩减为 2px。
    *   高亮状态材质：移除高亮时的 `accentRing` 边框（太像 SaaS 表单聚焦），仅使用 `surfaceHover` 铺满整个 Row 的背景，圆角 8px (`radius.md`)。
*   **Trigger Pill (快捷键提示符) 样式:**
    *   当前的 Capsule (胶囊) 形状过于圆润，像个标签。应当将其改为**圆角矩形 (RoundedRectangle, radius: 4px)**，使其在隐喻上更像键盘上的物理按键 (如 `⌘K`)。
    *   取消背景色填充，仅在高亮行时，使用极细的 `hairline` 描边，文字使用 `muted`。保持安静，不要抢夺 Title 的视觉焦点。
---

## Original Prompt

```text
为 handAgent 的 Swift PromptPanel 生成详细的视觉重构设计方案。

## PromptPanel 是什么
macOS 原生浮动面板，用户按全局热键唤起。面板承载：输入框 + 附件chip + action列表 + 设置按钮。用户输入 prompt 后提交，面板关闭，ThreadWindow 打开。

## 当前代码结构和视觉问题

### 容器（PromptPanelStyles.swift）
- padding: 32px (theme.spacing.xl) — 太大，浪费空间
- 最小尺寸: 640×420 — 高度过大，action列表不多时底部大片空白
- 背景: canvas.opacity(0.97) — 微透明暖底
- 圆角: radius.lg (12px)
- 边框: hairline 0.8px
- 阴影: ink.opacity(0.14) radius:26 y:18

### 输入行（PromptPanelView.swift firstRow）
- HStack: inputComposer + settingsButton
- inputComposer: PromptPanelGrowingTextView，支持多行，宽度根据内容动态调整
- settingsButton: 32×32 gear icon，hover变色
- 间距: spacing.md (16px)

### Chip 区域
- 横向ScrollView，HStack spacing:sm(12px)
- 每个chip: icon + label + xmark，padding 10-4-5，borderedCard + 0.8边框
- 三种chip样式：error(红边框)、image/skill(accentRing边框)、text(hairline边框)

### Action 列表
- ScrollView > LazyVStack spacing:xs(8px)
- 每行: title + description + trigger pill
- ActionRowModifier: padding 9v/16h，highlight时surfaceHover背景+accentRing边框
- TriggerPill: caption字号，capsule形状

### 布局顺序（VStack spacing:lg=24px）
1. chipRow（如果有chips）
2. firstRow（输入+设置）
3. submissionDisabledBanner（如果有错误）
4. Divider
5. actionList

## 设计方向
安静高效、信息密度高、少装饰。保留面板形态但更紧凑。

## 请提供
1. 容器样式调整：padding、最小尺寸、圆角、阴影的新值
2. 输入行优化：间距、设置按钮位置
3. Chip区域优化：间距、chip样式
4. Action列表优化：行间距、行内布局、trigger pill样式
5. VStack各元素间距调整
6. 如果有布局顺序建议也请提出
所有建议给具体的 px/pt 数值。
```

### Referenced Files
- /Users/mu9/proj/handAgent/apps/desktop/Sources/PromptPanel/PromptPanelView.swift
- /Users/mu9/proj/handAgent/apps/desktop/Sources/PromptPanel/PromptPanelStyles.swift
- /Users/mu9/proj/handAgent/apps/desktop/Sources/Common/CommonComponents.swift
- /Users/mu9/proj/handAgent/DESIGN.md
