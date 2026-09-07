作为视觉设计总监，基于你提供的现有架构与 Claude 风格的设计系统规范，我为你输出这份视觉重构方案。

当前的界面设计存在一个核心矛盾：**将“品牌营销页”的视觉语言（大字号、背景光晕、全宽大按钮）直接搬进了“高频桌面生产力工具”中。** 作为一个用户每天可能要盯着看几个小时的本地 Agent 客户端，界面必须从“吸引眼球”转向“安静退让”，将最大的视觉优先级还给对话内容本身。

---

### 1. 核心视觉判断
**从“展台演示”转向“书桌工作台”。**
高频工具的视觉基调应该是**抗疲劳、高信噪比、弱化容器边缘**。我们必须剔除所有不必要的装饰性元素（如渐变光晕、冗余描述、过度圆角），将空间压缩，把阅读体验提升到类似长篇阅读或代码编辑器的沉浸感级别。工具界面的材质应当是哑光的、扁平的，仅在发生状态流转和关键交互时才给出明确的视觉反馈。

### 2. 避免的陈词滥调
*   **C端聊天气泡病 (The iMessage Syndrome)：** 将用户的输入用高饱和度的主色（如强烈的蓝色或珊瑚色）包裹，并加上夸张的圆角。这在短消息场景可行，但在大段 prompt 或贴代码的 Agent 场景中会造成严重的视觉疲劳。
*   **营销页遗留症 (Marketing Leakage)：** 在 UI 控件（如侧边栏标题、空状态）上滥用 Serif（衬线）展示字体或 24px 以上的大字号。
*   **发光面板病 (Neon Glow)：** 在背景或面板底部使用环境光晕（Radial Gradients）。这不仅增加 Electron 渲染负担，还会干扰对文字的聚焦。

---

### 3. 候选视觉方向

#### 方向 A：终端极客风格 (The Terminal Aesthetic)
*   **隐喻：** 命令行界面与代码编辑器的延伸。
*   **视觉特征：** 极高的信息密度。全局深色模式，大面积移除圆角（采用 2px/4px），全部文字使用 Monospace，Tool 和 Assistant 的边界完全通过代码高亮色区分。
*   **适用性：** 适合完全由硬核开发者使用的场景。
*   **风险：** 视觉过于生硬，不符合当前代码中定义的暖色调画布（Warm Canvas）和 Humanist 字体基因。

#### 方向 B：安静的编辑部工作台 (The Quiet Editorial Workspace)
*   **隐喻：** 干净、排版精良的文学杂志或现代无干扰写作软件（如 iA Writer）。
*   **视觉特征：** 暖白色画布（Tinted Cream Canvas）作为绝对基底。取消背景光晕。强烈的模块对比：User/Assistant 对话在明亮画布上流动，而底层的 Tool 执行（终端、代码）包裹在深色（Dark Navy）卡片中。
*   **适用性：** 完美契合当前 `DESIGN.md` 中的 Claude 基因，并且非常适合长时间阅读大段文本和代码。
*   **风险：** 对字体的排版和间距（Line-height, padding）要求极高，排版没做好会显得页面散漫无骨架。

---

### 4. 推荐方向及具体执行方案
我强烈推荐**方向 B（安静的编辑部工作台）**。下面是将当前代码重构为高密度、高效率工具的具体视觉执行参数：

#### 4.1 全局布局比例与背景 (Grid & Canvas)
*   **背景重置：** **坚决移除** `[background-image:radial-gradient...]`。高频工具不需要光晕。将 `body` 和 `main` 的背景干净地设定为 `bg-app-canvas`（即 `#faf9f5` 暖白色）。
*   **Sidebar 宽度：** 左侧导航栏不需要占用过多空间。建议默认宽度设为 **260px**（最小 240px，最大不要超过 320px）。右侧工作区保持 `minmax(0, 1fr)`。
*   **整体边框：** 移除各个面板沉重的 `shadow`，界面的层级主要依靠 `border-app-hairline`（1px 的柔和分割线）和轻微的背景色差来区分。

#### 4.2 HistorySidebar 头部重构 (压缩至约 88px 高度)
当前的头部过于喧宾夺主，需要进行彻底的“收纳整理”。

*   **删除项：** 
    *   删除描述文字 "本地 thread 工作台"。
    *   删除显眼的 "新建对话" 占据的独立一行和全宽大按钮。
