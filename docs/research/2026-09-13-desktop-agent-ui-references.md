# 桌面 Agent UI 参考：面向生活用户

核验日期：2026-09-13。目标是为 Wisp Pocket 的界面重构寻找真实桌面助手 / Agent 的交互与视觉参考。本文记录官方页面、帮助文档和公开演示；未安装实测，也未运行这些产品的 Agent。能力描述、界面观察和设计建议分开记录，建议不代表 Wisp Pocket 当前已实现。

## 推荐方向

建议先用 **Claude Cowork 的阅读气质 + Raycast 的窗口结构 + Enconvo 的完成回执** 确定主界面；用 AnythingLLM 研究随手唤起与附件，用 ChatGPT Pets 研究轻量状态与回访。Manus、Eigent 补充任务范围、过程与产物的表达。以下优先级是针对 Wisp Pocket 的设计判断，不是产品能力排名。

“面向生活用户”在本轮具体指：用旅行、照片、收据、文章和日历等用户对象组织界面；让用户随时看懂正在做什么、需要自己做什么、结果在哪里。配色、插画与圆角应服务这些体验。

## 优先研究的七款

| 产品 | 当前形态与边界：官方事实 | 本次看到的公开 UI | 建议借鉴到 Wisp Pocket |
| --- | --- | --- | --- |
| **Claude Desktop / Cowork** | [入门文档](https://support.claude.com/en/articles/13345190-get-started-with-claude-cowork)说明当前任务在云端运行（beta）；本地文件、浏览器和电脑访问通过在线的 Desktop app。Chat / Cowork 共用入口，可看进度、途中补充方向、预览及下载结果。 | [产品页](https://claude.com/product/cowork)呈现米白底、浅灰消息、宽松正文；[内置浏览器演示](https://claude.com/blog/cowork-built-in-browser)把会话与浏览器放在左右两侧，过程用 Opening browser / Using browser 表达。 | **主视觉与长内容首选**：舒服的阅读宽度、克制分隔、按需展开的过程、会话旁预览。图中浏览器里的绿橙配色属于示例网站，不属于 Claude 界面。 |
| **Raycast AI** | [AI Chat](https://manual.raycast.com/ai/ai-chat)支持工具、终端与 MCP；[Quick AI](https://manual.raycast.com/ai/quick-ai)可将历史、模型与附件一起转入完整 AI Chat；[Screen Awareness](https://manual.raycast.com/ai/screen-awareness)通过可点开的附件卡说明加入了什么上下文。 | [官网 Plan a trip 示例](https://www.raycast.com/core-features/ai)有 Personal / Recent 侧栏、生活化会话标题、单行折叠的研究过程、正文和底部输入框。 | **窗口结构首选**：PromptPanel 到 ThreadWindow 连贯衔接；上下文有名称、可检查；工具过程先给一句自然语言摘要。模型名称和快捷键密度可降低。 |
| **Enconvo** | [App Sidebar](https://docs.enconvo.ai/features/app-sidebar)从应用窗口旁的 Hint Button 展开；[Computer Use](https://docs.enconvo.ai/features/computer-use)明确支持点击、输入、滚动、拖动与读取应用状态；[PopBar](https://docs.enconvo.ai/features/popbar)在选区旁提供轻操作及 Replace / Copy。 | [官方 App Sidebar 录屏](https://file.enconvo.com/videos/app-sidebar-launch.mp4)约 00:24 显示 Calendar 旁的助手：Add Design review event 步骤、Done、When / Calendar 回执及 Ask follow-up。 | **贴近当前内容与完成反馈首选**：操作后用“已加入哪个日历、什么时间”的短回执证明结果；保留继续追问，减少插件配置在主流程中的存在感。 |
| **AnythingLLM Desktop Assistant** | [介绍](https://docs.anythingllm.com/desktop-assistant/introduction)定义跨系统浮层，推理由所选云端或本地 provider 完成；[功能文档](https://docs.anythingllm.com/desktop-assistant/features)支持当前应用建议、区域截图、附件，浮层对话保存在主界面的 Assistant Chat workspace。应用捕获只读取屏幕图像，不等于访问原始文件；Linux 不支持屏幕捕获。 | 同一[功能页](https://docs.anythingllm.com/desktop-assistant/features)的官方图是窄浮层、底部输入框，`+` 菜单分 Applications / Displays，列出具体应用与 Capture Area。 | **全局入口首选**：附件来源明确、轻窗对话可回访；取交互，配色可另选。不要把 Desktop 理解成所有处理都在本机，也不必照搬 `@agent` 等术语。 |
| **ChatGPT Desktop / Work / Pets** | [桌面文档](https://learn.chatgpt.com/docs/app)说明 Chat / Work 与文件工作区；[Computer Use](https://learn.chatgpt.com/docs/computer-use)说明在支持地区通过 macOS / Windows 操作获准应用。[Pets](https://learn.chatgpt.com/docs/pets?surface=app)提供浮动输入、Mini、任务提醒与四种任务状态。 | 官方页面展示完整工作区、轻量入口与宠物旁控件；Pets 文档区分 Running / Needs input / Ready / Blocked，并可从提醒打开完整会话。 | **StatusBubble 与未来桌宠首选**：角色外观可选，状态、输入与回访路径清楚独立；有事需要用户时才展开。桌面 app 支持 Linux 不等于 Computer Use 在 Linux 可用。 |
| **Manus Desktop / My Computer** | [桌面页](https://manus.im/desktop)与[官方发布说明](https://manus.im/zh-cn/blog/manus-my-computer-desktop)说明通过本机 CLI 处理文件、启动与控制应用；先选择和授权文件夹，命令支持逐次或持续批准。这些材料不能单独证明任意桌面视觉点击。 | 桌面页示意图有浅灰任务侧栏、白色主区、大输入框与 My Computer 文件夹菜单；发布说明用花店照片分类展示场景，并给出 Add local folder → 原生选择 → 授权 → 文件夹卡片。 | **任务范围与生活场景参考**：输入前明确“这次处理哪个文件夹”；完成后给出整理位置和成果。官方桌面图仍带 Manus 1.6 Max，不能当作当前安装版本证明。 |
| **Eigent** | [Single Agent 文档](https://www.eigent.ai/docs/single-agent)把对话、任务进度、执行上下文、上传与输出文件放入同一 Session；工具面板按使用情况出现，时间线包含输入请求。[桌面整理案例](https://www.eigent.ai/use-cases/desktop-file-organization-html-daily-report)使用终端处理文件。 | 文档截图可见中间对话、右侧 Progress / Execution Context / Agent Folder、Stop Task 和 Ask a follow-up；[官网](https://www.eigent.ai/)另有 Summary / Progress / Files 与确认示意。 | **执行中与交付物参考**：先显示少量易懂进度和文件成果，再展开工具细节；确认卡说明对象和动作。其多 Agent 工作台和点阵视觉适合按需借鉴。 |

## 补充参考：各取一个明确用途

| 产品 | 已核验事实与界面 | 借鉴重点与限制 |
| --- | --- | --- |
| **Alter** | [QuickHub](https://docs.alterhq.com/getting-started/quickhub-mode)是可附着应用窗口的浮层，可进入有历史与侧栏的 Hub；[Edge Bar](https://docs.alterhq.com/getting-started/edge-bar)展示后台 Computer Use 的目标、状态、目标应用、Stop 与预览。[官网录屏](https://storage.googleapis.com/alter-public-demos/alter-v2-1080-home.mp4)约 00:12 可见 Safari / Notion 图标、页面标题与移除按钮。 | 补充可移除的上下文卡与后台任务条。官网录屏含旧模型名称，旧图只用于这个局部模式；当前 QuickHub 行为以文档为准。 |
| **Sai（Simular）** | [当前官网](https://www.sai.work/)说明默认云桌面，也支持 macOS / Windows 自带设备（BYOD），可使用 GUI、浏览器、终端并审批重要动作；[官方录屏](https://www.sai.work/hero/watch-agents-work.mp4)约 00:14 是深色 Office 多屏网格、Working 标签和输入框。 | 补充“它在哪个环境做哪件事”的可见性。多电脑监控布局对生活用户偏重；本次未验证 BYOD 安装及本机运行体验。 |
| **Microsoft Copilot / Vision（Windows）** | [官方 Vision 帮助](https://support.microsoft.com/zh-cn/microsoft-copilot/using-copilot-vision-with-microsoft-copilot)说明选择共享屏幕 / 应用、可见共享范围、浮动工具栏及停止；明确不会代用户点击、输入或滚动。[Windows 入门](https://support.microsoft.com/zh-cn/microsoft-copilot/getting-started-with-copilot-on-windows)介绍较小 quick view 与截图入口。 | 补充“正在看什么”和一键停止的掌控感；它是屏幕指导参考，不能当作完成电脑操作的执行 Agent 范例。 |
| **Highlight** | [当前官网](https://highlightai.com/)标注 Beta，展示 Daily Brief、Drafts ready for you、来源说明与 Edit / Discard / Send；官方原文为 “drafts and stages work, then waits for your green light”。 | 补充“结果已备好，等你查看”的审核卡。当前偏会议与团队场景；公开材料不足以证明任意系统应用操作。 |

## 映射到 Wisp Pocket

本地术语与职责以 [Desktop Experience](../../apps/desktop/CONTEXT.md) 和 [handAgent.md](../../handAgent.md) 为准。以下是待原型验证的设计方向，不新增或改写架构事实。

| 现有界面 | 建议重点 | 优先对照 |
| --- | --- | --- |
| **PromptPanel** | 一个主输入框；主动添加的文件、图片或选区显示为可检查 / 移除的附件；交出任务后可顺畅进入完整历史。 | Raycast Quick AI、AnythingLLM、Manus |
| **ThreadWindow** | 以用户任务命名历史；过程先显示“正在整理资料”等短状态；结果区直接呈现可读内容与产物；需要确认时说明具体对象、动作和下一步。 | Cowork、Raycast、Enconvo、Eigent |
| **StatusBubble / 未来桌宠** | 简短区分进行中、需要输入、完成待看与受阻；点击回到正确 ThreadWindow；角色不遮挡任务状态，停止和继续查看入口容易找到。 | ChatGPT Pets、Copilot Vision、Alter |

当前 StatusBubble 的职责是显示 Agent Activity 并聚焦已有 ThreadWindow；表中的新状态组织和桌宠交互仍是研究建议。借鉴屏幕感知时也需保持现有输入边界：初始上下文仅来自用户主动提交的 Input Item，屏幕、剪贴板与 App 状态由 Tool 按需读取，不能因采用附件样式就默默附带环境快照。

## 如何收集参考与做下一轮原型

建议先保存 **12–16 张有用途的界面**，每张只记录“来源 / 任务 / 状态 / 借鉴点 / 不适用之处”。优先截图实际应用与官方录屏中的任务状态，官网首屏只补充气质；搜索可用 `desktop AI assistant overlay`、`agent task progress UI`、`computer use approval UI`、`AI task results preview`。

用三个生活任务保持内容一致，再比较不同产品的表达；以下任务是原型样本，本轮没有在这些产品中执行：

1. **整理照片**：“把旅行照片按日期整理到新文件夹，先让我确认分类方案。”观察范围选择、计划确认、进行中与结果位置。
2. **安排生活**：“把这张活动海报里的时间地点做成日历草稿，先给我看。”观察截图附件、信息确认、完成回执和后续修改。
3. **阅读与决策**：“总结这篇文章，列三条我周末可以试试的建议。”观察从当前内容进入、短进度、长结果阅读及以后找回。

每个候选至少覆盖：**唤起 / 附件确认 → 处理中 → 需要用户输入或批准 → 完成 → 稍后回访**。另取一个失败或中断状态，检查用户是否知道如何继续；不能从一张漂亮空白页推断完整体验。

第一轮原型建议做两种气质，保持同一任务、状态和信息结构：**安静温暖**（Cowork 的阅读留白 + Raycast 的结构）与 **贴身陪伴**（Enconvo 的侧边反馈 + ChatGPT Pets 的轻量状态）。用“第一次就知道从哪里开始、等待时是否安心、完成后能否找到结果”选择方向，再细化颜色、字体和动效。

## 核验限制

- 所有链接均为本轮实际打开或研究子 agent 实际核对的官方来源；产品演示只证明公开展示的交互，不证明真实成功率、速度或可用性。未据营销基准评价产品强弱。
- 云端任务、本机桥接、屏幕理解、GUI 操作是不同能力；有桌面 app 不等于本地推理，也不等于会替用户点击。套餐、地区和账户开放情况未逐一验证。
- 录屏与截图可能早于当前文档；已标出 Manus、Alter 等版本线索。Claude Cowork 当前的云端与内置浏览器形态也应按本次日期理解。
- Comet 的公开入口遇到访问验证，本轮未据未读页面补写结论。后续需要试用时，优先验证已入选方向的状态闭环，而非继续扩充产品数量。
