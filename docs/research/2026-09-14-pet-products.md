# 多桌宠主入口：产品与交互研究

核验日期：2026-09-14。用途：为 Wisp Pocket 后续设计提供外部证据，**不是现有能力说明，也不是已验证的实施方案**。本文对应用户提出的多桌宠、人设与工作提示、拖入资料、独立历史、工作区组织，以及日常功能尽量经桌宠完成的目标。Wisp Pocket 的持久对话使用 [Thread](../../packages/core/CONTEXT.md)；外部产品的 Session、Project 等名称仅在说明该产品时保留。

研究依据为开发者自己的文档、源码和官方商店说明；没有把下载量、产品文案、演示视频当作可用性实验。未安装实测这些产品。以下“已证实”表示官方资料明确说明，不能外推为在 Wisp Pocket 的 macOS 窗口、权限和运行架构中已经可行。仓库当前架构以 [handAgent.md](../../handAgent.md) 为准。

## 先给设计团队的判断

1. **多宠显示、角色配置、独立会话、项目资料、长期记忆是五件不同的事。** Desktop Mate 能证明多角色展示的产品形态；SillyTavern 能证明角色卡和群聊提示组织；它们都不能单独证明独立工作会话。尤其 SillyTavern 明说群聊一直共享历史，不应拿群聊作为每宠独立 Thread 的默认模型。[S02][S05]
2. **桌宠可以成为稳定的交付对象，界面按工作量展开。** Raycast 证明快捷入口可以承接追问，并携带完整历史和附件继续展开；不必把快捷交互做成一次性问答。Wisp Pocket 可以把这种连续性放到“这一只宠物、这一段会话”上，而不是依赖一个全局最近聊天。[S08][S09]
3. **参考产品用项目/工作区组织上下文，不必让用户先选文件夹才能聊天。** Claude Projects、Raycast Projects 与 AnythingLLM 都为多个会话提供有范围的共享资料；VS Code 同时证明配置集合与工作区是可分离的。建议角色与工作区独立关联，每段 Thread 明确绑定归属。Wisp Pocket 当前 Workspace 是文件根，不能由这些类比推导它已有共享知识或 Thread 级权限隔离。[S11][S12][S13][S15]
4. **“记得我”需要来源与作用域。** Open-LLM-VTuber 当前 README 明说长期记忆暂时移除，同时保留聊天日志；Claude 与 Raycast 又将项目记忆、全局记忆、历史搜索区分。保留记录不等于模型每次知道全部历史，角色提示也不等于记忆。[S03][S11][S12]
5. **99% 目标必须由端到端工作流检验。** 需要把选择接收宠、交付材料、澄清、授权、取消、失败重试、继续历史、找到产物、配置角色和整理会话都留在桌宠可达的界面中；只把发送和最终回复放进气泡不能满足目标。本文参考没有证明“99%”这一比例，比例需要真实任务样本和行为测量。

## 证据地图

下表中的“映射”只表示可供设计借鉴的维度，不表示 Wisp Pocket 已支持，也不表示来源已经覆盖完整目标。