*   **新布局 (顶部第一行，高度 ~40px)：**
    *   采用 `flex items-center justify-between` 布局。
    *   **左侧：** 缩小 Logo 尺寸至 `h-5 w-5`（20px），去掉外层 border 和 shadow；紧跟的 "Wisp Pocket" 标题字号降级为 `text-[14px] font-medium`（使用 Sans 字体，不要使用 Display 字体）。
    *   **右侧：** 将“新建对话”收敛为一个次级图标按钮（Icon Button），只需一个 `+` 号图标，尺寸 `h-7 w-7`，平时透明，`hover:bg-app-surface-muted`，`text-app-text-secondary`。
*   **新布局 (搜索栏第二行，高度 ~36px)：**
    *   高度从 `h-10` 降为 `h-8` 左右（32-36px）。
    *   视觉减弱：默认状态去掉 border，使用 `bg-app-surface-muted`，只有在 `focus` 时才出现 `ring` 或 `border-app-accent`。

#### 4.3 右侧对话区与 Bubble 优化 (高信噪比阅读)
对话区应该像干净的文稿，而不是社交软件。

*   **User Bubble (收敛并融入)：**
    *   最大宽度从 `85%` 降至 `75%` 左右，防止宽屏下视线跳跃过大。
    *   样式更内敛：移除边框 `border`，直接使用 `bg-app-surface-muted`（极浅的灰色/暖灰色），文字使用 `text-app-text-primary`。圆角从夸张的 `rounded-2xl` 降级为 `rounded-xl` 或 `rounded-lg` (12px)。
*   **Assistant Message (无界文本)：**
    *   保持背景透明。不需要外层容器，直接在画布上输出。
    *   段落间距 (margin-bottom) 保持 `mb-4`，行高 `leading-[1.6]` 保持不变。
*   **Tool Message (产品内嵌面板隐喻)：**
    *   Tool 的输出往往是 JSON、命令或内部思考，这些属于“底层机器行为”。
    *   **核心对比：** 应用 `DESIGN.md` 中的 `surface-dark` 概念。将 Tool Bubble 的背景改为暗色调（如 `#181715` 或深灰），文字改为 `text-app-text-muted` (或 `text-on-dark-soft`)，强制使用 `font-code`。圆角 `rounded-md` (8px)。这样能与正常的自然语言对话产生极强的视觉区隔，快速划过时一目了然。
*   **空状态 (Empty State) 的重构：**
    *   当前的 30px Display 字体过于突兀。
    *   **修改为：** 居中放置一个极低对比度（opacity 20%）的 Wisp Pocket Logo (SVG)，下方配一行 13px 或 14px 的中性提示语（如 `text-app-text-muted` 的 "按 Cmd/Ctrl + N 新建或选择历史对话"）。无需卡片边框包裹，直接融入背景。

#### 4.4 Composer 底部输入区优化 (悬浮工作台)
输入框是工具的核心，需要显得专业且紧凑，不再像消费级聊天软件的“椭圆胶囊”。

*   **容器背景：** 将包裹 Composer 的 form 背景调整为 `bg-app-canvas` 结合顶部渐隐遮罩（由透明到画布底色），或者单纯的透明带一条顶部细线 `border-t border-app-hairline`，移除厚重的阴影。
*   **输入框 (Input Box)：**
    *   **形状：** 从 `rounded-3xl`（胶囊）改为 `rounded-xl` (12px) 或 `rounded-2xl` (16px)，显得更加专业硬朗。
    *   **尺寸与间距：** 内部 padding 缩减为 `px-md py-sm`。最小高度减小，让单行输入时更紧凑（例如 min-height 降到 44px）。
    *   **边框材质：** 默认状态下只有极淡的边框或没有边框加底层弱阴影，`focus-within` 时才显示 `border-app-accent` 并配合柔和的 ring。
*   **操作按钮组：**
    *   尺寸从 `h-9 w-9` 缩小到 `h-8 w-8`。圆角设为 `rounded-md`。
    *   “发送”按钮在有内容可发送时，才亮起主色 `bg-app-accent`；空状态时保持无色或极淡的幽灵状态。
*   **宽度限制：** 保持最大宽度 `max-w-[720pt]` 是正确的，这确保了大屏上的视线聚焦。

### 总结验收点 (Implementer Checklist)
1. 你的画布是不是失去了光晕，变成了一块纯粹安静的暖白色画布？
2. 你的侧边栏头部是不是高度减半了，不再有抢眼的大色块按钮？
3. Tool 输出是不是变成了深色/极弱背景的代码块，与 Assistant 的自然语言形成了材质上的明确反差？
4. Composer 看起来是不是更像一个 IDE 的 Command Palette 或 Spotlight，而不是微信的输入框？

