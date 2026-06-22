# 前端视觉重构设计文档

> 本文档是 handAgent 全界面视觉重构的完整设计规格。所有数值已确认，可直接用于实现。
>
> Gemini 设计方案原文（供上下文参考）：
> - [暗色主题 Token 重设计](../.gemini-designer/dark-theme-token-redesign.md)
> - [PromptPanel 重构](../.gemini-designer/promptpanel-redesign.md)
> - [Settings 重构](../.gemini-designer/settings-redesign.md)
> - [ThreadWindow 重构](../.gemini-designer/threadwindow-redesign.md)
> - [StatusBubble 重构](../.gemini-designer/statusbubble-redesign.md)

## 目标和边界

**目标**：把 handAgent 的全部可见前端统一成"安静高效的日常工具"。

- 亮暗主题都保留 DESIGN.md 的暖色底，暗色不整页黑化
- 深色只用于功能区（输入框、代码区、工具结果）
- 覆盖 Swift PromptPanel、Swift Settings、React ThreadWindow、Electron StatusBubble
- 允许调整页面布局、信息分组、按钮位置
- 说明文字默认只保留短标题和必要状态，详细说明放到 `?` 图标提示

**非目标**：

- 不新增 Swift ThreadWindow 或 Swift StatusBubble
- 不改变主题偏好链路（Swift 写入端，React 消费端）
- 不把这次做成重装饰或强动效
- Sidebar 拖拽宽度留下一轮

---

## 一、暗色主题 Token 重设计

### 设计原则

1. **复用 primary 色相**：暗色系所有 surface 从 `#cc785c` 的色相 (H≈16-20°) 派生，不发明新色相。
2. **下沉式层级**：canvas 是页面地表（中深暖灰），surface 向下沉（代码区更深），elevated 向上浮（弹窗更亮）。
3. **accent 亮暗一致**：暗色 accent 直接使用 `#cc785c`，不另造淡化变体。语义色（success/teal/amber/error/warning）也亮暗一致。

### Token 对照表

> **色相说明**：canvas 和所有 surface 的色相统一在 H≈18° (primary 的橙暖色相)，仅通过 S/L 拉开层级。

| Token | 亮色（不变） | 旧暗色 | **新暗色** | 设计逻辑 |
|-------|------------|--------|-----------|---------|
| canvas | `#faf9f5` | `#181715` | **`#2a2522`** | 暖色地表 (H18° S8% L15%) |
| surface | `#efe9de` | `#1f1e1b` | **`#211e1b`** | 比 canvas 更深的凹槽——输入框/代码区 |
| surfaceSoft | `#f5f0e8` | `#252320` | **`#262320`** | canvas 与 surface 之间的过渡 |
| surfaceElevated | `#ffffff` | `#2d2a26` | **`#3a3530`** | 浮层/弹窗，比 canvas 亮 |
| surfaceMuted | `#e8e0d2` | `#363229` | **`#342f2a`** | hover 底色 |
| hairline | `#e6dfd8` | `rgba(250,249,245,0.12)` | **`#3e3833`** | 暖色实色细线 |
| hairlineSoft | `#ebe6df` | `rgba(250,249,245,0.08)` | **`#342f2a`** | 更弱的分割线（=surfaceMuted） |
| textPrimary | `#141413` | `#faf9f5` | **`#efe9de`** | 骨白，不割眼（复用亮色 surface 色值） |
| textSecondary | `#6c6a64` | `#c7c1b8` | **`#b8b2a7`** | 暖咖辅助 |
| textMuted | `#8e8b82` | `#a09d96` | **`#8e8b82`** | 与亮色完全一致 |
| **accent** | `#cc785c` | `#d88a6d` | **`#cc785c`** | **与亮色完全一致**——暖色深底对比度足够 |
| accentHover | `#a9583e` | `#e49b7f` | **`#e09880`** | 暗色 hover 提亮 |
| accentPressed | `#8f4731` | `#b7654c` | **`#a9583e`** | 与亮色 hover 色一致 |
| accentSubtle | `rgba(204,120,92,0.14)` | `rgba(216,138,109,0.18)` | **`rgba(204,120,92,0.18)`** | 基于同一个 primary 值 |
| accentRing | `rgba(204,120,92,0.28)` | `rgba(216,138,109,0.36)` | **`rgba(204,120,92,0.36)`** | 基于同一个 primary 值 |
| onAccent | `#ffffff` | `#141413` | **`#1a1614`** | 极深暖黑 |
| **success** | `#5db872` | `#70c987` | **`#5db872`** | **与亮色一致** |
| **warning** | `#d4a017` | `#e4b44c` | **`#d4a017`** | **与亮色一致** |
| **error** | `#c64545` | `#e16868` | **`#c64545`** | **与亮色一致** |
| **teal** | `#5db8a6` | `#75cab9` | **`#5db8a6`** | **与亮色一致** |
| **amber** | `#e8a55a` | `#efb66e` | **`#e8a55a`** | **与亮色一致** |
| userBubble | `#f5e7de` | `#302821` | **`#3a3530`** | =surfaceElevated，浮起感 |
| assistantBubble | `transparent` | `transparent` | **`transparent`** | 不变 |
| toolBubble | `#f3eee6` | `#252320` | **`#211e1b`** | =surface，下沉感 |