| 产品 / 系统 | 第一方资料明确的能力 | 最有价值的映射 | 最不能外推的结论 |
| --- | --- | --- | --- |
| VPet | 抚摸、提起、动画状态、点击工具栏、说话栏、可扩展桌宠内容 | 常驻角色与直接触达动作 | 有动画不等于能完成工作流 |
| Desktop Mate | 窗口边缘停留、鼠标互动、闹钟、多角色同显（beta）；同页官方公告明确 Mac 公开测试版不支持多角色 | 多宠同屏、减少遮挡、并存的陪伴感 | 同屏不等于独立 AI 会话，也不是 macOS 多宠能力的现成证明 |
| Open-LLM-VTuber | 语音、Live2D、透明置顶、穿透、点击拖拽、日志持久化和历史切换 | 人设与视觉结合、桌宠模式、会话连续性 | 当前长期记忆与多宠独立并发均未因此获证 |
| SillyTavern | 角色卡、用户 Persona、Lorebook、群聊发言策略与共享历史 | 角色配置、提示成本、显式选择说话者 | 多角色群聊不等于每宠私有历史 |
| Gemini Gems | 名称、指令、角色/任务/上下文/格式、预览、知识文件 | 简单可预览的人设与工作说明编辑 | 命名 Gem 不代表新 runtime 或独立权限域 |
| Raycast | Quick AI、AI Chat、Agents、Projects、上下文附件与后台通知 | 渐进展开、快捷操作、结果回流、状态可达 | 全局 active chat 路由不适合原样用于多宠 |
| Claude Projects / Memory | 项目历史与知识、项目指令、独立项目记忆、受范围限制的历史搜索 | 工作区资料与 Thread 历史分层 | 有历史不能推定每轮完整注入；删除聊天不能推定删除记忆 |
| AnythingLLM | Thread 附件与 Workspace 共享嵌入资料、工作区模式和提示配置 | 明确“这次用”与“以后在这里共用” | RAG 不是全量记忆，也不保证答对 |
| VS Code | Profile 配置集合、Workspace 文件/配置/恢复状态、两者关联 | 角色模板与项目上下文解耦 | Workspace 一词并没有跨产品统一含义 |
| Obsidian | Workspace 保存和切换界面布局 | 多宠显示方式与数据归属分离 | 切换布局不代表切换知识库或会话 |
| Shimeji-ee（历史档案） | 多种形象同时出现、单宠菜单、各自行为配置 | 多宠同屏、就地操作、展示集合 | 历史动画产品不证明现代 AI runtime |
| AIRI（当前开发源码） | 角色卡选择、按角色恢复 Session、角色窗与 Chat 窗分离 | 单位置切宠、每宠历史、身份与会话关联 | 当前源码不证明已发布、全量宠物交互或并行执行 |

## 各产品的证据与取舍

### 1. VPet：让角色本体可交互，而不是旁边再放一个入口

**已证实事实。** 官方 README 列出摸头、提起、爬墙等互动与多种动画，并将点击人物出现的 `ToolBar` 和人物说话使用的 `MessageBar` 列为不同显示组件。创意工坊可扩展桌宠动画、自定义工作、说话文本、主题与代码插件。[S01]

**原文锚点。** `ToolBar 点击人物时候的工具栏`；`MessageBar 人物说话时候的说话栏`。两种组件的区分直接支持“常驻宠物—操作入口—表达内容”分层，而不是把所有东西持续显示。

**可借鉴。** 点击或悬停宠物时出现少量高频动作；处理材料、等待用户、完成任务用容易辨认的表情或动作反馈。轻互动保留宠物性格，但任务状态应同时有可读文本，不能要求用户记忆动画含义。

**不适用 / 边界。** 饥饿、数值养成、随机行为不应成为执行工作的前置条件；代码插件丰富也不等于存在统一任务权限、资料路由或完整会话模型。视觉素材具有独立授权条款，研究不包含直接复用其动画的授权。[S01]

**目标映射与置信度。** 主要支持“每次都像和这只宠物互动”与贴身动作入口。事实高置信，工作效率与多宠扩展效果待原型验证。源码以 `0304510c651fdec1332679db9f22291da9e696b9` 时点核验；访问 2026-09-14。

### 2. Desktop Mate：多宠同屏已是可观察的产品方向，但仍要保留 beta 边界

**已证实事实。** 官方 Steam 产品说明写明可把角色拖到窗口上，让其坐在窗口顶端；角色对鼠标作出反应；点击、摸头等可触发配音；闹钟由角色提醒。说明还明确写入多角色同时显示，但标记“目前仅 beta”；特定角色组合有联合动作。同一官方页面载入的 Yuzuki Yukari / Kizuna Akari 联合动作公告另外注明：Mac 公开测试版不支持多角色，因此也不支持联合动作。支持调整尺寸，闲置时退至屏幕边缘。[S02]

**原文锚点。** “The multi-character feature lets you display several characters at once!”；紧接着是 “This feature is currently available only in the beta version.” 同页官方公告补充：“The Mac version (Open Beta) does not support the Multi-Character feature, so the Combo Action feature is not available on it.”

**可借鉴。** 三只宠物可以分别占据可记忆的位置，具备单独缩放和边缘收纳；多宠同时出现应该是用户选择的展示方案。角色之间的视觉联动可增加陪伴感，但不能冒充后台协作结果。

**不适用 / 边界。** 官方文档没有在上述页面承诺每宠 LLM、人设提示、工作区、独立历史或任务并发。窗口栖息与多角色同屏是表现层证据；Mac 公开测试版的明确限制使它更不能作为 macOS 多宠、焦点、拖拽或全屏行为已经可行的证明。配音也不能当作实时语音对话证据。

