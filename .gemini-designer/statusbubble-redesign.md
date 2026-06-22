以下是为 handAgent StatusBubble 提供的视觉重构设计方案。

### 1. 核心视觉判断 (Core Visual Judgment)
当前的 StatusBubble 视觉语言停留在“通用 SaaS 仪表盘”的刻板印象中：高饱和度的霓虹状态色（亮蓝、亮绿）、带有塑料光泽的线性渐变、以及生硬的呼吸阴影。
**重构方向：编辑化伴侣 (Editorial Companion)。** 
在 Claude/Anthropic 的设计系统中，UI 应该像高质量的印刷品或物理文具。这个悬浮气泡不应该是“警报器”，而是一枚安静、有质感的“镇纸”或“书签”。它的材质应该是沉稳的不透明色块加上极细的物理描边，状态指示灯的闪烁应该像墨水晕染或呼吸，而非刺眼的 LED 灯。我们必须彻底剥离玻璃拟物（Glassmorphism）和渐变高光，回归系统的**暖色/低对比度/高触感**特质。

### 2. 要避免的陈词滥调 (Cliches to avoid)
*   **塑料质感渐变 (Plastic Gloss)**：坚决删除代码中的 `linear-gradient(135deg, ...)` 高光，Claude 系统推崇绝对的 Flat Color 搭配细线（Hairline）。
*   **赛博朋克霓虹色 (Neon Dashboard Colors)**：抛弃 `#77b7ff`（亮蓝）和 `#5ee6b8`（荧光绿）。AI 的思考不需要用科幻色彩来表达。
*   **跳跃的悬浮交互 (Bouncy Hover)**：移除 `translateY(-1px)`。优质的界面不需要通过上下位移来证明自己可点击，靠材质颜色的细微加深或点击下压（Scale）即可。

---

### 3. 具体实施方案 (Implementation Details)

#### 1 & 2. 亮色/暗色主题基础 Token 映射
彻底摒弃与设计系统无关的色值，直接使用 `tokens.json` 及你提供的新暗色 Token。背景色应具备轻微的透明度以适应 Electron 的桌面悬浮场景，但整体保持“实色块”的视觉感受。

**亮色主题 (Light Mode):**
*   `--bubble-surface`: `rgba(250, 249, 245, 0.94)` (基于 Canvas `#faf9f5` 赋予轻微系统透明度)
*   `--bubble-surface-strong`: `#efe9de` (Surface 实色，Hover 用)
*   `--bubble-border`: `#e6dfd8` (Hairline)
*   `--bubble-text`: `#141413` (TextPrimary)
*   `--bubble-detail`: `#8e8b82` (TextMuted)
*   `--bubble-shadow`: `0 8px 24px rgba(20, 20, 19, 0.12), 0 2px 6px rgba(20, 20, 19, 0.06)` (更柔和、多层级的物理阴影)
*   `--bubble-highlight`: **删除该变量**。去掉 CSS 中的 `linear-gradient` 高光。

**暗色主题 (Dark Mode - 基于你提供的新值):**
*   `--bubble-surface`: `rgba(36, 32, 29, 0.94)` (基于 Surface `#24201d` 赋予轻微系统透明度)
*   `--bubble-surface-strong`: `#423c36` (SurfaceElevated 实色，Hover 用)
*   `--bubble-border`: `rgba(239, 233, 222, 0.08)` (使用 TextPrimary 的超低透明度作为暗色描边)
*   `--bubble-text`: `#efe9de` (TextPrimary)
*   `--bubble-detail`: `#8f8a81` (TextMuted)
*   `--bubble-shadow`: `0 12px 32px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.2)`
*   `--bubble-highlight`: **删除该变量**。改为在 bubble 上使用 `inset 0 1px 0 rgba(239, 233, 222, 0.06)` 模拟极弱的物理边缘反光（非渐变）。