### 亮暗一致色汇总

以下 8 个色值亮暗完全相同，不需要在暗色主题中另造变体：

```
accent:  #cc785c    textMuted: #8e8b82
success: #5db872    warning:   #d4a017
error:   #c64545    teal:      #5db8a6
amber:   #e8a55a
```

### Surface 层级示意

```
                亮色                                暗色
                
  surfaceElevated (#ffffff)           surfaceElevated (#3a3530)  ↑ 浮层
  surfaceSoft     (#f5f0e8)           surfaceMuted    (#342f2a)  ↑ hover
  canvas          (#faf9f5)  ← 地表 → canvas          (#2a2522)  ← 地表
  surface         (#efe9de)           surfaceSoft     (#262320)  ↓ 过渡
  surfaceMuted    (#e8e0d2)           surface         (#211e1b)  ↓ 凹槽
```

---

## 二、PromptPanel 重构

> Gemini 方案原文：[promptpanel-redesign.md](../.gemini-designer/promptpanel-redesign.md)
> 核心方向："编辑部命令面板 (Editorial Command Palette)"

### 2.1 容器样式

| 属性 | 旧 | 新 | 说明 |
|------|---|---|------|
| padding | 32px (xl) | **16px (md)** | 减半 |
| minWidth | 640 | **600** | |
| minHeight | 420 | **420（保持）** | |
| maxHeight | 无 | **480** | 超出列表内部滚动 |
| 圆角 | 12px (lg) | **12px** | 保持 |
| 边框 | hairline 0.8px | **hairline 0.8px** | 保持 |
| 背景 | canvas.opacity(0.97) | **canvas.opacity(0.97)** | 保持 |
| 阴影 | ink 14%, r:26, y:18 | **ink 12%, r:32, y:12** | 更柔和 |

### 2.2 布局顺序（变化）

```
旧: chipRow → firstRow → banner → divider → actionList
新: firstRow → chipRow → banner → divider → actionList
```

输入框在最顶部作为首要视觉锚点，chips 作为输入补充贴在下方。

### 2.3 间距系统

VStack spacing 从 `24px (lg)` 改为 **`0`**，各模块自控间距：

| 区域间隔 | 间距 |
|---------|------|
| input ↔ chip | 8px |
| chip ↔ banner (或 divider) | 16px |
| divider ↔ actionList | 8px |

### 2.4 输入行

| 属性 | 旧 | 新 |
|------|---|---|
| input↔settings 间距 | 16px (md) | **12px (sm)** |
| settings 按钮默认色 | textSecondary | **mutedSoft**（hover 恢复 textSecondary） |
| settings 按钮尺寸 | 32×32 | **32×32** | 保持 |

### 2.5 Chip 区域

| 属性 | 旧 | 新 |
|------|---|---|
| HStack 间距 | 12px (sm) | **6px** |
| Chip padding | v:5 h:10/4 | **v:4 h:8** |
| Chip 字号 | 13px (caption) | **12px** |
| 普通 Chip 材质 | hairline 边框 + surfaceSoft | **surfaceSoft 底色，无边框** |
| Image/Skill Chip 材质 | accentRing 边框 | **surfaceCard 底色，无边框，icon 用 accent 色** |
| Error Chip 材质 | error 边框 | **surfaceSoft 底色 + 1px error 边框** |
| xmark 间距 | 6px | **4px** |

### 2.6 Action 列表