**目标映射与置信度。** 强映射多宠同屏、外观差异、减少遮挡。官方功能描述高置信；beta 的稳定性、可用角色和版本覆盖未实测。访问 2026-09-14。

### 3. Open-LLM-VTuber：最接近“对着一个常驻角色说话”的参考

**已证实事实。** 官方 README 描述实时语音、视觉感知、Live2D；桌面客户端可在窗口与桌宠模式间切换，宠物模式提供透明背景、置顶与鼠标穿透，可点击或拖拽；支持表情映射与聊天记录持久化，能切回以前的对话。外观、人设 Prompt 与语音均可定制。[S03]

**原文锚点。** “Although the long-term memory feature is temporarily removed … thanks to the persistent storage of chat logs, you can always continue your previous unfinished conversations.” 这句话同时提供能力和反例：长期记忆不能从持久记录推导。

**可借鉴。** 角色的身份通过形象、声音、措辞和状态表情一致呈现；对话面板和桌宠外观共享同一段交流。语音可以作为输入通道，但文字、附件与静音交互仍应完整，避免桌面工作被强制语音打断。

**不适用 / 边界。** README 同时说明 v2 处于讨论和规划阶段，不能把路线图当现有功能。现有页面没有证明“桌上三只宠物分别独立运行且隔离会话”；Live2D 个性化也不能证明每宠有独立工具权限。没有核验语音延迟、长期使用效果或复杂工具执行流程。

**目标映射与置信度。** 强映射宠物主入口、身份表现、历史恢复与输入多模态；桌面产品声明高置信，运行质量与多宠并发未验证。源码时点 `992309c0aa19845960228f880013d4685fde93b5`；访问 2026-09-14。

### 4. SillyTavern：角色提示、用户身份与共享群聊必须分开

**已证实事实。** Character Design 规定角色名称是唯一必填项，描述、性格、场景等会消耗持久上下文；开场白与示例消息又有不同注入规则。高级设置可允许角色覆盖主提示。Personas 文档明确 Persona 是**用户参与聊天的身份**，可按 chat、character 或 default 绑定。World Info / Lorebook 根据关键词等条件插入相关内容，有独立 token budget。[S04][S06][S07]

**群聊反例。** Group Chats 支持手动点名、自然顺序、列表顺序等发言调度；不论交换角色卡还是拼接所有角色卡，历史始终共享。文档提醒拼接角色卡可能造成身份混淆、性格融合、特征不确定。[S05]

**可借鉴。** 桌宠编辑器应把“它是谁”“擅长怎样工作”“说话方式”“欢迎语/示例”分开，给普通用户简单字段并提供完整工作提示入口；提供预览和提示长度反馈。若以后支持多宠会诊，应显式进入共享会话，让接收者与共享材料可见。

**不适用 / 边界。** 不照搬用户 Persona 命名为桌宠配置；不把所有宠物的提示拼进每次请求；不采用默认随机发言作为任务接收方式。Lorebook 是上下文检索机制，不是已证实的可靠记忆系统；提示词风格与权限授予必须分离。

**目标映射与置信度。** 强映射每宠人设、工作提示和会话身份；同时提供反对“默认共享群聊”的直接证据。文档事实高置信；提示质量取决于模型，未实测。访问 2026-09-14。

### 5. Gemini Gems：把复杂角色说明做成可预览的配置

**已证实事实。** 官方帮助说明创建 Gem 时填写名称与指令，右侧可用一个 prompt 预览；预览不会自动保存，仍需保存操作。指令写作分为 Persona、Task、Context、Format，并支持提供知识文件作为上下文。[S10]

**原文锚点。** “Persona — Tell your Gem what role to play and how to respond.”；“Using the preview window does not automatically save your Gem.”

**可借鉴。** 新建桌宠时用“性格与表达”“通常帮我做什么”“固定背景与偏好”“输出方式”组织输入；在预览区发一条真实请求体验差异，再保存。工作人设可以是审稿、研究、开发等，不要求用户先理解 system prompt。

**不适用 / 边界。** 编辑预览中的聊天不应自动混入正式 Thread，也不应无提示地消耗或修改正式工作资料。官方创建文档没有证明每个 Gem 有独立长期记忆、并行 runtime 或独立权限沙箱；这些需要产品自己的明确设计。

