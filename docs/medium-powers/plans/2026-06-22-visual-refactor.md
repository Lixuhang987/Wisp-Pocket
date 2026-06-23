# 前端视觉重构 Implementation Plan

> Spec: `docs/visual-refactor-spec.md` + `docs/visual-refactor-design.md`
> 5 个阶段按依赖顺序执行，每阶段独立可验证。

## Scope Check

本 spec 覆盖 5 个子系统（token 管道、Swift PromptPanel、Swift Settings、React ThreadWindow、Electron StatusBubble），但它们共享一条依赖链：阶段 1 的 token 变更是后续所有阶段的视觉基础。因此不拆分为独立 plan，按 spec 的 5 阶段顺序在一个 plan 中执行。

## 现有流清单 (Existing Flow Inventory)

### Token 管道

- **源**：`design/tokens.json` — `color.dark` section 包含 24 个 token（canvas、surface×4、hairline×2、text×3、accent×6、semantic×5、bubble×3）
- **生成器**：`scripts/generate-theme-tokens.mjs` — 读 JSON，输出 Swift (`GeneratedThemeTokens.swift`) 和 CSS (`generated-theme.css`)
- **Swift 消费**：`AppTheme.swift` 把生成的 `ColorSet` 映射为 SwiftUI `Color`，注入 `@Environment(\.appTheme)`
- **CSS 消费**：Tailwind `@theme` block 把 `--ha-color-*` 映射为 `--color-app-*` utility

不需要修改生成器或消费层，只替换 `tokens.json` 中的暗色值即可。

### Swift PromptPanel 样式

- **容器**：`PromptPanelContainerModifier` — padding `xl`(32)、minWidth 640、shadow ink 14%/r:26/y:18
- **布局**：`PromptPanelView.body` — VStack spacing `lg`(24)，顺序：chipRow → firstRow → banner → divider → actionList
- **Action row**：`ActionRowModifier` — v-padding 9、h-padding `md`(16)、高亮态 surfaceHover + accentRing 边框
- **Trigger pill**：`PromptPanelTriggerPillModifier` — Capsule 形状、surfaceSoft/surfaceHover 底色、accentRing/hairlineSoft 描边
- **Chip**：chipView — HStack spacing 6、padding leading:10 trailing:4 v:5、captionFont(13px)、accentRing 边框(image/skill)

### Swift Settings 样式

- **窗口**：`SettingsView.body` — frame width:660 height:520
- **Tab 栏**：`SettingsTabBar` — HStack spacing `sm`(12)、h-padding `lg`(24)、v-padding `sm`(12)、surfaceSoft 背景、图标 20pt、高度 56pt、VStack spacing 4、选中态 = canvas fill + accentRing 边框 + accent 底部指示条
- **内容区**：`CommonComponents.swift` — `CommonSection` h-padding `xxl`(48)、`CommonRow` labelWidth 120、spacing `xl`(32)、controlMaxWidth 340、v-padding `md`(16)、`CommonRowDivider` leading 152、`CommonSectionHeader` h-padding `xxl`(48)、captionFont.weight(.semibold)

### React ThreadWindow 样式

- **Glow**：`tailwind.css` — light: accent 14% + teal 12%；dark: accent 13% + teal 10%
- **HistorySidebar 头部**：logo SVG + "HandAgent" 标题 + 描述 + 全宽新建按钮 + 搜索框 h-10
- **User bubble**：max-w-[85%] + shadow-soft
- **Tool bubble**：border-app-hairline + shadow-product-inner + bg-app-tool-bubble/70
- **消息操作按钮**：opacity-0 hover 显示 + 文字标签
- **空状态**：卡片容器 + Display 字体
- **Composer 按钮**：h-9 w-9

### Electron StatusBubble 样式

- **表面**：`styles.css` — 独立 `--bubble-*` 变量系统
- **状态颜色**：6 个独立色值（冷蓝灰/亮蓝/荧光绿/亮黄/亮绿/亮红）
- **交互**：hover translateY(-1px)
- **动画**：box-shadow 呼吸 1.4s
- **排版**：label 700、detail 12px/1.25

---

## 阶段 1：暗色主题 Token

### Goal

替换 `design/tokens.json` 的 `color.dark` 全部 24 个值为设计文档中的新值，运行生成器重新生成 Swift 和 CSS token 文件。

### Core structure

无新类型。只修改 JSON 数据值。

### Use case map