| 属性 | 旧 | 新 |
|------|---|---|
| 行间距 (VStack spacing) | 8px (xs) | **2px** |
| 行内 padding | v:9 h:16 | **v:8 h:12** |
| title 字号 | bodyFont (15px) | **14px weight:500** |
| description 字号 | captionFont (13px) | **12px weight:400** |
| title↔description 间距 | 3px | **2px** |
| 高亮态 | surfaceHover + accentRing 边框 | **surfaceHover 底色，无边框** |
| Trigger Pill 形状 | Capsule 胶囊 | **RoundedRectangle r:4px（键帽风格）** |
| Trigger Pill 材质 | surfaceSoft/surfaceHover 底色 | **无底色，高亮行时 hairline 描边** |

---

## 三、Settings 重构

> Gemini 方案原文：[settings-redesign.md](../.gemini-designer/settings-redesign.md)
> 核心方向："排版级安静画布 (Editorial Canvas)"

### 3.1 窗口尺寸

| 旧 | 新 |
|---|---|
| 660×520 | **680×560** |

### 3.2 Tab 栏

| 属性 | 旧 | 新 |
|------|---|---|
| 总高度 | ~80pt | **~48pt** |
| 背景 | surfaceSoft | **transparent**（底部 0.5px hairline 分割） |
| HStack spacing | 12px (sm) | **4px** |
| padding horizontal | 24px (lg) | **24px** |
| padding vertical | 12px (sm) | **8px** |
| 单个 Tab 高度 | 56pt | **32pt** |
| 图标 | 20pt | **14pt** (frame 高 16pt) |
| 文字 | 11pt | **11pt** |
| VStack spacing | 4 | **2** |
| 选中态 | canvas 背景 + accentRing 边框 + accent 底部指示条 | **只保留 canvas 背景填充**（去掉边框和指示条） |
| 未选中文字 | muted | **muted** |
| 选中文字 | ink | **ink** |

### 3.3 内容区

| 属性 | 旧 | 新 |
|------|---|---|
| Section h-padding | 48px (xxl) | **32px (xl)** |
| CommonRow label 宽 | 120px | **140px** |
| CommonRow 中轴间距 | 32px (xl) | **16px (md)** |
| CommonRow control 最大宽 | 340px | **420px** |
| CommonRow v-padding | 16px (md) | **12px** |
| Divider leading | 152px | **188px**（对齐 Control 区左边缘 = 32+140+16） |
| Divider 颜色 | hairline | **hairlineSoft** |

### 3.4 SectionHeader 重排

| 属性 | 旧 | 新 |
|------|---|---|
| 对齐 | 全宽左对齐，h-padding 48px | **X 轴起点对齐 Control 区左边缘**（距左侧 32+140+16=188px） |
| 字号 | captionFont.semibold (13px) | **12px semibold** |
| letter-spacing | 0 | **+1px** |
| padding top | 24px (lg) | **24px** |
| padding bottom | 8px (xs) | **12px** |

### 3.5 说明文字 → `?` 提示系统

将设置项的长说明文字收进交互式 `?` 图标：

- **图标位置**：Row 的 Control 组件后方（Trailing）
- **图标样式**：`questionmark.circle`，14×14px
- **颜色**：常态 `mutedSoft`，hover 态 `ink`
- **交互**：原生 `.help()` tooltip 或自定义 NSPopover
- **浮层材质**：深色背景 (`surfaceDark` 概念)，文字 `onDark`，12px body-sm，行高 1.4，内边距 12px，最大宽 260px

---

## 四、ThreadWindow 重构

> Gemini 方案原文：[threadwindow-redesign.md](../.gemini-designer/threadwindow-redesign.md)
> 核心方向："安静的编辑部工作台 (Quiet Editorial Workspace)"

### 4.1 全局

| 属性 | 旧 | 新 |
|------|---|---|
| 背景 glow | coral 14% + teal 12% | **coral 6% + teal 4%** |
| Sidebar 宽度 | 30% clamp(220,320) | **保持当前逻辑（拖拽留下一轮）** |

glow 具体值：
```css
/* 亮色 */
--thread-window-glow-warm: color-mix(in srgb, var(--ha-color-accent) 6%, transparent);
--thread-window-glow-cool: color-mix(in srgb, var(--ha-color-teal) 4%, transparent);

/* 暗色同比例 */
--thread-window-glow-warm: color-mix(in srgb, var(--ha-color-accent) 5%, transparent);
--thread-window-glow-cool: color-mix(in srgb, var(--ha-color-teal) 3%, transparent);
```