**目标映射与置信度。** 强映射每宠差异化配置与预览反馈。文档事实高置信，角色实际遵循程度未验证。访问 2026-09-14。

### 6. Raycast：重点参考渐进展开、结果回流与任务完成后的可达性

**已证实事实。** Quick AI 在 Root Search 窗口承接问答和追问，可附加当前窗口、选中文字或截图；按快捷键继续到 AI Chat 时，完整历史、模型和附件一起转移。AI Chat 提供持久历史、搜索、置顶、归档、分支、模型与工具配置、停止/跟进；后台通知会区分完成、等待确认、失败等，并跳回对应 chat。[S08][S09]

**角色与项目。** AI Chat 文档将 Agent 描述为可保存的指令、模型和 AI Extensions；Project 另行组织相关聊天、项目指令、项目记忆与工作目录。项目的工作目录指向设备上的文件位置，不自动上传文件夹内容；删除项目会保留其聊天并返回 Recent。[S09][S12][S27]

**可借鉴。** 桌宠气泡保留连续会话，内容复杂时展开为附着宠物的会话面板；历史、附件、授权与产物都属于同一个 Thread。键盘命令、选区交付和结果复制/拖出可缩短高频流程。后台宠物完成任务后显示可恢复的标记，点击直接回到对应 Thread，避免用户重新找上下文。

**上下文的可见性。** Screen Awareness 的附件卡展示来源 App、窗口或文档、截取类型和包含的内容；抓取中仍有可见进度。借鉴这一点，让用户清楚拖给宠物或交付的到底是什么，而不是把不透明的“上下文”塞进模型。[S14]

**不适用 / 边界。** Raycast 的 `Send to AI` 倾向复用 active chat，并可按闲置计时自动新建；多宠设计若直接照搬，会产生“以为发给 A、实际附到 B”的风险。建议显式绑定接收宠与 Thread，保留“新话题”入口，不能让定时器悄悄改变归属。Raycast 的工作目录授权策略也是该产品自己的选择，不等于 Wisp Pocket 应采纳同一权限策略。

**目标映射与置信度。** 强映射 99% 日常工作可达、拖入后确认内容、历史管理、后台通知与角色/项目分层。官方文档高置信；当前文档可能快于不同平台或账户的版本覆盖，未安装实测。访问 2026-09-14。

### 7. Claude Projects / Memory：项目是共享背景，会话是独立交流记录

**已证实事实。** Projects 文档将项目定义为有各自聊天历史与知识库的工作区，支持上传文档、文本、代码和项目指令。Chat Search 文档限制历史搜索的范围：项目内搜索局限于该项目，项目外搜索另属一组；各项目有独立记忆空间和项目摘要。引用过去的聊天会给出原始会话的链接。[S11][S13]

**重要边界。** 当前 Memory 文档明确：删掉或过期的聊天所生成的记忆条目不自动删除，用户可单独删除记忆；当前与 legacy memory 体验同时有说明，不能混用两者的更新频率或默认状态。[S11]

**可借鉴。** “会话历史”“共享资料”“记忆”使用独立入口和说明。项目资料可以为在此工作的不同宠物提供背景，但跨宠物分享聊天内容应有明确边界。历史搜索命中后打开原 Thread，不能只返回一句无法定位的模糊总结。

**不适用 / 边界。** 不能把工作区分组直接宣传为安全隔离或文件权限沙箱；也不能把所有历史自动拼进上下文。删除桌宠、Thread 或工作区时分别说明归档、资料和记忆的去向，避免用户以为删除聊天已经“全部忘记”。

**目标映射与置信度。** 强映射工作区共享背景、Thread 历史与记忆范围。官方说明高置信；跨账号版本和模型检索效果未实测。访问 2026-09-14。

### 8. AnythingLLM：材料先属于这段会话，共享需要另一个清晰动作

**已证实事实。** 官方 Attaching vs RAG 文档明确：聊天中上传的材料受 workspace 与 thread 限定，另一个 thread 不能直接使用；如需多个 thread 共用，应将文件作为嵌入文档加入 workspace。拖拽或输入区附件按钮均可加入材料；嵌入工作区会使材料对该工作区的所有 thread 可用。工作区还可配置 Chat / Query / Agent 等模式与系统提示。[S15][S16][S17]

