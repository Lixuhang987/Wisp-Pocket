作为视觉设计总监，针对 handAgent 桌面工具的暗色主题重塑，以下是我的独立视觉判断与设计方案。

### 1. 核心视觉判断 (Core Visual Judgment)

当前的纯黑/冷灰暗色模式（#181715）打破了 handAgent 建立的“人文、编辑、纸感”的品牌心智。AI 工具的界面不应默认陷入“赛博朋克”或“代码终端”的刻板印象。

**重塑的核心在于“材质转换”与“反向光影（Sunken Surface）”：**
暗色模式不应该是“关掉灯的屏幕”，而应该变成“深色的物理材质”——如同深夜书房里的深咖色皮革、或是暗调的羊皮纸。同时，为了满足“深色只用于功能性表面（作为 canvas 之下的更深层）”的要求，我们要采用**下沉式（Sunken）的层级逻辑**：Canvas 作为页面的基础地表（中深暖灰），而输入框、代码区、工具面板则像是在地表上“向下雕刻”出的凹槽（极深暖色），用来承载高密度的复杂信息；只有浮层（Popover/Dialog）才会向上拔高变亮。

### 2. 要避免的陈词滥调 (Cliches to Avoid)

*   **OLED 纯黑与冷灰 (OLED Black & Cool Grays)：** 使用 `#000000` 或 `#121212` 等无色相的黑。这会彻底扼杀产品的温度感，使其沦落为平庸的 SaaS 模板。
*   **霓虹高光 (Neon Tech Accents)：** 为了在纯黑底上跳脱而将 Coral 主色强行提亮成荧光橘/赛博红。这会产生视觉噪音，破坏编辑排版式的阅读宁静感。
*   **表面全部泛白 (Washed-out Surfaces)：** 用叠加纯白透明度的方式来做暗色模式的卡片抬升，这会导致暖暗色系发灰、显脏。必须用拾色器在色相环上真实移动，保持色彩的饱满度。

### 3. 候选视觉方向 (Candidate Visual Directions)

**方向 A：夜间书房 (Night Study / Sepia Dark)**
*   **隐喻与材质：** 犹如在老橡木桌面上展开的深色图纸。底色是带有泥土和木质温度的深褐灰（Umber/Taupe）。
*   **层级构图：** 极具呼吸感的暖底，功能区（代码/输入框）像刻印的凹槽（深咖色），光线柔和。
*   **为什么合适：** 完美延续了亮色模式“暖奶白”的人文主义情绪，将阅读体验转化为一种私密、专注的夜间工作流。
*   **风险：** 暖深色控制不好容易显得“脏”或像复古滤镜。需要极度克制的文本对比度来拉开现代感。

**方向 B：暖岩板 (Warm Slate / Charcoal)**
*   **隐喻与材质：** 哑光深色岩石。底色偏向传统深灰，但强行注入红色/橘色的底色调（Hue 20-30）。
*   **层级构图：** 较为常规的暗黑模式，但在亮部高光处泛出微红。
*   **为什么合适：** 比较安全，符合大众对传统 IDE（如 VS Code 某些暖色主题）的预期。
*   **风险：** 过于安全，品牌识别度（Brand Voltage）不足，容易泯然众“工具”矣。

### 4. 推荐方向与 Token 方案 (Recommended Direction: Night Study)

我强烈推荐 **方向 A (夜间书房)**。它能彻底解决“亮色温润、暗色断裂”的感知问题。

以下是重构后的 Token 系统及设计逻辑，可直接用于工程实现。

#### 重构的暗色 Token 方案

```json
{
  "canvas": "#332e2a",
  "surface": "#24201d",
  "surfaceSoft": "#2c2723",
  "surfaceElevated": "#423c36",
  "surfaceMuted": "#3d3732",
  "hairline": "#4a433d",
  "hairlineSoft": "#3d3732",
  "textPrimary": "#efe9de",
  "textSecondary": "#b8b2a7",
  "textMuted": "#8f8a81",
  "accent": "#d47a5a",
  "accentHover": "#e3967a",
  "accentPressed": "#be6547",
  "accentSubtle": "rgba(212, 122, 90, 0.15)",
  "accentRing": "rgba(212, 122, 90, 0.30)",
  "onAccent": "#1a1614",
  "success": "#69b578",
  "warning": "#d9ad4e",
  "error": "#d16464",
  "teal": "#6abcb0",
  "amber": "#e0a963",
  "userBubble": "#423c36",
  "assistantBubble": "transparent",
  "toolBubble": "#24201d"
}
```

#### 设计逻辑解析 (Design Logic)