### 4.2 HistorySidebar 头部重构

当前约 160px 高度，重构后约 **80px**。

**删除项**：
- ❌ HandAgent Logo (SVG 六边形)
- ❌ "HandAgent" 显示字体标题
- ❌ "本地 thread 工作台" 描述
- ❌ 全宽 "新建对话" 大按钮

**新布局**（两行）：

```
第一行 (h-8, ~32px)：
┌────────────────────────────────┐
│  [+新建 28×28]                 │
└────────────────────────────────┘

第二行 (h-8, ~32px)：
┌────────────────────────────────┐
│  🔍 搜索对话...                │
└────────────────────────────────┘
```

- **新建按钮**：`+` 图标按钮，28×28，常态 `text-app-text-secondary bg-transparent`，hover `bg-app-surface-muted`
- **搜索框**：高度从 h-10 → **h-8**（32px），默认 `bg-app-surface-muted` 无边框，focus 时 `border-app-accent ring-4 ring-app-accent-ring`

### 4.3 消息区优化

#### User Bubble

| 属性 | 旧 | 新 |
|------|---|---|
| 最大宽度 | 85% | **75%** |
| 背景 | bg-app-user-bubble | **bg-app-user-bubble** |
| 边框 | border-app-hairline/70 | **border-app-hairline/70** |
| 阴影 | shadow-soft | **去掉** |
| 圆角 | rounded-2xl (16px) | **rounded-2xl (16px)** |

#### Assistant Bubble

保持不变：全宽，bg-transparent，text-app-text-primary。

#### Tool Bubble

| 属性 | 旧 | 新 |
|------|---|---|
| 背景 | bg-app-tool-bubble/70 | **bg-app-tool-bubble**（去掉 /70 透明度） |
| 边框 | border-app-hairline | **去掉** |
| 阴影 | shadow-product-inner | **去掉** |
| 圆角 | rounded-xl (12px) | **rounded-xl** |

#### 消息操作按钮

| 属性 | 旧 | 新 |
|------|---|---|
| 显示方式 | opacity-0 hover 时显示 | **固定显示** |
| 内容 | 文字（复制/编辑/重新生成） | **只保留 icon** |
| 编辑/重新生成 | disabled + "即将推出" title | **disabled + title 提示** |

#### 空状态

| 旧 | 新 |
|---|---|
| 卡片容器 + Display 字体 30px "准备开始" + 副标题 | **极简提示语：`text-sm text-app-text-muted` "选择历史或创建新对话"，无卡片无边框，居中** |

MessageList 内部空状态（"等待输入"）同理简化：去掉卡片容器和 Display 字体。

### 4.4 Composer

| 属性 | 旧 | 新 |
|------|---|---|
| 输入框圆角 | rounded-3xl (24px) | **rounded-3xl（保持）** |
| 按钮尺寸 | h-9 w-9 | **h-8 w-8** |
| 容器 bg | bg-app-canvas/85 | **bg-app-canvas/85** |

---

## 五、StatusBubble 重构

> Gemini 方案原文：[statusbubble-redesign.md](../.gemini-designer/statusbubble-redesign.md)
> 核心方向："编辑化伴侣 (Editorial Companion)"

### 5.1 尺寸和形状

| 属性 | 旧 | 新 |
|------|---|---|
| 高度 | 60px | **60px（保持）** |
| 最大宽度 | 256px | **256px** |
| 圆角 | 12px | **12px** |
| padding | 10px 14px | **12px 16px** |

### 5.2 表面颜色（统一到主题系统）