**原文锚点。** “documents uploaded in one thread will not be available in another chat”；“Embedding a document makes the document available to every thread in the workspace.”

**可借鉴。** 拖给某只宠物的资料，默认附在该宠当前或显式新建的 Thread。未来若增加“加入工作区资料”，应以独立动作和范围标签表达共享；这层共享知识不在本轮推荐初版内，取舍见[身份与上下文设计](../design/pet-dialogue/model-and-persona.md)。

**不适用 / 边界。** RAG 只取相关片段，不代表逐字理解整份文件；该文档甚至说明预算溢出时可能裁剪上下文。来源对准确率的定性宣传不能当作保证。材料解析、共享范围、权限与 token 成本需要分别表达；不能让“上下文装不下”无声变成更大范围的共享。

**目标映射与置信度。** 强映射拖入路由、每宠 Thread 边界、工作区知识管理。文档声明适用于 1.8.5 及以后；部分 Agent Mode 的版本下限另有说明。文档事实高置信；未验证所有 provider 的行为。访问 2026-09-14。

### 9. VS Code Profiles / Workspaces：可复用配置与具体工作的交叉关系

**已证实事实。** Profiles 文档定义 profile 为 settings、extensions、快捷键、布局等自定义集合，可快速切换并与文件夹或 workspace 关联。Workspace 文档定义其为一个窗口中打开的一组目录，可以配置仅对它适用的设置、任务、调试及恢复界面状态。[S18][S19]

**可借鉴。** 某只宠物可以带着自己的表达和工作偏好进入多个工作区；同一工作区也可由不同宠物服务。显示身份和工作位置都要容易辨认，切换时恢复各自先前的会话选择与草稿。

**不适用 / 边界。** 不把桌宠直接等同于一个文件夹；也不照搬开发工具的大量设置层级。Wisp Pocket 的 Workspace 文件根与 Thread 上的工作区关联应按 [owning 文档](../../packages/core/src/workspace/workspace.md) 区分；产品研究只提供类比，不能替代本地协议定义。

**目标映射与置信度。** 支持“角色 × 工作区 × 会话”的关系讨论，避免一宠只能有一个项目。概念定义高置信；AI 角色的状态恢复方案需独立设计。访问 2026-09-14。

### 10. Obsidian Workspaces：展示模式不是工作数据的所有者

**已证实事实。** 官方 Workspaces 文档定义其用于按写作、阅读等任务保存和切换应用布局；包含打开的文件/标签，以及侧栏宽度和可见性。[S20]

**可借鉴。** “三宠散布桌面”与“单位置切换”应当只切换展示方案。隐藏宠物仍保留 Thread、草稿和任务状态；改变桌面布局不应取消运行或搬移记录。

**不适用 / 边界。** Obsidian 的 workspace 在此是布局，不是独立知识库或任务运行边界。Wisp Pocket 已使用 Workspace 表示命名文件根，多宠排列应称“桌面展示方式”，避免同词多义。

**目标映射与置信度。** 直接支持两种显示模式与会话/运行生命周期解耦。官方定义高置信；对多窗口桌宠的性能与焦点不能外推。访问 2026-09-14。

### 11. Shimeji-ee：多宠同屏与每宠就地菜单的历史先例

**已证实事实。** 原 Google Code 项目归档说明允许多种 image sets 同时在桌面出现；Readme 写明启动时为每种 image set 生成一只宠物，右击某只宠物可执行针对它的操作。每种形象可分别覆盖 actions / behaviors 配置，运行时 Image Set Chooser 会记住此前选择。[S21]

**原文锚点。** “There can be several Shimeji types at once if you use multiple image sets”；“Right click the tray icon or the individual Shimeji for options”。这是不同形象同时存在与对象局部操作的直接证据。

**可借鉴。** 全局菜单管理出现哪些宠物，宠物本体的菜单管理“这只宠物”；形象与桌面实例数量分离。多宠的最初价值可以是容易认出不同对象，不需要默认赋予它们自动对话或协作。

**不适用 / 边界。** 原简介最后变更标为 2010-11-12，因此本节只证明历史版本，不代表 Kilkakon 当前发行版；当前网站本次返回 406。动画包和行为 XML 不等于 LLM 人设，更不等于文件拖入、历史或独立 runtime。自行分裂、移动其他窗口等游戏行为不适合默认用来安排用户工作。

