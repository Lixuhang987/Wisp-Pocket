以下是针对该 macOS + React 桌面端应用前端视觉重构的设计建议。核心目标是将应用从“带有极宽敞间距的营销展示/极客工具”风格，转化为“高信息密度、安静、适合日常高频使用的效率工具”，同时贯彻“全局暖色底 + 局部深色功能区”的独特昼夜统一主题。

### 1. 视觉影响最大的问题 (Issues with the largest visual impact)

1. **昼夜主题的全局反转破坏了“安静高效”的日常感**
   * **证据**：`tokens.json` 中暗黑模式的 `canvas` 变成了 `#181715`。典型的 OS 级全局黑化会让应用显得沉重且像硬核开发工具，违背了 `DESIGN.md` 中定义的“温润编辑部（editorial）”质感。
   * **影响**：用户在白天和夜间使用时，视觉记忆和情绪基调会发生断裂。完全黑色的背景容易产生视觉疲劳，且显得过于专业和冰冷。
2. **复用了营销网页的冗余空间，导致信息密度过低**
   * **证据**：在 `CommonComponents.swift` 中，`CommonSection` 和头部大量使用了 `spacing.xxl` (48px) 和 `spacing.lg` (24px)。`SettingsTabBar` 最小高度达 56px。`PromptPanelContainerModifier` 强行限制了 `minWidth: 640, minHeight: 420`。
   * **影响**：桌面端效率工具（尤其是悬浮面板和设置页）需要高信噪比。过大的留白会让用户觉得屏幕被无效占用，拖慢日常高频操作的节奏。
3. **Electron 状态气泡和面板的操作项过于臃肿**
   * **证据**：`activity-window/styles.css` 中，气泡固定高度为 60px，并包含标题与详细说明两行文本。设置页和 PromptPanel 中存在带长文本的 `CommonRow` 和冗长的操作描述。
   * **影响**：打破了“日常轻量化使用”的预期。状态挂件和输入面板越重，用户感知到的心理操作成本就越高。

---

### 2. 可执行的修改建议 (Actionable changes)