```
tokens.json[color.dark] 值替换 → generate-theme-tokens.mjs →
  GeneratedThemeTokens.swift(dark ColorSet) +
  generated-theme.css(:root[data-theme="dark"])
→ Swift @Environment(\.appTheme) + CSS var(--ha-color-*) 消费层自动生效
```

### 验证

- `node scripts/generate-theme-tokens.mjs` 成功
- `bash ./scripts/test.sh` 通过
- `bash ./scripts/swiftw build` 通过
- 生成文件 diff 中 dark 值与设计文档对照表完全一致

---

## 阶段 2：PromptPanel 重构

### Goal

调整 PromptPanel 的容器尺寸/阴影、布局顺序、间距系统、Chip 样式、Action 列表密度和 Trigger Pill 形状。

### Existing Flow Inventory

复用 `PromptPanelStyles.swift` 中的 4 个 ViewModifier + `PromptPanelView.swift` 中的 body 布局。不新增文件。

### Core structure

无新类型。修改现有 ViewModifier 参数和 View 布局。

### 具体变更清单

**PromptPanelStyles.swift:**

1. `PromptPanelContainerModifier`:
   - `.padding(theme.spacing.xl)` → `.padding(theme.spacing.md)` (32→16)
   - `.frame(minWidth: 640, minHeight: 420)` → `.frame(minWidth: 600, minHeight: 420, maxHeight: 480)`
   - `.shadow(color: theme.colors.ink.opacity(0.14), radius: 26, x: 0, y: 18)` → `.shadow(color: theme.colors.ink.opacity(0.12), radius: 32, x: 0, y: 12)`

2. `ActionRowModifier`:
   - `.padding(.vertical, 9)` → `.padding(.vertical, 8)`
   - `.padding(.horizontal, theme.spacing.md)` → `.padding(.horizontal, 12)`
   - 删除 `.overlay(RoundedRectangle... .strokeBorder(isHighlighted ? theme.colors.accentRing : ...))` — 高亮态去掉 accentRing 边框

3. `PromptPanelTriggerPillModifier`:
   - `Capsule()` → `RoundedRectangle(cornerRadius: 4)` 键帽风格
   - `.fill(isHighlighted ? theme.colors.surfaceHover : theme.colors.surfaceSoft)` → `.fill(Color.clear)` 无底色
   - `.strokeBorder(isHighlighted ? theme.colors.accentRing : theme.colors.hairlineSoft, lineWidth: 0.6)` → `.strokeBorder(isHighlighted ? theme.colors.hairline : Color.clear, lineWidth: 0.6)` 高亮行时 hairline 描边

**PromptPanelView.swift:**

4. Body VStack:
   - `VStack(alignment: .leading, spacing: theme.spacing.lg)` → `VStack(alignment: .leading, spacing: 0)` 各模块自控间距
   - 顺序改为：firstRow → chipRow → banner → divider → actionList
   - firstRow 后加 `.padding(.bottom, 8)` (input↔chip 8px)
   - chipRow 后加 `.padding(.bottom, 16)` (chip↔banner/divider 16px)
   - banner 后加 `.padding(.bottom, 16)` (如果没 banner 则 divider 前不加)
   - divider 后加 `.padding(.top, 0).padding(.bottom, 8)` (divider↔actionList 8px) — 实际用 Spacer 或 padding

5. FirstRow 内部:
   - `HStack(spacing: theme.spacing.md)` → `HStack(spacing: 12)` (input↔settings 16→12)
   - settings 按钮默认色: `theme.colors.textSecondary` → `theme.colors.mutedSoft` (hover 恢复 textSecondary)

6. Chip 区域:
   - `HStack(spacing: theme.spacing.sm)` → `HStack(spacing: 6)` (12→6)
   - chipView padding: `.padding(.leading, 10).padding(.trailing, 4).padding(.vertical, 5)` → `.padding(.horizontal, 8).padding(.vertical, 4)`
   - chip 字号: `theme.typography.captionFont` → `.font(.system(size: 12))`
   - 普通 Chip: surfaceSoft 底色 + hairline 边框 → surfaceSoft 底色 + 无边框 (border = Color.clear)
   - Image/Skill Chip: surfaceSoft + accentRing 边框 → surfaceCard 底色 + 无边框 + icon 用 accent 色 (保持)
   - Error Chip: surfaceSoft + error opacity 边框 → surfaceSoft 底色 + 1px error 边框 (保持现有，只确认 borderWidth)
   - xmark 间距: 6→4