| 变量 | 亮色旧 | 亮色新 | 暗色旧 | 暗色新 |
|------|--------|-------|--------|-------|
| bubble-surface | `rgba(255,255,255,0.86)` | **`rgba(250,249,245,0.94)`** (canvas) | `rgba(31,30,27,0.84)` | **`rgba(33,30,27,0.94)`** (surface) |
| bubble-surface-strong | — | **`#efe9de`** (surface) | — | **`#3a3530`** (surfaceElevated) |
| bubble-border | 自定义 | **`#e6dfd8`** (hairline) | 自定义 | **`rgba(239,233,222,0.08)`** |
| bubble-text | `#171613` | **`#141413`** (textPrimary) | `#faf9f5` | **`#efe9de`** (textPrimary) |
| bubble-detail | `rgba(62,57,49,0.72)` | **`#8e8b82`** (textMuted) | `rgba(250,249,245,0.70)` | **`#8e8b82`** (textMuted) |
| bubble-shadow | `0 14px 36px rgba(62,50,36,0.16)` | **`0 8px 24px rgba(20,20,19,0.12), 0 2px 6px rgba(20,20,19,0.06)`** | `0 16px 38px rgba(0,0,0,0.34)` | **`0 12px 32px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.2)`** |
| bubble-highlight | `rgba(255,255,255,0.78)` | **删除**（去掉 linear-gradient） | — | **删除** |

### 5.3 状态颜色（统一到 DESIGN.md 色系）

> **关键原则**：所有状态颜色亮暗一致，直接复用主题 token 值。

| 状态 | 旧值 | **新值（亮暗一致）** | 来源 |
|------|------|---------------------|------|
| idle | `#9aa4b2` (冷蓝灰) | **`#8e8b82`** | textMuted |
| running | `#77b7ff` (亮蓝) | **`#cc785c`** | accent (primary) |
| tool | `#5ee6b8` (荧光绿) | **`#5db8a6`** | teal |
| waiting | `#ffd166` (亮黄) | **`#e8a55a`** | amber |
| done | `#9ce27f` (亮绿) | **`#5db872`** | success |
| error | `#ff7a7a` (亮红) | **`#c64545`** | error |

### 5.4 交互调整

| 属性 | 旧 | 新 |
|------|---|---|
| hover | `translateY(-1px)` + surface-strong | **只变色到 bubble-surface-strong，去掉位移** |
| active | 无 | **`transform: scale(0.98)`** |
| focus | `outline: 2px solid accent` | **固定用 accent 色，不随状态变** |

### 5.5 排版

| 属性 | 旧 | 新 |
|------|---|---|
| label font-weight | 700 | **600** |
| detail 字号 | 12px | **13px** |
| detail 行高 | 1.25 | **1.4** |

### 5.6 动画

| 属性 | 旧 | 新 |
|------|---|---|
| pulse 圆点 | 10px | **8px** |
| 动画方式 | box-shadow 呼吸 1.4s | **::after 伪元素 scale+opacity 2s** |

新动画 CSS：
```css
.activity-bubble__pulse {
  position: relative;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--bubble-accent);
}

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

---

## 涉及文件清单

### Token 管道（修改 → 生成）

1. `design/tokens.json` — 修改 dark 主题全部色值
2. `scripts/generate-theme-tokens.mjs` — 不修改（生成器逻辑不变）
3. 生成输出：
   - `apps/desktop/Sources/Theme/GeneratedThemeTokens.swift`
   - `apps/thread-window-web/src/styles/generated-theme.css`

### Swift PromptPanel

4. `apps/desktop/Sources/PromptPanel/PromptPanelStyles.swift` — 容器 padding、阴影
5. `apps/desktop/Sources/PromptPanel/PromptPanelView.swift` — 布局顺序、间距、chip/action 样式
6. `apps/desktop/Sources/PromptPanel/PromptPanelInputLayout.swift` — emptyDraftTextWidth 调整

### Swift Settings

7. `apps/desktop/Sources/Settings/SettingsStyles.swift` — Tab 栏重构
8. `apps/desktop/Sources/Settings/SettingsView.swift` — 窗口尺寸
9. `apps/desktop/Sources/Common/CommonComponents.swift` — Row 布局、SectionHeader

### React ThreadWindow

10. `apps/thread-window-web/src/styles/tailwind.css` — glow 减弱
11. `apps/thread-window-web/src/App.tsx` — glow CSS 值
12. `apps/thread-window-web/src/components/HistorySidebar.tsx` — 头部重构
13. `apps/thread-window-web/src/components/MessageBubble.tsx` — bubble 样式、操作按钮
14. `apps/thread-window-web/src/components/MessageList.tsx` — 空状态
15. `apps/thread-window-web/src/components/Composer.tsx` — 按钮尺寸
16. `apps/thread-window-web/src/components/ThreadWorkspacePane.tsx` — 空状态

### Electron StatusBubble

17. `apps/electron-shell/src/activity-window/styles.css` — 全部重写