严格执行这些减法与对比，产品就会立刻从一个“粗糙的网页 Demo”变成一个“精致的原生桌面级生产力工具”。
---

## Original Prompt

```text
为 handAgent 的 React ThreadWindow 生成详细的视觉重构设计方案。

## ThreadWindow 是什么
Electron BrowserWindow 承载的 React 对话窗口。左侧历史栏 + 右侧工作区（消息列表 + 请求面板 + 底部 Composer）。是用户和 AI agent 交互的主界面。

## 当前代码结构和视觉问题

### 主布局（App.tsx）
- main: grid h-screen，gridTemplateColumns 由 sidebarLayout 控制
- 背景: bg-app-canvas + 两个 radial-gradient glow（warm coral 14% + cool teal 12%）
- sidebar visible 时显示 HistorySidebar

### HistorySidebar（HistorySidebar.tsx）
- aside: flex flex-col，border-r border-app-hairline，bg-app-surface/95，p-sm，shadow
- header mb-sm 包含：
  1. logo区: 28×28 SVG图标（六边形+十字，border+shadow）+ 'Wisp Pocket' 显示字体标题(25px)
  2. 描述: '本地 thread 工作台'，12px，mt-xs
  3. 新建按钮: '新建对话'，h-10全宽，bg-app-accent，mt-sm
  4. 搜索框: h-10全宽，mb-sm
- 列表: Accordion分组，flex-1 overflow-y-auto
- 当前问题：
  - 头部太冗余：logo+标题+描述+大按钮+搜索 共占约 160px 高度
  - 描述'本地 thread 工作台'无用
  - 新建按钮全宽太大
  - logo区域占比过大

### ThreadWorkspacePane（ThreadWorkspacePane.tsx）
- section: grid h-screen grid-rows-[auto_minmax(0,1fr)_auto]
- bg-app-canvas/80
- 空状态: 居中卡片 '准备开始' 显示字体30px + '选择历史或创建新对话'

### MessageBubble（MessageBubble.tsx）
- user消息: 右对齐 max-w-[85%]，rounded-2xl，border hairline/70，bg-app-user-bubble，shadow-soft
- assistant消息: 全宽，bg-transparent，text-app-text-primary
- tool消息: rounded-xl，border hairline，bg-app-tool-bubble/70，shadow-product-inner
- 文字: 15px，leading 1.6
- 操作按钮: 复制/编辑/重新生成，opacity-0 hover显示，7px高

### Composer（Composer.tsx）
- form: bg-app-canvas/85，px-lg py-md
- 输入框: rounded-3xl，border hairline，bg-app-surface-elevated/98，px-md py-xs，shadow
- textarea: min-h-52px，16px字号，leading 1.5
- 按钮区: 右侧 +附件(占位) + 停止 + 发送，每个 h-9 w-9 rounded-xl
- 排队面板: rounded-2xl，border hairline，bg-app-surface-elevated/95
- 最大宽度: 720pt
- slash菜单: rounded-2xl浮层

## 设计方向
- HistorySidebar头部压缩：去掉描述，标题+新建+搜索压缩到更紧凑的区域
- 右侧对话区更像日常聊天工具
- 安静高效，信息密度高

## 请提供
1. HistorySidebar 头部重构：具体要保留/删除什么，新的布局方式，各元素尺寸
2. 右侧对话区优化：消息间距、bubble样式调整、空状态改善
3. Composer 优化：输入框样式、按钮布局、间距
4. 整体 grid 布局比例（sidebar宽度建议）
5. glow 背景渐变是否保留/调整
所有建议给具体的 px/pt 数值和 Tailwind class 示意。
```

### Referenced Files
- /Users/mu9/proj/handAgent/apps/thread-window-web/src/components/HistorySidebar.tsx
- /Users/mu9/proj/handAgent/apps/thread-window-web/src/components/Composer.tsx
- /Users/mu9/proj/handAgent/apps/thread-window-web/src/components/MessageBubble.tsx
- /Users/mu9/proj/handAgent/apps/thread-window-web/src/components/ThreadWorkspacePane.tsx
- /Users/mu9/proj/handAgent/apps/thread-window-web/src/App.tsx
- /Users/mu9/proj/handAgent/apps/thread-window-web/src/styles/tailwind.css
- /Users/mu9/proj/handAgent/DESIGN.md