#### 2.1 实施“恒定奶油底 + 局部深色工作区”的主题融合
* **位置**：Swift 的 Theme 逻辑映射、`tailwind.css` 中的 `:root[data-theme="dark"]`、以及主要输入/代码区的背景色分配。
* **复用提醒**：复用现有的 `canvas` (#faf9f5) 和 `surface` (#1f1e1b / #181715) 色值，但改变其分配逻辑。
* **变更**：
  无论是亮色还是操作系统的暗黑模式，整个 App 的基础底板（Window、Settings 背景、ThreadWindow 外围背景、PromptPanel 外框）都**强行保持** `canvas`（暖奶油色）。
  深色模式的体现，仅限于将**核心输入框、代码展示区、终端面板、核心工具流区域**切换为 `surface-dark`（深藏青/黑色）。
* **伪代码示意**：
  ```css
  /* ThreadWindow 视觉逻辑 */
  :root[data-theme="dark"] {
    /* 核心底色不跟随系统变黑，保持编辑部质感 */
    --ha-color-canvas: #faf9f5;
    /* 但将功能区（输入框/代码块）映射为深色 */
    --ha-color-input-bg: #181715; 
    --ha-color-input-text: #faf9f5;
  }
  ```
* **视觉收益**：极大地增强了品牌识别度（Anthropic 黑白复古感）。应用看起来像一张安静的纸（全局），上面放置了精密的黑色墨水屏仪器（局部功能区），大幅降低界面对日常视觉的侵入感。

#### 2.2 收敛空间系统，提高信息密度 (Settings & Common)
* **位置**：`CommonComponents.swift` 中的 `CommonSection`, `CommonRow`, `SettingsTabBar`。
* **变更**：
  * 将 `SettingsTabBar` 的 `minHeight` 从 56px 缩小到 40px，移除图标下方的文字或改为纯图标/纯文字的紧凑 Tab。
  * 将 `CommonSection` 的纵向 Padding 从 `theme.spacing.lg` (24px) 降至 `sm` (12px) 或 `md` (16px)。
  * 将两侧的水平 Padding `xxl` (48px) 缩减至 `lg` (24px)。
  * 减少 `CommonRow` 中预设的 `labelWidth: 120` 限制，允许左侧 Label 更紧凑。
* **视觉收益**：让设置面板和列表看起来更像紧凑的 macOS 原生控制台，而非在浏览器里浏览营销网页。眼动距离缩短，提升阅读效率。

#### 2.3 缩小 PromptPanel，操作图标化
* **位置**：`PromptPanelStyles.swift`。
* **复用提醒**：复用 `PromptPanelIconButtonModifier`。
* **变更**：
  * **移除绝对宽高限制**：删除 `.frame(minWidth: 640, minHeight: 420)`。让面板高度由当前输入文字的行数决定，默认仅展示单行或双行高度，随着输入自动撑开，设定 `maxHeight` 即可。
  * **背景层次**：外围面板使用 `canvas.opacity(0.97)`，而内部的输入框区域（TextField 所在位置）使用带 `hairline` 边框的 `surfaceSoft`（深色模式下使用深色背景），形成清晰的“框架 vs 操作区”对比。
  * **操作栏精简**：取消文字描述按钮，将所有“发送”、“展开工具”、“添加上下文”的动作收拢在输入框底部或右侧，使用 28x28 的紧凑纯图标按钮（`systemImage`）。
* **视觉收益**：面板不再像一个笨重的弹窗占据视线焦点，变成了一个随时呼之即来、轻巧的“命令行”入口，彻底回归“日常安静使用”。

#### 2.4 轻量化 Electron 悬浮状态气泡
* **位置**：`activity-window/styles.css` 中的 `.activity-bubble`。
* **复用提醒**：复用 `DESIGN.md` 提及的 `badge-pill` 圆角 token (`9999px`)。
* **变更**：
  * **形状与尺寸**：将 height 从 60px 压缩到 32px 或 36px。Border-radius 从 12px 改为 `9999px`（完全的胶囊形状）。
  * **内容精简**：删掉 `.activity-bubble__detail`（第二行详细信息），通过 Hover 显示 Tooltip 的方式呈现详细信息。
  * **布局**：气泡内仅保留 `[Pulse 指示灯] + [状态单行短语 (13px)] + [可选的终止 Icon]`。
* **视觉收益**：将挂件变成桌面边缘不可忽略但极其安静的“呼吸灯”，消除大量色块和文字对用户主要工作区的视觉打扰。

#### 2.5 排版层级重构 (Typography Hierarchy)
* **位置**：跨界面的文字定义 (Tailwind Base & Swift Typography)。
* **变更**：
  * 界面中的设置项标题、标签（Label）、表单占位符（Placeholder），将字体大小从 `title-md` (18px) 降级为 `body-md` (15px/16px) 甚至 `body-sm` (14px)。
  * 去除专业冗长的副标题（Sub-headings）解释。如果必须存在，将其放入一个 Hover `[?]` 图标或收拢在折叠面板中。
  * 将核心对话的字体尺寸保留在 15px 或 16px，但调低对比度（比如辅助描述使用 `textMuted`）。
* **视觉收益**：文字变小不仅增加了留白空间，还能弱化 UI 的存在感，让内容本身（Prompt / 生成的代码 / AI 返回内容）成为绝对的主角。

---

### 3. 请勿修改的区域 (Do not change)

* **顶部标题的 Serif 字体 (Copernicus / Tiempos Headline)**：如果你在面板顶部或欢迎页使用任何一/二级标题，务必保留这个有负字距的衬线体（Serif 400 weight）。这是 Anthropic / Claude 风格唯一的品牌灵魂锚点，改为无衬线体会让它变成毫无特征的普通 SaaS。
* **Coral 强调色 (`#cc785c`)**：在核心动作（如“发送请求”按钮或关键高亮状态）上，必须保留这种偏暖、低饱和的珊瑚色，绝对不要替换为标准的系统蓝（System Blue）或荧光绿。
* **1px Hairline 边框系统**：在组件（如 `CommonSegmentedControl`, `SettingsTabBar`, 输入框框体）外侧的 `0.8` 或 `1px` `hairline` 边框。不要用沉重的投影（Drop shadow）去代替边框来划分信息层级，保持界面的扁平和纸质感。
---

## Original Prompt

```text
我想重构这个 macOS + React 应用的整个前端视觉，包括 Swift 原生 PromptPanel、Settings、React ThreadWindow 和 Electron StatusBubble。目标：整个界面偏向日常使用，安静高效，信息密度更高，按钮和图标更清楚，少专业描述，多简单易懂的图标；统一亮暗主题以及 Swift 和 React 侧风格。暗色模式不再整页变黑，亮暗都保留 DESIGN.md 的暖色底色，只在局部产品面板、输入区、代码/工具区使用深色。可以调整导航、信息分组、按钮位置、面板展开方式，同时优化视觉、文案密度、图标和状态呈现。请只从视觉设计、信息层级、界面节奏和日常使用体验角度给方向建议，不要做代码审查，也不要输出补丁。
```

### Referenced Files
- /Users/mu9/proj/handAgent/DESIGN.md
- /Users/mu9/proj/handAgent/design/tokens.json
- /Users/mu9/proj/handAgent/apps/thread-window-web/src/styles/tailwind.css
- /Users/mu9/proj/handAgent/apps/desktop/Sources/Common/CommonComponents.swift
- /Users/mu9/proj/handAgent/apps/desktop/Sources/PromptPanel/PromptPanelStyles.swift
- /Users/mu9/proj/handAgent/apps/desktop/Sources/Settings/SettingsStyles.swift
- /Users/mu9/proj/handAgent/apps/electron-shell/src/activity-window/styles.css
