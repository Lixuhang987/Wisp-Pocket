# 桌宠主交互：macOS、Electron 与 HCI 研究依据

核验日期：2026-09-14。定位：未来设计的研究依据，不声明 Wisp Pocket 已实现这些建议。Electron 文档固定到仓库锁定的 **v42.3.3**；Apple 使用当日官方 HIG / AppKit 文档；论文使用作者或作者机构公开的原稿。当前产品事实以 [handAgent.md](../../handAgent.md) 和 owning 模块文档为准。

研究问题：如何让三只桌宠完整同屏、单个位置切宠、按宠物投递资料、独立会话历史和完整任务控制同时成立，并把 ThreadWindow 降为可选的扩展工作台。

## 结论及其证据等级

- **平台事实**：透明窗口、鼠标穿透、键盘焦点、跨 Spaces 可见性是不同能力；一个开关不能保证其余行为。跨 App 拖入也不能仅由网页 `drop` 演示证明。
- **研究结果**：关系型对话能在特定任务与样本中增加亲近感和继续交流意愿；没有证据直接证明三只桌宠、可爱皮肤或更频繁寒暄提高桌面生产力。
- **设计推论**：让“宠物身份、当前输入对象、桌面位置、运行任务”各有独立状态。三宠完整展示是一等模式；默认只展开一个会话面是降低干扰的建议，不能成为删除多宠展示的理由。用户仍可固定多个会话面并行查阅。
- **待验证**：窗口命中、输入法、焦点恢复、原生拖入、多显示器、Spaces、VoiceOver 和能耗必须在真实 Swift Host + Electron 环境验证。HTML 原型只能验证信息架构、操作路径与状态解释是否清楚。

## 平台事实与设计含义