#### 3. 状态颜色 (State Colors) 重新定义
将状态颜色收敛到 DESIGN.md 的核心色系中。不要使用蓝/荧光色，用品牌的温暖色调来传达信息。

*   **idle (空闲)**: 
    *   Light: `#8e8b82` (TextMuted)
    *   Dark: `#8f8a81` (TextMuted)
    *   *表达：安静、退场，等待唤醒。*
*   **running (运行中 / 推理中)**: 
    *   Light: `#cc785c` (Accent / Coral)
    *   Dark: `#d47a5a` (Accent)
    *   *表达：品牌标志性的珊瑚色代表核心计算、正在思考。这是整个系统的 Brand Voltage 所在。*
*   **tool (工具调用中)**: 
    *   Light: `#5db8a6` (Teal)
    *   Dark: `#6abcb0` (Teal)
    *   *表达：客观、冷静的外部连接动作。*
*   **waiting (等待用户输入)**: 
    *   Light: `#e8a55a` (Amber)
    *   Dark: `#e0a963` (Amber)
    *   *表达：需要注意力的中位悬停状态。*
*   **done (完成)**: 
    *   Light: `#5db872` (Success)
    *   Dark: `#69b578` (Success)
*   **error (错误)**: 
    *   Light: `#c64545` (Error)
    *   Dark: `#d16464` (Error)

#### 4. 尺寸、圆角与排版结构调整
*   **高度与内间距**：现有的 `60px` 偏厚重，显得不够精致。建议将高度改为 `auto`，利用 padding 撑起尺寸：`padding: 12px 16px;`。
*   **圆角 (Radius)**：保持 `12px` (对应 `rounded.lg` 和 token 中的 `bubble`)，这在当前尺寸下是最协调的微观卡片圆角。
*   **排版层级**：
    *   `label`: `14px`，保持粗细在 `500` 或 `600` (StyreneB/Inter)，不建议用 `700`，在深色暖墨水下 `700` 会糊糊的。
    *   `detail`: `13px` (使用 `captionSize`)，行高 `1.4`。当前代码中的 `12px` 过小，缺乏排版呼吸感。

#### 5. 动画重构 (Motion)
当前的 `box-shadow` 脉冲动画有三个问题：1. 性能开销大；2. 缩放比例突兀；3. 视觉上像刺眼的警报。
**新动画思路：柔和的透明度扩散 (Ink Bloom)**
不要使用硬边缘的 shadow。改用伪元素（`::after`）做 scale 和 opacity 的动画。
```css
.activity-bubble__pulse {
  position: relative;
  width: 8px; /* 从10px缩小到8px，更精致 */
  height: 8px;
  border-radius: 50%;
  background: var(--bubble-accent);
}

/* 仅在需要呼吸的状态下添加 */
.activity-bubble--running .activity-bubble__pulse::after,
.activity-bubble--tool .activity-bubble__pulse::after,
.activity-bubble--waiting .activity-bubble__pulse::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: inherit;
  animation: pulse-bloom 2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
}

@keyframes pulse-bloom {
  0% { transform: scale(1); opacity: 0.6; }
  70% { transform: scale(2.8); opacity: 0; }
  100% { transform: scale(2.8); opacity: 0; }
}
```
*判断理由：`2s` 的长周期配合 `cubic-bezier` 缓动，让闪烁像是有规律的缓慢呼吸，而不是急促的机器滴答声。*

#### 6. 交互响应 (Hover & Focus)
移除 `translateY(-1px)` 这种略显廉价的物理漂浮感。
*   **Hover**: 只需要颜色的加深。将背景平滑过渡到 `--bubble-surface-strong`。
*   **Active (按下)**: 增加一个微小的物理压迫感：`transform: scale(0.98);`。这比 hover 漂浮更能提供真实的物理反馈。
*   **Focus**: 当前的 `outline: 2px solid var(--bubble-accent); outline-offset: 2px;` 逻辑正确，但建议将 outline 颜色固定为品牌强色（Coral/Accent），避免 Error 或 Idle 状态下 Focus 环颜色显得怪异。