**目标映射与置信度。** 支持多宠同屏与每宠操作归属。对历史文档事实高置信，对当前发布版未验证。访问 2026-09-14。

### 12. AIRI：按角色恢复会话的最直接源码先例

**已证实事实。** 官方角色卡文档包含名称、描述、性格、场景、开场白，可作为带有 manifest 与 card 的 zip 包导入，并可携带外观模型。角色选择器遍历角色卡，调用 `activateCard(id)` 切换单个当前角色；Session store 使用 `characterId` 创建会话，并在 `activeCardId` 变化时恢复或创建当前角色的会话。角色下有 Session 索引，选中的会话又明确归一个窗口，而非把所有窗口的选择强制同步。[S22][S23][S24]

**原文锚点。** Session store 注释：“pick (or mint) the active session for the current character”；“The selected conversation belongs to one window”。本轮同时检查调用点与存储写入，未只根据注释推断行为。

**窗口边界。** 桌面角色窗使用透明窗口配置，Chat 另有独立窗口构造与 `/chat` 页面。Chat 构造时 `show: false`，但随后在 `ready-to-show` 回调中显示，不能单看这个字段宣称完整聊天始终隐藏。[S25][S26]

**可借鉴。** Wisp Pocket 单位置切宠应指向稳定角色身份，再恢复该角色上次选择的 Thread；每宠允许多段历史，当前显示的只是其中一段。跨窗口同步后端事实与窗口各自选择是不同职责。角色外观包和工作材料分别设计，不让导入外观被误认为赋予文件或工具权限。

**不适用 / 边界。** 这是开发分支固定提交 `42e3e9e8573d3159d40e637fa11a21e13398ebda`（2026-09-13）的源码事实，未核验发布版。没有证据证明多个 AIRI 桌宠可同时在桌面持续执行独立任务，也没有证明任意文件拖到角色身上成为工作输入；角色窗口与 Chat 分离更不能证明无需 Chat 就能完成 99% 功能。

**目标映射与置信度。** 强映射每宠人设、单当前角色切换和独立 Session 历史；对源码结构高置信，对发行版 UI 和使用效果未验证。访问 2026-09-14。

## 从参考产品推导的设计约束

以下为研究建议，需要在项目设计和原型中验证，不是外部来源直接证明的必然结论。

| 要解决的问题 | 建议约束 | 反例 / 验证动作 |
| --- | --- | --- |
| 三宠同屏但接收者不清楚 | 每次输入都能看见接收宠名称、当前 Thread 与工作区；真正发送时绑定这组身份 | 拖入 A 后立即切到 B，附件和结果仍归 A |
| 单位置切换使工作“消失” | 展示选择与运行生命周期分离；槽位以外的宠物仍显示未读/等待确认汇总 | A 工作时切 B，A 完成后能从小标记回到原 Thread |
| 人设编辑污染旧记录 | Thread 创建时保存角色提示快照；旧对话继续沿用，新设定用于新对话 | 改 A 的工作提示后回看旧 Thread，身份与当时行为仍可解释 |
| 新话题意外接到旧任务 | 每宠有明确的继续当前 / 新话题入口；保留草稿并明确恢复对象 | 重新唤出后无需猜测是否续聊；输入未发送时切宠再回来不丢 |
| 附件从私有聊天扩散 | Thread 附件与未来可能增加的共享资料有显式不同操作与标签 | 把财务材料给 A，不因同 Workspace 自动将其加入 B 的上下文 |
| 切换宠物就是所有人共享一份历史 | 默认每个 Thread 有单一主归属；协作交接通过明确的摘录/材料发送 | B 接手时说明拿到了什么，原 A 的记录不改名、不消失 |
| 多宠导致三套同时抢焦点 | 角色可以多个可见，键盘编辑面一次只激活一个；切换保存草稿 | 连续点 A/B/C 后输入不会落到不可见编辑框 |
| 状态只靠宠物动作传达 | 表情配合文字状态和可恢复入口 | 用户不认识动画含义时也能判断执行、等待、失败、完成 |
| 气泡过小导致仍被迫开 ThreadWindow | 内容按需展开为宠物附着面板；承接历史、审批、工具进度、产物和配置 | 从交付文件到下载结果，全程可完成且无大聊天窗跳转 |
| 记忆与历史混为一谈 | 历史可查；未来增加记忆或共享资料时，范围、来源与删除效果独立可见 | 不能把删除 Thread 描述成不存在的记忆能力已经“全部忘记” |
| 动画装饰压过工作可靠性 | 动作先表达真实运行状态；随机闲置动作可调低或关闭 | 全屏工作、会议、减少动态效果设置下仍能收取重要状态 |
| 99% 目标被缩成“多数按钮能找到” | 用真实日常请求按频率测量完成路径，同时列出所有未覆盖流程 | 不能通过把失败/审批/设置从分母删除来提高比例 |