| 议题 | 已核实的一手事实 | 对设计的含义；边界 |
| --- | --- | --- |
| 短暂气泡与持久会话 | Apple [Popovers](https://developer.apple.com/design/human-interface-guidelines/popovers) 建议少量相关任务、一次一个 popover；原文要求 “Always save work when automatically closing a nonmodal popover.” macOS 可把 popover 分离成 panel。 | 轻量预览、宠物选择、短历史列表适合暂态层；长回复、输入草稿、待确认任务需要持久会话面。点外部最多收起视图，不能丢草稿、取消任务或默认拒绝请求。并行固定会话面不应实现为级联 popover。 |
| 不把 HIG panel 当常驻桌宠背书 | Apple [Panels](https://developer.apple.com/design/human-interface-guidelines/panels) 把 panel 定位为当前窗口的辅助控制，偏好简单调节；通常 App 失活时应隐藏。 | 跨 App 常驻桌宠属于有意识的产品窗口设计，不是普通 inspector 的直接套用。承载完整对话的浮层也不能仅因长得小就声称符合原生 panel 的全部建议。 |
| 静默展示与输入焦点 | Electron v42.3.3 [BaseWindow](https://github.com/electron/electron/blob/v42.3.3/docs/api/base-window.md) 的 `showInactive()` 显示而不聚焦；`setFocusable(false)` 在 macOS 不移除已有焦点。Apple [nonactivatingPanel](https://developer.apple.com/documentation/appkit/nswindow/stylemask-swift.struct/nonactivatingpanel) 不激活 owning App；[becomesKeyOnlyIfNeeded](https://developer.apple.com/documentation/appkit/nspanel/becomeskeyonlyifneeded) 还涉及实际命中视图。 | 待机、完成标记和 hover 预览不得抢输入焦点；用户明确打开输入才进入可输入状态。需要明确记录并恢复前台 App，测试中文输入法组合文字。不要假定“非激活窗口”就不能输入，或关闭 focusable 就等于焦点已经归还。 |
| 透明不等于穿透 | Electron v42.3.3 [Custom Window Styles](https://github.com/electron/electron/blob/v42.3.3/docs/tutorial/custom-window-styles.md)：透明区域默认不能点击穿透；透明窗口不支持通常意义的可调整大小，开启 resizable 可能破坏部分平台透明效果；CSS blur 只处理本窗口内容，macOS 透明窗口没有原生阴影。 | 不能用覆盖全屏的透明矩形省略命中治理。宠物、接收环、会话面的命中范围必须可解释；尺寸变化与后台应用模糊效果分别做原生试验，不能从 CSS 效果推断。 |
| 穿透状态的恢复 | v42.3.3 [鼠标穿透 API](https://github.com/electron/electron/blob/v42.3.3/docs/api/base-window.md#winsetignoremouseeventsignore-options) 忽略鼠标事件；`forward` 只转发鼠标移动消息，已聚焦窗口仍可能接收键盘。 | `forward` 不是外部拖放完整转发保证。现有系统 cursor 轮询与 renderer 命中矩形路径可以作为扩展基础，但三宠、多屏、掉帧时的命中与 drop 仍需实测；不能直接认定现有实现失效，也不能认定已覆盖新场景。 |
| 拖宠物与拖资料的冲突 | v42.3.3 [Custom Window Interactions](https://github.com/electron/electron/blob/v42.3.3/docs/tutorial/custom-window-interactions.md) 明确 `app-region: drag` 区域忽略 pointer events，交互控件须 `no-drag`。 | 把整个宠物永久标成原生拖动区域，会影响点击、hover 等交互。应明确移动手柄或区分移动手势与资料拖入；输入、按钮、接收目标保持可交互。不要靠两个冲突 handler 的执行次序定义用户意图。 |
| 置顶不是万能层级 | v42.3.3 [置顶与 Spaces](https://github.com/electron/electron/blob/v42.3.3/docs/api/base-window.md) 区分 window level、all workspaces 和 `visibleOnFullScreen`；跨工作区设置可能短暂隐藏窗口与 Dock。Apple [CollectionBehavior](https://developer.apple.com/documentation/appkit/nswindow/collectionbehavior-swift.struct) 也说明行为项对 Mission Control、Spaces、Stage Manager 的适用性不同，部分互斥。 | 常态建议使用普通浮动层级；不为持续可见而压住系统菜单、授权对话框或屏保。全屏、演示和安静时段应有明确显示策略。不要在切换宠物时反复修改进程类型或 Spaces 策略。 |
| 多屏几何 | v42.3.3 [Display](https://github.com/electron/electron/blob/v42.3.3/docs/api/structures/display.md) 的 bounds / workArea 是 DIP；[screen](https://github.com/electron/electron/blob/v42.3.3/docs/api/screen.md) 提供显示器增删和 metrics 变化事件。Apple [safeAreaInsets](https://developer.apple.com/documentation/appkit/nsscreen/safeareainsets) 单独处理自定义全屏内容可能被摄像头区域遮挡的问题。 | 保存显示器关联与相对锚点，热拔后把全部宠物及会话入口回收到可达区域；不要把物理像素与 CSS 像素机械相加。测试负坐标排列、混合缩放、Dock 方位、旋转屏幕与摄像头区域，不能只验主屏 1×。 |
| 拖入反馈 | Apple [Drag and drop](https://developer.apple.com/design/human-interface-guidelines/drag-and-drop) 要求替代操作、可撤销、接受/拒绝目标反馈、延迟传输反馈；多个候选目标应一次指明一个，优先保留可接受的高保真表示。 | 拖过时显示宠物名、目标会话、资料数量和操作含义；在 **drop 成功时** 固定接收路由，之后切宠不改变已投递对象。支持粘贴、文件选择、菜单发送；失败不能播放成功动作。原文不是“任意 App 内容一定可跨 App 拖入”的保证。 |
| 文件不是总有磁盘路径 | v42.3.3 [webUtils.getPathForFile](https://github.com/electron/electron/blob/v42.3.3/docs/api/web-utils.md) 对 JS 构造且无磁盘 backing 的 File 返回空串。Apple [NSFilePromiseReceiver](https://developer.apple.com/documentation/appkit/nsfilepromisereceiver) 则明确存在拖放时承诺稍后生成的文件，可一次承诺多个。 | 统一处理真实文件、浏览器图片、文本/URL、多种 MIME 表示、延迟交付附件。来源 App 是否提供可读内容是独立适配问题。显示“正在接收”占位，完成物化后再交给解析流程；不要把空路径当成用户没拖东西。 |
| 通知与 Focus | Apple [Managing notifications](https://developer.apple.com/design/human-interface-guidelines/managing-notifications) 区分 Passive、Active、Time Sensitive、Critical；要求真实反映紧急程度。系统通知受系统调度。Apple [INFocusStatusCenter](https://developer.apple.com/documentation/intents/infocusstatuscenter) 还单独管理 App 对 Focus 状态的访问。 | 普通完成不自动提升为 Time Sensitive。系统通知与桌宠自绘气泡是两条通路，不能假定 Focus 自动隐藏自绘内容；先提供明确的应用内安静模式，自动跟随 Focus 的权限、可用性和撤销行为另验。 |
| 动画和辅助技术 | Apple [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility) 要求键盘可操作、VoiceOver 描述、非单一感官传递信息，并在 Reduce Motion 下减弱自动重复动画；[Motion](https://developer.apple.com/design/human-interface-guidelines/motion) 建议动画目的明确、可取消、不要延迟频繁交互。Electron [辅助功能](https://github.com/electron/electron/blob/v42.3.3/docs/tutorial/accessibility.md) 可暴露 Chromium 无障碍树，[systemPreferences](https://github.com/electron/electron/blob/v42.3.3/docs/api/system-preferences.md) 可查询动画偏好。 | “思考”“完成”“待确认”同时有文字/标记；不能只靠精灵表情、颜色或音效。所有宠物可从键盘列表召回，关闭游走与循环动作后仍完整可用。透明背景下仍需对比度与可聚焦控件，不能只给 sprite 一个没有状态的图片标签。 |
| 权限与材料隐私 | Apple [Privacy](https://developer.apple.com/design/human-interface-guidelines/privacy) 强调按实际功能需要请求最小范围数据、解释用途。Electron [systemPreferences](https://github.com/electron/electron/blob/v42.3.3/docs/api/system-preferences.md) 分别暴露辅助功能信任与 camera/microphone/screen 状态。 | “这只宠物能读取什么”是产品策略；OS 权限属于 App/进程而非宠物身份。不同 persona 不能冒充操作系统隔离。手动给两份文件不等于同意读全屏/剪贴板；在实际需要时解释能力，拒绝后保留可用路径。 |
| 从别的 App 接收内容 | Electron [Security](https://github.com/electron/electron/blob/v42.3.3/docs/tutorial/security.md) 要求隔离 context、限制 IPC、校验消息来源，不把不受信内容带进特权执行环境。[webUtils](https://github.com/electron/electron/blob/v42.3.3/docs/api/web-utils.md) 建议经 preload 暴露窄 API，而不是直接给页面完整路径能力。 | 网页、PDF、历史文本均是待处理资料，不是更新 persona、授权或执行主进程操作的指令。会话面呈现真实权限 scope / 目标 / 后果；宠物语气不能覆盖这些字段。 |

## 原始 HCI 研究：结果与不可推导之处

| 原始研究及核验位置 | 实际研究与结果 | 可以支持的设计推论 | 不能据此声称 |
| --- | --- | --- | --- |
| Bickmore & Picard, 2005, *Establishing and Maintaining Long-Term Human-Computer Relationships*；[作者稿](https://www.ccs.neu.edu/home/bickmore/publications/toCHI.pdf)，摘要、§6.3–6.5，PDF 第 23–34 页；[DOI](https://doi.org/10.1145/1067860.1067867)。 | 101 人开始、89 人完成干预、84 人完成随访；每日运动辅导持续一个月。关系型条件在关系纽带、喜欢、继续与 agent 交互意愿等指标更高；全样本预定比较没有显示关系指标的提升转化为组间运动行为差异。 | 保留稳定身份、会话连续性、可解释的记忆与适度关系表达，作为可检验的长期使用假设；把关系感与任务效果分别测量。 | 该研究比较的 agent 条件本身都有形象，不能单独证明“有桌宠”优于纯文字；也不能推导三宠更高效、永久记忆越多越好，或任务表现随喜欢度一起提高。 |
| Bickmore & Cassell, CHI 2001, *Relational Agents: A Model and Implementation of Building User Trust*；[作者稿](https://www.ccs.neu.edu/home/bickmore/publications/CHI2001.pdf)，PDF 第 6–7 页。 | 当前作者稿 Methods 为 18 人，Wizard-of-Oz 房屋租赁对话；small talk 的信任效应受内外向性调节，主动/被动参与者的 engagement 偏好不同；愿付价格无显著差异。 | 每宠允许简洁、适量陪伴等语气偏好；用户一进入任务就可以直达，不强制寒暄。把用户是否主动对话作为调节条件研究。 | 不能断言人人喜欢更健谈的宠物；不能将其信任效应等同真实自主 agent 的准确性，亦不能从小样本推出稳定人群比例。 |
| Mark, Gudith & Klocke, CHI 2008, *The Cost of Interrupted Work: More Speed and Stress*；[UCI 作者稿](https://ics.uci.edu/~gmark/chi08-mark.pdf)，PDF 第 2–4 页。 | 48 人的实验室邮件任务，约每两分钟发生需立即处理的电话或 IM 中断。扣除中断本身时长后的任务时间更短，错误数与礼貌指标没有显著差异；中断条件的压力、挫折、努力等负担更高。 | 完成与等待事件应可被动发现，合并提醒并尊重当前输入；评价长期负担和打扰感，不能只看任务耗时。三宠并行时尤其需要一个提醒调度点。 | 不能说“所有中断必然使任务更慢”，也不能把被要求立即回应的中断等同一个静默角标；短期实验没有直接验证桌宠动画的长期影响。 |
| Buçinca, Malaya & Gajos, CSCW 2021, *To Trust or to Think: Cognitive Forcing Functions Can Reduce Overreliance on AI in AI-assisted Decision-making*；[作者 arXiv 稿](https://arxiv.org/pdf/2102.09692)，§3.5、§6–7；[DOI](https://doi.org/10.1145/3449287)。 | 260 人招募后分析 199 人；比较解释、置信度展示与三种促使主动思考的交互，任务是餐食成分替换，使用模拟 AI。促思考设计减少了 AI 出错时的过度依赖，但未消除，未发现总体表现显著优势；效果最好的条件主观偏好较低，并有 Need for Cognition 差异。 | 任务证据、影响范围、结果核对与必要确认保留清楚；同时测“喜欢”与“发现错误的能力”。仅在相关决策处增加有意义的信息，避免给所有操作加负担。 | 不能据此强制所有动作多点一次，也不能说多显示解释或拟人化承诺就能校准信任；单一非关键任务不直接证明高风险桌面自动化的安全性。 |

研究总体支持“可控的持续关系值得验证”，不支持把亲和力当能力证明。以上论文没有研究 Wisp Pocket 的多宠 / 工作区 / 原生拖入组合；三宠全显示与单槽切换仍是应当比较的两种完整产品模式。

## 建议的交互不变量

以下均为设计建议，须进入正式方案后才成为实现约束。

| 场景 | 推荐约束 | 用户看见的结果 |
| --- | --- | --- |
| 三宠完整同屏 | 每只保留完整形象、姓名、可交互入口和自身运行标记；会话面是否展开独立于形象是否展示。宠物移动只改布局。 | 三只都可以直接接收资料和打开各自历史；关闭一个会话面不会让另两只消失。 |
| 单槽切换 | 槽位切换仅改变呈现对象，不暂停、迁移、取消任务，不合并历史。隐藏宠物仍有可达的运行 / 待确认 / 未读汇总。 | 用户能先和甲谈话，再看乙；甲完成后出现摘要而非强行换成甲。 |
| 同时打开多个会话面 | 默认单一键盘输入目标；固定多个会话面可并行看结果，焦点由明确点击决定。每个输入框有持续可见的宠物与会话标识。 | 允许并行，避免输入被后台消息或 hover 改投给另一宠物。 |
| 拖过、松手、切宠 | 拖过给出唯一候选目标；松手成功时固定宠物与会话 / 新会话选择，异步物化资料也沿用该目标。 | 不会因为接收耗时、文件 promise、自动布局或后续切宠，把资料投给错误对象。 |
| 接收资料与执行 | 保留现有 `inspect` 合约的边界：投递只授权读取本次材料，建议执行须后续明确消息。若设计加入待发送暂存，应把它作为明确产品选择，不误记成现状。 | “收到了 2 份资料”与“将修改 2 个文件”是不同状态。移除未提交附件可撤回；已远程发送的材料不能用一个撤回动画声称已从所有接收方消失。 |
| 每宠历史与工作区 | 宠物身份、工作区、会话、当前运行分别索引。共同工作区不自动让宠物共享完整历史；转交材料明确选择范围。历史项说明所属宠物与工作区。 | 用户理解“同一批项目资料”与“和谁说过什么”不是同一件事；旧会话可在宠物入口检索与继续。 |
| 角色设置变更 | 展示名、外观变化与角色提示 / 工具策略变化分开。[最终设计](../design/pet-dialogue/model-and-persona.md)在 Thread 创建时保存角色快照，旧 Thread 沿用原版；当前工具撤销仍须后端执行。 | 用户可以换造型而不改变工作；新设定只用于新对话，旧快照不重新授予已撤销的工具能力。 |
| 审批与拒绝 | 请求有明确目标、scope、后果和有效期；中性按钮表达允许 / 拒绝，宠物不可用受伤表情或关系话术诱导同意。当前 60 秒时限与后续延期设计见[运行规则](../design/pet-dialogue/runtime-and-recovery.md)。 | 即便只有桌宠入口，也能找到有效请求或过期原因；过期后重新检查并申请，不能延期批准旧 requestId，也不依赖 ThreadWindow。 |
| 完成、失败、停止 | 状态必须来自运行事实；关闭面板、网络失联、取消请求与任务完成分别表达。动作动画只是补充反馈。 | “我暂时断开了”不伪装成“做好了”；失败可从同一宠物继续处理。 |
| 隐私与安静 | 支持所有宠物一起安静 / 暂时隐藏；默认对桌面旁观者只展示必要摘要。系统授权和产品内 pet 策略分开解释。 | 工作资料不会因完成弹泡突然铺满屏幕；隐藏宠物不会秘密取消任务，也不会让待确认请求不可达。 |

## 原生实验与验收证据

这里列的是 **需要取得的证据**，不是已经通过的 QA；同一 HTML 原型不能替代以下实验。

| 实验 | 至少覆盖 | 能支持通过判断的证据 |
| --- | --- | --- |
| 穿透与命中 | 三宠相离 / 靠近 / 覆盖、气泡收起展开、快速跨边缘、背景选字与点击；cursor 轮询延迟和 renderer 矩形更新期间。 | 前后台事件时间线与录屏，证明背景可操作、宠物不漏点、不出现大片透明拦截区。 |
| 真正跨 App 拖入 | Finder 单 / 多文件、Safari / Chrome URL与图片、Notes 富文本、Preview 图片/PDF、Mail 等延迟附件；三宠分别接收。 | 记录来源 App、暴露的 types、交付结果、最终路由和失败文案；按来源建立支持范围，不能一次 Finder 成功就写“支持所有 App”。 |
| 拖入期间切换 | 指针从甲移到乙、单槽选择第三宠、资料异步接收时再切宠、目标会话关闭。 | drop 时目标记录与实际接收一致；未完成接收有可见恢复入口，无错投、重复发送、幽灵附件。 |
| 焦点和输入法 | 在编辑器输入时 hover / 后台完成；点宠输入；中文组合输入未提交时切宠；Escape 收起与回到来源 App。 | 前台 App / key window / input 事件与用户所见一致，无误发送、字丢失或键盘仍留在不可见窗口。 |
| 多显示器与窗口管理 | 不同缩放、负坐标、外接屏热拔、主屏变更、Dock 各位置；Spaces、全屏、Stage Manager、Mission Control。 | 所有宠物和关闭 / 召回入口保持可达；位置恢复合理；没有跨 Space 闪烁、意外 Dock 出现或不受控抢前台。 |
| 辅助技术 | VoiceOver、全键盘、系统大文本 / 高对比度 / 减少透明度 / Reduce Motion。 | 从召回宠物、投递、历史、授权、停止到结果完整走通；关闭动画和声音后状态仍可理解。 |
| 窗口架构与能耗 | 单个覆盖窗与每宠小窗方案各测待机、三宠动画、三任务流式输出、会话收起、低电量和睡眠恢复。 | 对比 CPU / GPU / 内存 / 唤醒次数与交互延迟；再决定窗口粒度，不假设每增加一宠固定增加一个独立 renderer，也不假设单窗一定更省电。 |
| 运行与请求恢复 | 隐藏 / 切宠 / 关闭会话面、Electron 重连、服务重启、电脑睡眠，包含待确认请求。 | 按后端权威状态恢复；同一请求只有一次有效答复；未读结果和原会话可从宠物入口找到。 |
| 隐私模式 | 手动隐藏、安静模式、系统 Focus、锁屏前后、屏幕共享；拒绝录屏 / 辅助功能 / 麦克风。 | 分别核验自绘 UI 与系统通知，不把窗口 API 标志当保密证明；系统拒绝后功能退化与恢复清楚。 |
| 用户研究 | 同模型 / 同任务下比较单槽、三宠完整展示，以及不带宠物形象的对应界面；包含投递给正确宠物、恢复历史、发现错误建议、处理并行完成。 | 除偏好外报告成功率、误投率、恢复时间、打断次数、错误建议识别率、长期再使用与负担；不把一次顺利演示换算成 99%。 |

“99%”建议拆成两种目标：一是所有核心能力从桌宠入口可到达，按用例矩阵逐项验收；二是真实使用中无需 ThreadWindow 就完成的任务占比，预先固定分母、排除规则与时间窗口，并记录失败和回退。当前研究只能提出验证方法，不能证明已达到该比例。首次配置和复杂内容若需要独立辅助窗口，应由桌宠自然唤起，并明确是否计入指标，避免通过改名窗口或缩小分母达标。

## 核验范围与来源可复现性

Apple HIG 内容由对应公开页面的官方 DocC JSON 核验，例如 `https://developer.apple.com/tutorials/data/design/human-interface-guidelines/popovers.json`；AppKit 同理。Electron 引用均为官方 GitHub 的 `v42.3.3` tag，不把未来 `main` 分支新增能力当当前依赖能力。论文核验了原稿标题、方法与结果；Bickmore 2005 和 Mark 2008 的摘要、方法、结果页以及 Buçinca 2021 的摘要和讨论已交叉读取，表中样本数按各研究阶段区分。

Microsoft HAX / Guidelines for Human-AI Interaction 页面及其 PDF 在本次访问返回 403；Nass 等 1994 *Computers are social actors* 只取得书目信息，未取得作者原文，因此没有把这两项当作已核验结果补强论证。对话中的 pet / session / workspace 为产品设计用语，本文不重新定义仓库领域 glossary；正式实现仍需由 owning `CONTEXT.md` 和协议类型承接。