### 总结实施建议
你的核心任务是**“去 SaaS 化”**。剥离所有让它看起来像传统软件后台的元素（渐变、强光、冷色调、剧烈抖动）。利用 `Canvas`（暖白）与 `Coral`（珊瑚）的品牌对撞，让这个气泡成为屏幕角落里一块拥有良好材质质感、安静且专业的“数字文具”。
---

## Original Prompt

```text
为 handAgent 的 Electron StatusBubble 生成详细的视觉重构设计方案。

## StatusBubble 是什么
小型浮动状态气泡，Electron 独立 BrowserWindow。显示 AI agent 当前运行状态（idle/running/tool/waiting/done/error），点击聚焦 ThreadWindow。

## 当前代码结构和视觉问题

### 结构（App.tsx）
- button: grid 12px+auto列，gap 10px，align-items center
- pulse圈: 10×10 圆，动画呼吸效果
- content区: label(14px bold) + detail(12px)
- 点击: focusThread

### 样式（styles.css）
- 尺寸: max 256px宽，60px高，padding 10px 14px
- 圆角: 12px
- 亮色:
  - bubble-surface: rgba(255,255,255,0.86) — 和主题系统完全无关！
  - bubble-text: #171613
  - bubble-detail: rgba(62,57,49,0.72)
  - bubble-shadow: 0 14px 36px rgba(62,50,36,0.16)
  - bubble-highlight: rgba(255,255,255,0.78)（线性渐变高光）
- 暗色:
  - bubble-surface: rgba(31,30,27,0.84) — 和主题系统完全无关！
  - bubble-text: #faf9f5
  - bubble-detail: rgba(250,249,245,0.70)
  - bubble-shadow: 0 16px 38px rgba(0,0,0,0.34)
- 状态颜色（完全脱离 DESIGN.md 色系）：
  - idle: #9aa4b2（冷蓝灰）→ 应该用 muted 系
  - running: #77b7ff（亮蓝）→ 应该用 accent/coral 系
  - tool: #5ee6b8（亮绿）→ 应该用 teal 系
  - waiting: #ffd166（亮黄）→ 应该用 amber 系
  - done: #9ce27f（亮绿）→ 应该用 success 系
  - error: #ff7a7a（亮红）→ 应该用 error 系
- hover: translateY(-1px) + surface-strong
- 动画: pulse 呼吸 1.4s（running/tool/waiting 态）

## 新的暗色主题 token（已确定）
canvas: #332e2a
surface: #24201d
surfaceElevated: #423c36
accent: #d47a5a
teal: #6abcb0
amber: #e0a963
success: #69b578
error: #d16464
textPrimary: #efe9de
textMuted: #8f8a81

## 设计方向
- 状态颜色统一到 DESIGN.md 色系（coral/teal/amber/success/error）
- 表面颜色使用主题系统的 token
- 安静高效，不过度装饰

## 请提供
1. 亮色主题下的 bubble-surface/text/detail/shadow/highlight 改用什么 token 值
2. 暗色主题下对应的值
3. 6种状态颜色的新值，基于 DESIGN.md 色系：
   - idle: 用什么颜色（muted系？textMuted？）
   - running: 用什么颜色（accent/coral系？）
   - tool: 用什么颜色（teal系？）
   - waiting: 用什么颜色（amber系？）
   - done: 用什么颜色（success系？）
   - error: 用什么颜色（error系？）
4. 尺寸、圆角、阴影是否需要调整
5. pulse 动画的调整建议
6. hover 效果的调整建议
所有建议给具体的颜色值和数值。
```

### Referenced Files
- /Users/mu9/proj/handAgent/apps/electron-shell/src/activity-window/styles.css
- /Users/mu9/proj/handAgent/apps/electron-shell/src/activity-window/App.tsx
- /Users/mu9/proj/handAgent/DESIGN.md
- /Users/mu9/proj/handAgent/design/tokens.json
