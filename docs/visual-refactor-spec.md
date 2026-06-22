# Spec: 前端视觉重构

## 概要

统一 handAgent 全部可见前端为"安静高效的日常工具"。覆盖暗色主题 token、Swift PromptPanel、Swift Settings、React ThreadWindow、Electron StatusBubble。

设计规格详见 [visual-refactor-design.md](./visual-refactor-design.md)。

## 实施阶段

按依赖顺序拆分为 5 个阶段，每个阶段独立可验证。

### 阶段 1：暗色主题 Token

**改什么**：`design/tokens.json` 的 `color.dark` 全部替换为新值。运行 `node scripts/generate-theme-tokens.mjs` 重新生成 Swift 和 CSS token 文件。

**涉及文件**：
- `design/tokens.json`
- `apps/desktop/Sources/Theme/GeneratedThemeTokens.swift`（生成）
- `apps/thread-window-web/src/styles/generated-theme.css`（生成）

**验证**：
- `bash ./scripts/test.sh` 通过
- `bash ./scripts/swiftw build` 通过
- 暗色模式下 canvas 不再纯黑，呈现暖深棕灰

**设计细节**：见 [visual-refactor-design.md §一](./visual-refactor-design.md#一暗色主题-token-重设计)

---

### 阶段 2：PromptPanel 重构

**改什么**：
1. 容器 padding 32→16，minWidth 640→600，增加 maxHeight:480，阴影调柔
2. 布局顺序从 chip→input 改为 input→chip
3. VStack spacing 24→0，各模块自控间距
4. Chip 间距/大小/材质压缩
5. Action 列表行间距 8→2，高亮去 accentRing 边框，trigger pill 改键帽风格

**涉及文件**：
- `apps/desktop/Sources/PromptPanel/PromptPanelStyles.swift`
- `apps/desktop/Sources/PromptPanel/PromptPanelView.swift`
- `apps/desktop/Sources/PromptPanel/PromptPanelInputLayout.swift`

**验证**：
- `bash ./scripts/swiftw build` 通过
- PromptPanel 热键唤起后视觉更紧凑
- 各 chip 类型（text/skill/image/error）显示正常
- Action 列表高亮和 trigger pill 显示正常

**设计细节**：见 [visual-refactor-design.md §二](./visual-refactor-design.md#二promptpanel-重构)

---

### 阶段 3：Settings 重构

**改什么**：
1. 窗口 660×520 → 680×560
2. Tab 栏压缩至 ~48pt：图标 14pt、spacing 4、选中态只保留 canvas 背景
3. 内容区 h-padding 48→32，Row label/control/间距调整
4. SectionHeader 对齐到 Control 区左边缘
5. 说明文字收进 `?` 图标 tooltip

**涉及文件**：
- `apps/desktop/Sources/Settings/SettingsView.swift`
- `apps/desktop/Sources/Settings/SettingsStyles.swift`
- `apps/desktop/Sources/Common/CommonComponents.swift`
- 各个 *SettingsView.swift（逐个处理说明文字 → tooltip）

**验证**：
- `bash ./scripts/swiftw build` 通过
- Settings 窗口打开后 Tab 栏更紧凑
- 9 个 Tab 都能正常点击切换
- Row 布局在所有 Tab 页中对齐正确
- `?` tooltip 可 hover 显示

**设计细节**：见 [visual-refactor-design.md §三](./visual-refactor-design.md#三settings-重构)

---

### 阶段 4：ThreadWindow 重构

**改什么**：
1. 背景 glow coral 14%→6%, teal 12%→4%
2. HistorySidebar 头部删除 logo/标题/描述/全宽按钮，改为 新建图标+搜索 两行
3. User bubble max-w 85→75%，去 shadow
4. Tool bubble 去边框和阴影
5. 消息操作按钮改为纯 icon + 固定显示
6. 空状态简化为极简提示语
7. Composer 按钮 h-9→h-8

**涉及文件**：
- `apps/thread-window-web/src/styles/tailwind.css`
- `apps/thread-window-web/src/App.tsx`
- `apps/thread-window-web/src/components/HistorySidebar.tsx`
- `apps/thread-window-web/src/components/MessageBubble.tsx`
- `apps/thread-window-web/src/components/MessageList.tsx`
- `apps/thread-window-web/src/components/Composer.tsx`
- `apps/thread-window-web/src/components/ThreadWorkspacePane.tsx`

**验证**：
- `bash ./scripts/test.sh` 通过
- ThreadWindow Sidebar 头部高度明显缩小
- 消息区 user/assistant/tool bubble 显示正常
- 空状态简洁无卡片
- 操作按钮固定显示为纯 icon

**设计细节**：见 [visual-refactor-design.md §四](./visual-refactor-design.md#四threadwindow-重构)

---

### 阶段 5：StatusBubble 重构

**改什么**：
1. 表面颜色改用主题系统 token（去掉独立颜色系统）
2. 6 种状态颜色统一到 DESIGN.md 色系（亮暗一致）
3. 删除渐变高光 (linear-gradient)
4. hover 去掉 translateY 位移，改为纯变色
5. pulse 动画改为 ::after 伪元素 scale+opacity 2s
6. 排版调整：label weight 700→600, detail 12→13px

**涉及文件**：
- `apps/electron-shell/src/activity-window/styles.css`

**验证**：
- `bash ./scripts/test.sh` 通过
- StatusBubble 在亮暗主题下颜色与主题系统一致
- 6 种状态颜色（idle/running/tool/waiting/done/error）和 DESIGN.md 色系匹配
- pulse 动画柔和呼吸
- hover 无位移只变色

**设计细节**：见 [visual-refactor-design.md §五](./visual-refactor-design.md#五statusbubble-重构)

---

## 全局验证

所有阶段完成后：

1. `bash ./scripts/test.sh` — 全部通过
2. `bash ./scripts/swiftw test` — 全部通过
3. `bash ./scripts/swiftw build` — 全部通过
4. 亮色主题：所有界面暖奶白底色不变，视觉更紧凑
5. 暗色主题：canvas 呈暖色深底（非纯黑），accent 色保持珊瑚橘
6. StatusBubble 状态颜色与主题系统 coral/teal/amber/success/error 一致