## 需要挑战的产品假设

- **“宠物越多越像团队”未获证。** 用户可能只想给不同风格一个易识别入口；同时出现三只不表示必须让三套 LLM 同时推理。先验证分工可理解性，再决定后台并发策略。
- **“每宠自己的历史”不等于“每个宠物只保留最近一次”。** 切宠后应恢复这只宠物上次选择的 Thread；历史入口应就在宠物身上。大量会话时同时提供搜索与工作区过滤，不能只靠滚动。
- **“一只宠物一个人格”不等于固定单一模型。** 用户识别的是角色和工作方式；来源已出现 Agent / Project / Model 的分离。模型可作为进阶配置，但切模型不能使记录归属改变。
- **“共享工作区”不等于默认共享全部私聊。** 资料、项目约束、会话正文、用户记忆可有不同范围；只有明确需要共享的内容才应成为别的宠物上下文。
- **“像对话”不要求把所有动作伪装成自然语言。** 确认、取消、选历史、预览附件仍可用明确按钮；宠物语气负责表达，操作负责可控。
- **“弱化 ThreadWindow”不是缩小现有 ThreadWindow 的尺寸就完成。** 轻量窗口是否仍需要用户先管理 thread、理解技术状态、寻找审批，必须用完整任务测试。原型应故意测试长回复、多个任务、失败恢复，而不只展示理想短对话。

## 证据来源与可复核锚点

所有链接访问日期均为 2026-09-14。GitHub README 的稳定提交链接用于重现本次观察；其余为会更新的官方页面。