**1. 表面层级系统（Sunken Surface 反向纵深）**
*   **`canvas` (#332e2a):** 这是页面的地表，带有明显暖色调的中度深棕灰。它不那么黑，给人透气、温和的视觉铺垫。
*   **`surface` (#24201d):** **（关键变动）** 它是比 Canvas 更暗、更深的颜色。它被用作输入框内部、代码编辑器区、AI Tool 执行面板。隐喻是“凹槽”——在这个暖色的桌面上，需要你输入信息或机器正在运算的区域，是物理下沉的。这种“深陷”的设计能牢牢锁住用户的视觉焦点，降低高密度代码/日志带来的刺眼感。
*   **`surfaceSoft` (#2c2723):** 介于地表和深槽之间的过渡色。
*   **`surfaceElevated` (#423c36):** 真正向上的物理抬升（如 Dropdown 菜单、Tooltips、悬浮设置面板）。由于离“光源”更近，它比 Canvas 更亮。
*   **`surfaceMuted` (#3d3732):** 用于 Hover 态的高亮底色或次要内容区块。

**2. 文字层级（光影对比而非粗暴反白）**
*   纯白 (`#ffffff`) 在暖暗底色上会像刀片一样割眼，破坏编辑感。
*   **`textPrimary` (#efe9de):** 巧妙借用了亮色模式的 `surface` 色值作为暗色的文字主色。它是一种极度温润的骨白色，在深褐灰底上对比度充足（符合 WCAG 标准）且极其柔和。
*   **`textSecondary` / `textMuted` (#b8b2a7 / #8f8a81):** 色相保持在暖咖系，仅通过明度拉开差距。让辅助文字、时间戳、占位符自然融入背景。

**3. Accent 与语义色的暖暗域适配**
*   **`accent` (#d47a5a):** 珊瑚色在纯黑底上会显得刺眼，但在 `#332e2a` 的深暖底上，我们需要降低一点点亮度，增加一点点红相，使其变得像一块**烧红的陶土**，保持品牌 Voltage 的同时不破坏夜间护眼逻辑。
*   **`onAccent` (#1a1614):** 按钮文字不再是刺眼的白色或纯黑，而是极深的暖黑色，让 Coral 按钮像一块浑然一体的实心材质。
*   **`teal` (#6abcb0) / `amber` (#e0a963):** 作为系统辅助色（如大模型思考状态、节点连接），进行了微调，褪去了原有的“高饱和数字感”，转为类似复古印刷海报中的莫兰迪质感。

**4. 气泡与对话动线的空间关系**
在 AI Agent 的对话流中，气泡颜色的对比决定了人机交互的节奏：
*   **`userBubble` (#423c36):** 与 `surfaceElevated` 保持一致。用户的输入是页面上最接近用户的实体，它从底色上**“浮起”**，带有主动权和清晰的边界。
*   **`assistantBubble` (transparent):** 保持全透，Claude / Agent 的回复直接印在 Canvas 上，传达“系统本身即是 AI，而非另一个拟人化用户”的无界感。
*   **`toolBubble` (#24201d):** 与 `surface` 保持一致。当 Agent 调用工具（终端、代码、网络搜索）时，工具的运转过程和结果被安置在一个**“深凹入系统内部的作业井”**中。这在视觉上与纯对话文字形成了绝对的区隔，暗示“这是机器在后台的执行空间”。
---

## Original Prompt

```text
为 handAgent 桌面工具重新设计暗色主题的完整 token 方案。

## 背景
handAgent 是本地 AI agent 桌面工具。当前亮色主题的暖奶白底色（canvas=#faf9f5）很好，但暗色主题整页黑化（canvas=#181715），与产品'暖色底'的设计意图脱节。

## 设计要求
- 暗色模式不整页黑化，canvas 改为有暖色调的深色（类似深棕、深暖灰）
- 深色只用于功能性表面（输入框内部、代码区、工具结果面板），作为 canvas 之下的更深层
- 所有 surface 层级保持暖色调递进
- accent 保持 coral 系但适配暖色深底
- 保持和亮色主题的品牌一致性：coral 主色、teal/amber 辅助色

## 当前亮色 token（保持不变，作为参考）
canvas: #faf9f5
surface: #efe9de
surfaceSoft: #f5f0e8
surfaceElevated: #ffffff
surfaceMuted: #e8e0d2
hairline: #e6dfd8
hairlineSoft: #ebe6df
textPrimary: #141413
textSecondary: #6c6a64
textMuted: #8e8b82
accent: #cc785c
accentHover: #a9583e
accentPressed: #8f4731
accentSubtle: rgba(204,120,92,0.14)
accentRing: rgba(204,120,92,0.28)
onAccent: #ffffff
success: #5db872
warning: #d4a017
error: #c64545
teal: #5db8a6
amber: #e8a55a
userBubble: #f5e7de
assistantBubble: transparent
toolBubble: #f3eee6

## 当前暗色 token（需要全部重新设计）
canvas: #181715 ← 问题：纯黑，无暖色
surface: #1f1e1b
surfaceSoft: #252320
surfaceElevated: #2d2a26
surfaceMuted: #363229
hairline: rgba(250,249,245,0.12)
hairlineSoft: rgba(250,249,245,0.08)
textPrimary: #faf9f5
textSecondary: #c7c1b8
textMuted: #a09d96
accent: #d88a6d
accentHover: #e49b7f
accentPressed: #b7654c
accentSubtle: rgba(216,138,109,0.18)
accentRing: rgba(216,138,109,0.36)
onAccent: #141413
success: #70c987
warning: #e4b44c
error: #e16868
teal: #75cab9
amber: #efb66e
userBubble: #302821
assistantBubble: transparent
toolBubble: #252320

## 输出要求
为每个 token 提供新的 hex 值（rgba 也可以），并解释设计逻辑：
1. 表面层级系统：canvas → surface → surfaceSoft → surfaceElevated → surfaceMuted 的暖色递进关系
2. 功能性深色层：输入框、代码区用什么颜色（比 canvas 更深的层）
3. 文字层级：textPrimary/Secondary/Muted 在暖色深底上的对比度
4. accent 和语义色在暖色深底上的适配
5. bubble 颜色：userBubble/toolBubble 在暖色深底上的区分
```

### Referenced Files
- /Users/mu9/proj/handAgent/design/tokens.json
- /Users/mu9/proj/handAgent/DESIGN.md