7. Action 列表:
   - `LazyVStack(alignment: .leading, spacing: theme.spacing.xs)` → `LazyVStack(alignment: .leading, spacing: 2)` (8→2)
   - title 字号: `theme.typography.bodyFont` → `.font(.system(size: 14, weight: .medium))`
   - description 字号: `theme.typography.captionFont` → `.font(.system(size: 12, weight: .regular))`
   - title↔description spacing: `3` → `2`

### 验证

- `bash ./scripts/swiftw build` 通过
- 已有 `PromptPanelViewModelTests` / `PromptPanelAppearanceTests` 通过

---

## 阶段 3：Settings 重构

### Goal

调整 Settings 窗口尺寸、Tab 栏高度和选中态、内容区间距、SectionHeader 对齐，并将说明文字收进 `?` tooltip。

### Existing Flow Inventory

复用 `SettingsView.swift`、`SettingsStyles.swift`、`CommonComponents.swift`。Common 组件的 `CommonLayout` 常量是核心变更点。

### Core structure

新增：CommonRow 增加可选 `helpText: String?` 参数，渲染 `?` tooltip。

### 具体变更清单

**SettingsView.swift:**

1. `.frame(width: 660, height: 520)` → `.frame(width: 680, height: 560)`

**SettingsStyles.swift — SettingsTabBar:**

2. `HStack(spacing: theme.spacing.sm)` → `HStack(spacing: 4)` (12→4)
3. `.padding(.top, theme.spacing.sm).padding(.bottom, theme.spacing.sm)` → `.padding(.top, 8).padding(.bottom, 8)` (保持 8+8)
4. `.background(theme.colors.surfaceSoft)` → `.background(Color.clear)` + 底部 `overlay(alignment: .bottom)` 添加 0.5px hairline 分割
5. tab icon: `.font(.system(size: 20))` → `.font(.system(size: 14)).frame(height: 16)`
6. tab VStack spacing: `4` → `2`
7. tab minHeight: `56` → `32`
8. 选中态: 删除 `borderedCard` (canvas + accentRing 边框) + 删除底部指示条 → 只保留 `.background(theme.colors.canvas)` 填充 + `clipShape(RoundedRectangle(cornerRadius: theme.radius.md))`

**CommonComponents.swift:**

9. `CommonLayout.labelWidth`: `120` → `140`
10. `CommonLayout.dividerLeadingPadding`: `152` → `188` (32+140+16 对齐 Control 区左边缘)
11. `CommonLayout.controlMaxWidth`: `340` → `420`
12. `CommonSection` h-padding: `theme.spacing.xxl` → `theme.spacing.xl` (48→32)
13. `CommonRow` spacing: `theme.spacing.xl` → `theme.spacing.md` (32→16)
14. `CommonRow` v-padding: `theme.spacing.md` → `12` (16→12)
15. `CommonRowDivider` 颜色: `theme.colors.hairline` → `theme.colors.hairlineSoft`
16. `CommonSectionHeader`:
    - h-padding: `theme.spacing.xxl` → 使用 `.padding(.leading, 188)` 对齐 Control 区左边缘
    - 去掉 `.frame(maxWidth: .infinity, alignment: .leading)`，改为固定 leading padding
    - 字号 `.font(theme.typography.captionFont.weight(.semibold))` → `.font(.system(size: 12, weight: .semibold))`
    - 新增 `.tracking(1)` (letter-spacing +1px)
    - `.padding(.bottom, theme.spacing.xs)` → `.padding(.bottom, 12)` (8→12)

17. `CommonRow` 新增可选 `helpText` 参数：
    - Control 后方添加 `?` 图标按钮 (questionmark.circle, 14×14)
    - 常态 `mutedSoft`，hover `ink`
    - 使用 `.help()` modifier 或自定义 tooltip 浮层

### 说明文字 → tooltip 迁移

各 *SettingsView.swift 中的内联说明文字需要逐个迁移到对应 CommonRow 的 helpText 参数。这是逐文件的机械工作，在实现阶段由 subagent 处理。

### 验证

- `bash ./scripts/swiftw build` 通过
- Settings 窗口 9 个 Tab 都能正常显示
- Row 布局对齐正确

---

## 阶段 4：ThreadWindow 重构

### Goal

降低背景 glow 强度、重构 HistorySidebar 头部、优化消息 bubble 样式、操作按钮改为纯 icon + 固定显示、空状态简化、Composer 按钮缩小。

### Existing Flow Inventory

直接修改 CSS 和 React 组件的 className 属性。不需要新增组件或修改状态逻辑。