| 编号 | 第一方来源 | 本文使用的锚点 / 边界 |
| --- | --- | --- |
| S01 | [VPet README](https://github.com/LorisYounger/VPet/blob/0304510c651fdec1332679db9f22291da9e696b9/README.md) | 互动、ToolBar / MessageBar、创意工坊扩展、素材许可；没有据此推断多 AI |
| S02 | [Desktop Mate 官方 Steam 页面](https://store.steampowered.com/app/3301060/Desktop_Mate/?l=english) | About This Software 多角色标 beta；同页 Yuzuki Yukari / Kizuna Akari 联合动作公告明确 Mac Open Beta 不支持多角色 |
| S03 | [Open-LLM-VTuber README](https://github.com/Open-LLM-VTuber/Open-LLM-VTuber/blob/992309c0aa19845960228f880013d4685fde93b5/README.md) | Features、长期记忆暂时移除、v2 规划状态 |
| S04 | [SillyTavern Character Design](https://docs.sillytavern.app/usage/core-concepts/characterdesign/) | 角色字段、持久 tokens、开场白、Prompt Overrides |
| S05 | [SillyTavern Group Chats](https://docs.sillytavern.app/usage/core-concepts/groupchats/) | Reply order；历史总共享；Join character cards 的混淆警告 |
| S06 | [SillyTavern Personas](https://docs.sillytavern.app/usage/core-concepts/personas/) | Persona 是用户身份；Chat / Character / Default locking |
| S07 | [SillyTavern World Info](https://docs.sillytavern.app/usage/core-concepts/worldinfo/) | 条件注入、预算；不保证模型输出使用相关内容 |
| S08 | [Raycast Quick AI](https://manual.raycast.com/ai/quick-ai) | 追问、上下文、完整历史迁移、闲置后新建 |
| S09 | [Raycast AI Chat](https://manual.raycast.com/ai/ai-chat) | 附件/历史/Agent/工具、跟进、后台通知及恢复目标 |
| S10 | [Google：Tips for creating custom Gems](https://support.google.com/gemini/answer/15235603?hl=en) | Persona / Task / Context / Format、预览不自动保存、知识文件 |
| S11 | [Claude：Chat Search and Memory](https://support.claude.com/en/articles/11817273-use-claude-s-chat-search-and-memory-to-build-on-previous-context) | 项目范围、记忆空间、历史引用、删除聊天与记忆的不同生命周期 |
| S12 | [Raycast Projects](https://manual.raycast.com/ai/projects) | 项目指令/记忆/本地目录；删除项目保留聊天 |
| S13 | [Claude：What are projects?](https://support.claude.com/en/articles/9517075-what-are-projects) | 项目拥有历史、知识库与指令 |
| S14 | [Raycast Screen Awareness](https://manual.raycast.com/ai/screen-awareness) | 交付来源、附件卡、抓取内容与失败/权限边界 |
| S15 | [AnythingLLM：Attaching vs RAG](https://docs.anythingllm.com/chatting-with-documents/introduction) | Thread 附件与 Workspace 嵌入资料的不同可见范围 |
| S16 | [AnythingLLM：Chat Modes](https://docs.anythingllm.com/features/chat-modes) | Workspace 级模式与 provider tool-calling 依赖 |
| S17 | [AnythingLLM：System Prompt Variables](https://docs.anythingllm.com/features/system-prompt-variables) | Workspace 提示、静态/动态变量与不同部署版差异 |
| S18 | [VS Code Profiles](https://code.visualstudio.com/docs/configure/profiles) | 配置集合、Workspace 关联、当前 Profile 可见性 |
| S19 | [VS Code：What is a workspace?](https://code.visualstudio.com/docs/editing/workspaces/workspaces) | 目录集合、作用域设置、UI 恢复 |
| S20 | [Obsidian 官方帮助源码：Workspaces](https://github.com/obsidianmd/obsidian-help/blob/master/en/Plugins/Workspaces.md) | Workspace 是应用布局；官方网页需前端渲染，改用其一方帮助仓库原文 |
| S21 | [Shimeji-ee 原项目简介](https://storage.googleapis.com/google-code-archive/v2/code.google.com/shimeji-ee/project.json)、[Readme 归档](https://storage.googleapis.com/google-code-archive/v2/code.google.com/shimeji-ee/wiki/Readme.wiki) | Google Code 原项目归档；多种形象同屏、每宠右键操作；只能证明历史版本 |
| S22 | [AIRI 角色卡说明](https://raw.githubusercontent.com/moeru-ai/airi/42e3e9e8573d3159d40e637fa11a21e13398ebda/docs/content/en/docs/manual/tamagotchi/character-card-template.md) | 人设字段、zip 导入格式、可附加模型；不是工作资料输入 |
| S23 | [AIRI 角色选择器](https://raw.githubusercontent.com/moeru-ai/airi/42e3e9e8573d3159d40e637fa11a21e13398ebda/packages/stage-ui/src/components/misc/character-switcher-drawer.vue) | selectCharacter → activateCard；单个 activeCardId |
| S24 | [AIRI Session store](https://raw.githubusercontent.com/moeru-ai/airi/42e3e9e8573d3159d40e637fa11a21e13398ebda/packages/stage-ui/src/stores/chat/session-store.ts) | createSession / characterIndex.sessions / ensureCurrentSession / activeCardId watcher；选择归属单窗口 |
| S25 | [AIRI 桌面角色窗口](https://raw.githubusercontent.com/moeru-ai/airi/42e3e9e8573d3159d40e637fa11a21e13398ebda/apps/stage-tamagotchi/src/main/windows/main/index.ts) | transparentWindowConfig；不用于推断系统上所有空间行为 |
| S26 | [AIRI Chat 窗口](https://raw.githubusercontent.com/moeru-ai/airi/42e3e9e8573d3159d40e637fa11a21e13398ebda/apps/stage-tamagotchi/src/main/windows/chat/index.ts) | 独立 Chat 窗；ready-to-show 会显示窗口 |
| S27 | [Raycast Agents](https://manual.raycast.com/ai/agents) | Agent 保存指令、模型和工具选择，区别于 Project 的共享背景 |

**未纳入结论的访问结果。** `https://manual.raycast.com/ai-chat` 和旧 AnythingLLM workspace 猜测路径已返回 404，已从各自官方首页导航找到上表的真实路径。Poe 博客请求返回 403、Character.AI 所尝试的 pinned-memories 路径返回 404，未用搜索摘要或记忆补足事实。没有访问成功不代表产品没有相关能力，只表示本轮没有足够一方证据。