### 具体变更清单

**tailwind.css:**

1. light glow: accent `14%` → `6%`, teal `12%` → `4%`
2. dark glow: accent `13%` → `5%`, teal `10%` → `3%`

**HistorySidebar.tsx:**

3. 删除 header 内的 logo SVG + "HandAgent" h1 + 描述 p + 全宽新建按钮
4. 新布局第一行：`+` 图标按钮 28×28，`text-app-text-secondary bg-transparent`，hover `bg-app-surface-muted`
5. 新布局第二行：搜索框 h-10 → h-8，默认 `bg-app-surface-muted border-0`，focus `border-app-accent ring-4 ring-app-accent-ring`

**MessageBubble.tsx:**

6. User bubble: `max-w-[85%]` → `max-w-[75%]`，删除 `shadow-soft`
7. Tool bubble: 删除 `border border-app-hairline`，删除 `shadow-product-inner`，`bg-app-tool-bubble/70` → `bg-app-tool-bubble`
8. 操作按钮区: `opacity-0 ... group-hover:opacity-100` → 删除 opacity-0，固定显示
9. 文字标签 "复制"/"编辑"/"重新生成" → 只保留 icon（Copy/Pencil/RefreshCw from lucide-react）
10. 编辑/重新生成保持 disabled + title 提示

**MessageList.tsx:**

11. 空状态: 删除卡片容器 + Display 字体，改为 `text-sm text-app-text-muted` "等待输入"

**ThreadWorkspacePane.tsx:**

12. 无 thread 空状态: 删除卡片容器 + Display 字体 30px "准备开始"，改为 `text-sm text-app-text-muted` "选择历史或创建新对话"

**Composer.tsx:**

13. 按钮尺寸: `h-9 w-9` → `h-8 w-8`

### 验证

- `bash ./scripts/test.sh` 通过
- 视觉变更符合设计文档

---

## 阶段 5：StatusBubble 重构

### Goal

将 StatusBubble 的独立颜色系统统一到主题 token，调整交互和动画。

### Existing Flow Inventory

只修改 `apps/electron-shell/src/activity-window/styles.css`，全部是 CSS 变量和规则替换。

### 具体变更清单

**styles.css 完整重写：**

1. `:root` 表面变量替换为主题 token 值:
   - `--bubble-surface`: `rgba(255,255,255,0.86)` → `rgba(250,249,245,0.94)`
   - `--bubble-surface-strong`: 新增 `#efe9de`
   - `--bubble-border`: → `#e6dfd8`
   - `--bubble-text`: → `#141413`
   - `--bubble-detail`: → `#8e8b82`
   - `--bubble-shadow`: → `0 8px 24px rgba(20,20,19,0.12), 0 2px 6px rgba(20,20,19,0.06)`
   - 删除 `--bubble-highlight`

2. `:root[data-theme="dark"]` 同理替换暗色值

3. `.activity-bubble`:
   - `padding: 10px 14px` → `12px 16px`
   - 删除 `linear-gradient` 高光
   - `background: var(--bubble-surface)` 不再叠加 gradient

4. `.activity-bubble:hover`:
   - 删除 `transform: translateY(-1px)` → 只变色到 `--bubble-surface-strong`
   - 新增 `.activity-bubble:active { transform: scale(0.98) }`

5. `.activity-bubble:focus-visible`:
   - 固定用 accent 色 `#cc785c`（不随状态变）

6. 状态颜色统一:
   - idle: `#9aa4b2` → `#8e8b82`
   - running: `#77b7ff` → `#cc785c`
   - tool: `#5ee6b8` → `#5db8a6`
   - waiting: `#ffd166` → `#e8a55a`
   - done: `#9ce27f` → `#5db872`
   - error: `#ff7a7a` → `#c64545`

7. 排版:
   - label font-weight: `700` → `600`
   - detail font-size: `12px` → `13px`
   - detail line-height: `1.25` → `1.4`

8. 动画:
   - pulse 圆点: `10px` → `8px`
   - 删除旧 box-shadow 呼吸动画
   - 新增 `::after` 伪元素 scale+opacity 2s 动画（按设计文档 CSS）

### 验证

- `bash ./scripts/test.sh` 通过
- 6 种状态颜色与设计文档一致

---

## 执行顺序

1. 创建 worktree
2. 阶段 1 → commit
3. 阶段 2 → commit
4. 阶段 3 → commit
5. 阶段 4 → commit
6. 阶段 5 → commit
7. 全局验证 → 更新文档
