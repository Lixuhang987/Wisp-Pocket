# 手工验收清单

本文记录已实现、自动化测试不足以证明真实系统行为的回归项。仍未修复的缺陷放 [bugs.md](/Users/mu9/proj/handAgent/docs/bugs.md)。

## 验收前提

先完成依赖安装，并通过 `bash ./scripts/test.sh`、`bash ./scripts/swiftw test` 和 `bash ./scripts/swiftw build`。

## 时间上下文、system 持久化与历史范围（2026-10-04）

- **状态**：已实现并完成独立文档审核，完成 TODO 已迁入本节；规格见 [简版 spec](./medium-powers/specs/2026-10-04-time-context-draft.md)，流程与最终检查见 [实施记录](./medium-powers/plans/2026-10-04-time-context.md)。完整宿主与真实模型尚未验收。
- **自动化范围**：真实 Thread/SQLite 验证模型前落盘、模型失败、写入中断后接续、重启时间基准、连续活跃的小时阈值、项目规则替换/清除，以及 system 与气泡/计数/标题隔离；Swift 真 Store 验证本地偏移保存、重建、包含端点与过滤先于 limit。真实 Swift 夹具经 Node/Tool/Runtime 验证范围及本地输出。脚本模型证明请求内容与流程，不证明真实 provider 对时间的理解。
- **检查结果**：最终 TypeScript/Web、隔离 Foundation home 的 Swift test、Swift build 全部 success；专项 35 项及 ThreadPersistence 标题回归 9 项通过。本 spec 累计新增 3 项测试，其他扩展既有用例。
- **已确认限制**：首轮实际 Turn 注入，后续距最近保存注入严格超过 3600 秒才追加；小时内提示不是实时钟，不增加跨日/时区变化/回拨刷新、相对窗口、时钟工具或后台计时器。模型须显式传 start/end；采样证据、默认 20/最大 200 的 limit 与采集空档不能证明完整操作过程。
- [ ] **真实首轮与界面**：新建空 Thread 后等待再发首条输入，核对实际模型请求的本地时刻/IANA 时区与工具规则、项目规则、角色；ThreadWindow/桌宠无 system 气泡，列表计数与标题只体现用户可见消息，不出现额外 pending 输入。
- [ ] **小时基准与重启**：在可控 QA 时钟下复验一小时内、整一小时及超过一小时，连续活跃仍按最近注入判断；停止并重启后再接续，已保存基准保留。核对时间提示是本轮开始时固定值，多次工具调用不重新刷新。
- [ ] **失败与中断**：使用可丢弃 Thread，在模型失败和 system 写入期间中断后接续，核对磁盘已确认的规则/时间仍保留且不重复；存储失败时不得先出现模型请求。区分已持久上下文与未确认写入，不能凭 UI 失败断言上下文被撤销。
- [ ] **规则与角色边界**：实际修改/清空/删除项目根 AGENTS.md 后下一轮采用最新值或清除旧值，同轮不变；内部历史可查旧版本，模型请求不再含旧规则。修改 Pet 角色后既有 Thread 保留创建快照，新 Thread 使用新角色；不提前采用 Issue #9 目标语义。
- [ ] **Swift/Node 时间对账**：采集真实活动与截图，核对索引秒粒度本地偏移、ID/图片/AX 关联；重启读回，查询旧 Z 记录也返回后端本地偏移且绝对时刻一致。显式 ISO/epoch 范围含两端，先过滤再倒序/limit，start>end 明确失败。
- [ ] **原问题回答复验**：真实模型回答“最近十分钟”时检查实际 start/end 与证据时刻，确认没有把最新 20 条当作十分钟，也没有把 UTC 小时当本地小时；若范围未明确、采集空档或 limit 截断影响结论，回答保留证据边界，不能宣称完整操作日志。

## Issue #8 Electron 设置与 Workspace/Pet（2026-10-04）

- **状态**：menu bar、独立 Electron 设置、后端配置接口、Workspace/Pet 拆分与项目历史已实现；完整宿主、真实模型与系统交互尚未验收。最终检查与独立文档审核状态见 [实施记录](./medium-powers/plans/2026-10-03-issue-8-settings-workspace.md)，本文不把替身用例视为实机证据。
- **规格与边界**：[Issue #8](https://github.com/Lixuhang987/Wisp-Pocket/issues/8)、[设置 surface](./surfaces/settings.md)、[ThreadWindow surface](./surfaces/thread-window.md)。MCP 仅配置读写，运行刷新仍在 TODO；不兼容旧开发 Workspace/Pet schema，不自动清理用户数据。
- **浏览器已验范围**：临时真实后端上的模型草稿跨页与保存、MCP 示例保存、伙伴描述保存、项目组内随机创建，设置桌面/窄屏布局已检查；证据路径见实施记录。该范围不覆盖原生 menu bar、焦点、picker、真实桌宠显隐与完整宿主。
- [ ] **常驻入口与草稿**：menu bar 只有“设置”，点击打开独立 Electron 窗口，首次进入 AI；切到其他页并编辑，重复点击仅聚焦并保留页与草稿，关闭后重开回 AI。普通 ThreadWindow 不获得目录、图片及全宠显隐管理权限。
- [ ] **模型与持久化**：分别保存 OpenAI-compatible 的接口模式及 Anthropic；明确看到成功/失败/校验反馈，失败保留输入。未点保存、切页不改运行配置；保存后下次真实请求生效，未展示的 summarizerModel 保留，API Key 不进入日志和错误详情。
- [ ] **Tools / MCP / Permission**：工具开关即时保存，默认文件/历史读取无禁用开关；stdio 全字段、streamableHttp headers、示例、编辑/删除后显式保存并重启读取，原始环境变量占位保留，反馈不称连接已刷新；永久允许/拒绝及时间显示正确，撤销后在其他 Pet 按原策略处理。
- [ ] **原生保留与主题隔离**：PromptPanel 进入原生外观、Host、触发器、Append Prompt 与全部快捷键；两种设置交错保存后主题与模型/Tool 配置均保留。亮色/暗色/跟随系统同步 ThreadWindow、设置和每宠，新建窗口使用当前主题；关闭窗口后 Context History、Automation 与 Agent 继续运行。
- [ ] **创建与同根复用**：新目录保存 Pet 后恰有一个 Workspace、一个基础 Pet 与一个用户 Pet；已有目录及符号链接别名复用同一项目，只增用户 Pet。丢 ACK 后重试与同目录并发不重复播种；重启身份一致，基础宠不替换全局默认。
- [ ] **两处伙伴管理**：设置与桌宠右键伙伴页均可编辑名称、描述、角色、图片、默认项、显示隐藏；创建目录 picker 可用，已有项目位置只读。并发 revision 冲突保留字段并明确错误，旧 Thread 保留旧角色；各宠显示、位置、大小、草稿独立。
- [ ] **项目历史与创建**：全部 Workspace 一级分组，组内含所有 Pet 历史且无 Pet 筛选/二级组；通用新建选项目，组内新建预选本组项目，可选本项目 Pet，不指定由后端分配。基础/隐藏 Pet 也为候选，重试不换 Pet；后台创建不抢选，桌宠仍只查询本宠。
- [ ] **逐 Turn 项目规则**：两宠共项目读取根 AGENTS.md，同轮流式/多次工具调用不因文件编辑改变规则，下一轮读取新内容；祖先/嵌套文件不注入。用户明确要求优先于项目规则、项目规则优先于角色；缺失为空、目录不可用或读取失败明确失败，身份与历史仍保留；同项目文件共享、不同 Thread 上下文不合并。
- [ ] **身份对账与原生窗口**：重连完整 Pet 快照清理失效窗口/路由/偏好，有效显隐/草稿保留；局部项目查询不清全局，目录故障不当删除。回归隐藏 Permission 非激活召回、接收期间延后回收，以及中文 IME、多屏、焦点、透明命中和长字段布局。

## 测试清理（2026-10-03）

- **范围**：删除文档措辞、源码 / CSS 写法、空 smoke、已移除入口的低价值测试；合并展开偏好加载 / 保存与历史侧栏重复断言，历史选择由已有真实 App 用例承接。详见[清理记录](./medium-powers/plans/2026-10-03-test-cleanup.md)。
- **保留验证**：Settings 控件 / 颜色规则继续由 SwiftLint 检查，主题生成 / 同步由现有生成器测试负责；桌宠 renderer、Electron 窗口、真实 Thread/Runtime/SQLite 的独有边界保留。
- **自动检查**：基线与清理后的 `bash ./scripts/test.sh`、`bash ./scripts/swiftw test`、`bash ./scripts/swiftw build` 均通过。原清理分支新增测试 0，测试声明 846 → 806，测试及辅助代码减少 855 行（该分支历史静态统计，参数化未展开，不代表当前合并后数量）。
- **合并复验**：已沿当前 Pet 语义解决冲突，保留结构化文件引用与 Markdown 回归；历史侧栏、展开偏好和真实 App 选择专项 13 项通过，合并后的 TypeScript/Web 与 Swift test/build 全部通过。独立文档审核已完成，未发现阻断不一致。
- **实机边界**：本轮没有产品行为变更，不新增实机验收项或通过结论；滚动、控件颜色、焦点与窗口布局继续按现有 QA 条目验收，静态 class / 源码断言不作为其通过证据。

## Markdown 与文件引用合并回归（2026-10-03）

- **已整合**：助手正文继续使用 Markdown / GFM；用户正文从结构化输入提取并保持原文，文件引用仅显示图标与文件名，不重复显示模型侧路径摘要。既有 hover 用例同时验证 Markdown 历史、流式正文、用户原文和文件卡片，未新增测试。
- [ ] 在同一对话发送带下划线、星号的文字及文件，确认常态 / hover / 历史恢复保留助手 Markdown、用户原文及文件名卡片；附件完整路径不作为正文显示，用户主动输入的路径仍按原文保留；输入节点、草稿和底部位置保持。
- 合并后的 `bash ./scripts/test.sh`、`bash ./scripts/swiftw test`、`bash ./scripts/swiftw build` 与 Electron build 均通过；独立子 agent 已完成规格、全部合入文件目录链及代码一致性审核，并更新过期文档。没有新增完整宿主实机验收结论。

## 桌宠 Markdown 正文（2026-10-03）

- **已实现**：助手正文支持 Markdown / GFM，用户原文保持；代码和表格折行，任务复选框只读，常态约三行高度预览与 hover 完整历史继续共用消息区。仅绝对 HTTP/HTTPS 链接交给系统浏览器，原始 HTML 与 Markdown 图片显示文字，不自动加载资源；用户主动交付的图片附件仍按原流程展示。
- **自动化检查**：`bash ./scripts/test.sh`、`bash ./scripts/swiftw test`、`bash ./scripts/swiftw build` 与 Electron build 均通过；扩展既有 renderer / 原生窗口流程，专项 29 项通过，新增测试 0。规格与测试范围见 [实施计划](./medium-powers/plans/2026-10-03-pet-markdown.md)。
- **受控渲染证据**：真实 Electron renderer / CSS / preload / ActivityWindow controller 加载协议 snapshot，长代码与表格宽度受气泡约束；hover 前后角色和 composer 屏幕位移均为 0。网页链接交给受控外部打开回调，页面仍为原始 file URL。截图、几何与临时夹具在 `.worktrees/pet-markdown/.cache/pet-markdown-{compact.png,expanded.png,geometry.json,harness.cjs}`；后端、屏幕 / 光标与外部打开使用 fixture，不代表完整宿主或真实系统浏览器验收。
- [ ] 真实模型流式生成标题、列表、强调、引用、代码、表格与任务列表；未闭合围栏继续输出后正文自然恢复，无重复消息或焦点丢失。hover 浏览旧消息时新增量不抢回底部，移出保留草稿。
- [ ] 明暗主题与紧凑预览清晰；短正文、长代码、宽表格和长链接不撑破气泡，回复框 / 角色底部稳定。块间距占用常态三行高度预算，列表或代码可能只显示部分块；窄栏折行导致复杂表格变长属于已知阅读边界，hover 可查看全文。
- [ ] 网页链接只在明确点击后打开系统浏览器，桌宠仍可回复；本地、相对、脚本与其他协议保留标签。HTML 按文字呈现、Markdown 图片只显示替代文字；用户输入中的路径、下划线和星号保持原文。

## 原路径文件引用附件（2026-10-03）

- **已实现**：`InputItem.pdf` 替换为 `file_reference`，桌宠选择和拖入原文件只保存路径元数据；桌宠 / ThreadWindow 的 pending、live、恢复消息显示文件图标与文件名，模型收到原路径文字，由 file.read 按需读取。
- **自动化检查**：TypeScript/Web 全套检查、Swift test/build 和 Electron build 均通过。本轮扩展既有测试、新增 0 项；真实 socket/Thread/SQLite 验证原路径与最新内容读取，真实 BlobStore 验证无输入副本及重建后的附件身份，renderer 验证文件选择、ACK、失败重试和附件展示。
- **受控渲染证据**：独立 Electron renderer / CSS / preload / 原生窗口控制器中，卡片仅显示“阅读资料.pdf”，路径不出现在历史 DOM；五次 hover 中输入 / composer / 角色屏幕位移均为 0。证据位于 `.worktrees/pet-file-reference/.cache/file-reference{.png,-geometry.json}`。后端、屏幕 / 光标和选择器使用 fixture；完整宿主与真实模型待验。
- [ ] 从 Finder 拖入 PDF / 图片或使用文件图标选择后发送：两端只显示文件名卡片，混合文字不重复、没有完整路径；只选文件不开始 Turn。关闭 / 重建后仍显示附件。
- [ ] 模型读取前修改原文件，确认 file.read 得到当前内容；移动 / 删除原文件后工具明确失败，历史卡片仍保留，不声称有文件副本。截图输入继续显示原图片并进入多模态模型。
- [ ] 多个长文件名、明暗主题、长历史滚动与 hover、透明命中、中文输入法及多屏边缘按真实宿主抽验。
- 文档已自行核对协议、翻译、持久化、两端 renderer、产品与 spec，并更新过期描述；侧聊天禁止子 agent，本轮没有独立 agent 审核。实施记录见 [计划](./medium-powers/plans/2026-10-03-file-reference-input.md)。

## 桌宠右键入口与悬停定位回归（2026-10-03）

- **合并前验证**：修复分支扩展既有 renderer 用例，23 项通过；真实 Electron renderer / CSS / preload / 原生控制器复现修复前标题上跳约 470px，修复后空对话连续五次移入 / 移出，标题、角色及回复框的屏幕坐标变化均为 0，路径 title 为 null；菜单截图已核对四个入口。系统屏幕 / 光标与后端采用受控 fixture，此结果不代表完整宿主实机验收。随后合入维护提交 `452c027` 只调整测试；本轮输入工具行已删除身份标题，当前 composer 坐标以以下新证据为准。
- **自动化检查**：合入 `452c027` 前，修复分支的 `bash ./scripts/test.sh`、`bash ./scripts/swiftw test`、`bash ./scripts/swiftw build` 与 Electron build 均通过；合并后再次执行上述检查均成功，renderer 专项 22 项通过。角色来源断言已移入既有 hover 用例，本修复新增 0 项；检查与独立审核记录见 [实施计划](./medium-powers/plans/2026-10-02-pets-default-reading.md#2026-10-03-桌宠回归修复计划)。
- [ ] 角色周围不设常驻管理入口，逐宠对话显隐恢复与点击语义保持；右键菜单提供伙伴 / 对话 / 隐藏及大小调节，短 ID 可区分同名宠。方向键、Escape、外部点击及应用失焦能正确导航 / 关闭。
- [ ] 对空对话、短回复、长历史反复进入 / 移出右侧对话；消息不闪烁或跳到顶部，角色 / composer 稳定，长历史可滚动，移出后焦点与草稿保留。中文输入法和多屏四角另作真实系统回归。
- [ ] 当前对话不显示身份标题气泡、创建时名字/版本、原角色提示或根目录文字 / 路径悬浮提示；伙伴管理 / Settings 仍可查看固定目录，文件交付及实际写入位置保持正确。

## 桌宠回复框聚焦样式（2026-10-04）

- **已实现**：回复框局部覆盖公共焦点轮廓；自动聚焦、点击或键盘聚焦不出现矩形边框，按钮键盘焦点提示及文件 drop 高亮保留。
- **自动检查**：`bash ./scripts/test.sh`、`bash ./scripts/swiftw test`、`bash ./scripts/swiftw build` 与 `pnpm --filter handagent-electron-shell build` 均通过；复用既有交互用例，新增测试 0。
- **浏览器已验范围**：真实 `PetReply` 与 CSS 的受控夹具复现修改前 2px 珊瑚色轮廓；修改后亮暗主题聚焦无轮廓，暗色键盘聚焦 `outline: none`、`border: 0px`，光标 / 输入焦点、Enter 提交、Shift+Enter 换行和发送按钮焦点提示正常。截图见 `.worktrees/pet-input-focus-border/.cache/pet-input-focus/{before,after-dark,after-light}.png`。本项不代表原生宿主与中文输入法实机验收。
- [ ] 在实际桌宠亮暗主题中分别点击角色自动聚焦、点击输入框、Tab 聚焦，确认无矩形边框且能继续输入；移出 / hover 保留焦点与草稿，中文候选确认不误发，Enter / Shift+Enter 正常。按钮仍有键盘焦点提示，拖入文件时目标高亮可见。

## 桌宠输入工具行（2026-10-03）

- **已实现**：输入下方文件 / 新建对话小图标；选择只暂存上下文，主动发送统一交付；发送按钮运行时切换停止；移除身份标题气泡。
- **自动化检查**：`bash ./scripts/test.sh`、`bash ./scripts/swiftw test`、`bash ./scripts/swiftw build` 与 Electron build 全部通过；renderer 24 项（交互 22、身份 2），本轮扩展既有用例，新增 0 项，#6=3 / #7=4 的累计预算不变。检查和独立文档审核见 [实施计划](./medium-powers/plans/2026-10-02-pets-default-reading.md#输入工具行实施2026-10-03)。
- **受控渲染证据**：本 worktree 的真实 renderer / CSS / preload / 原生控制器加载已选文件，连续五次 hover，输入、composer 与角色位移均为 0；工具行位于输入行下方（44px / 28px）。证据为 `.worktrees/pet-composer-icons/.cache/pet-composer{.png,-geometry.json}`；断连后端和屏幕 / 光标、选择器采用 fixture，只证明此布局，不代表完整宿主实机通过。
- [ ] 选择多个文件后只显示文件名，可移除；没有新增历史或开始 Turn。切历史 / 新建对话 / 隐藏 / 重启，各自文字和文件独立恢复；选择器打开期间切历史，完成后仍加入原草稿。
- [ ] 主动发送文字和文件、只发送文件；等持久 ACK 清理，期间新增文件与新编辑文字保留；接收失败与重建重试不丢资料、不重复创建。选择器期间隐藏角色仍能完成保存。
- [ ] 运行时同一按钮切为停止，停止保留草稿 / 文件且仅中断当前 Thread；Enter 可排队，中文 IME 与 Shift+Enter 正常；结束后恢复发送图标。新建对话图标切换并聚焦本宠 new 草稿（有暂存内容时恢复），首次发送才创建。
- [ ] 明暗主题、多个长文件名、限高文件滚动和长历史下工具行保持可点；多屏四角、透明命中、hover 与移出无跳跃；右键入口继续可用。

## Issue #6 / #7 默认读取与多桌宠（2026-10-02）

- **状态**：实现已落地；M01–M07、原生输入与真实模型理解均待验。2026-10-02 整合未启动完整宿主 App；2026-10-03 的 Electron 受控渲染证据见上节，不作为本组实机通过结论。自动化最终检查和独立审核结果见 [实施计划](./medium-powers/plans/2026-10-02-pets-default-reading.md)。
- **规格**：[Issue #6](https://github.com/Lixuhang987/Wisp-Pocket/issues/6)、[多桌宠验收](./medium-powers/specs/multi-pet-pocket-dialogue/acceptance.md)。原 Issue #7 的固定目录决定已由 Issue #8 拆分为固定 Workspace 根与 Pet.workspaceId；Thread 保存双归属与角色快照，执行根从 Workspace 派生。旧证据仍只适用于原构建，当前项目模型回归见上方 Issue #8。
- **自动化边界**：主路径使用真实 Thread / Runtime / SQLite、临时文件及 Swift 保存格式；模型 / 系统替身证明编排、图片承载、权限和恢复，不证明真实模型理解、TCC、窗口焦点或跨 App 拖放。最终通过状态以实施计划中的实际命令结果为准。
- **历史发布记录**：同日两个规格曾分别完成文档核对与三项提交检查；该记录只证明当时文档交付，不计为本次实现验证。原 Issue #1/#5 证据只适用于原构建；以下待验项已采用当前路径输入、Pet 归属和统一首轮语义。

| 编号 | 待验操作与可观察结果 | 状态 |
| --- | --- | --- |
| M01 | 创建五宠同屏，含同名、同图、同根；独立移动 / 缩放、重启，确认受管图片、位置、历史和唯一默认恢复；短 ID 可区分 | 待验 |
| M02 | Finder 图片 / PDF 原路径、文本及浏览器 URL 两处 drop；接收时转去操作或隐藏另一窗口，持久输入始终属于最终松手的 Pet / Thread，经过不提交 | 待验 |
| M03 | 从编辑器 hover、后台完成与主动输入，中文输入法组合时换宠 / 收起；记录前台与 key window，确认不抢焦点、不误发、不由隐藏输入面吃键盘 | 待验 |
| M04 | 各屏四角、混合缩放、负坐标、热拔显示器、Spaces / 全屏；角色与回复 / 召回入口可达，透明和裁剪外区域穿透 | 待验 |
| M05 | 点击输入、hover 全历史 / 长文、上翻、移出继续输入与切历史；隐藏宠收到 Permission 后无焦点抢夺地召回，选择不变；显式选目标 Thread 再答请求、停止并核对产物 | 待验 |
| M06 | 重建某宠 renderer、隐藏并召回；其他宠继续输入、请求与查看历史，后端执行不随窗口生命周期停止 | 待验 |
| M07 | 同根两宠保存 / 读取临时文稿，再修改角色并恢复旧对话；根创建后不可改，旧角色保持，同根文件共享而聊天隔离，伙伴管理 / Settings 的文件位置与真实产物一致 | 待验 |

- [ ] **真实读取与模型**：真实模型从桌宠与 ThreadWindow 首轮调用默认 file.read / 四个历史工具，无需 use_tools 或 Permission；实际文本、PDF、PNG/JPEG/WebP 与历史截图被理解，错误文件不被描述为已读。回归 PromptPanel 截图既有图片 / Blob 路径。
- [ ] **原文件生命周期**：交付时只持久化路径，模型调用前不预读；修改后再读为当前内容，移动 / 删除后明确失败；过去 Tool 结果保留而不承诺原文件副本。
- [ ] **采集状态与系统权限**：拒绝辅助功能 / 屏幕录制时设置说明真实失败，旧历史仍能读；授予后后续采样恢复。关闭窗口持续采集，退出停止；Automation 开关独立。
- [ ] **配置与后台归属**：Settings / 伙伴管理两端并发编辑保留冲突表单；编辑根只读。AgentTrigger 必须明确 targetPetId，有效事件创建该宠 Thread，失效目标可见失败且不改投默认宠。
- [ ] **创建确认丢失后删除**：先让后端创建成功但丢失 ACK，再从另一界面删除该 Thread；原窗口使用相同 commandId 重试，服务重启后再试，均明确 not_found，历史不复活、不重复执行首轮；真正的新话题仍可创建。
- [ ] **分页与失效选择**：准备某宠超过 50 段历史；ThreadWindow 能找到后续页并搜索 / 打开，桌宠“更多对话”不切选。离线删除当前旧选择后重连，resume 的 not_found 清除其草稿并回本宠历史或空态，其他宠不受影响；普通读取失败不能当作删除。
- [ ] **显隐、状态与角色来源**：不同宠分别展开 / 隐藏对话后重建 renderer，恢复各自状态；运行、完成和失败及时同步本宠历史列表且不抢选。修改当前宠名 / 图片 / 角色后，旧 Thread 的角色快照仍保留创建时名字与版本，当前对话不展示，实际提示使用旧角色，当前身份准确，固定目录在伙伴管理 / Settings 中可核对。
- **测试维护边界（2026-10-03）**：按每 spec 最多 4 个新增用例收敛，默认读取保留文本 / 历史、PDF 正文、PNG 主路径；JPEG/WebP、损坏 / 超限和非普通文件（含 FIFO）等失败矩阵不再逐 case 自动验证，仍按真实读取项人工抽验。Settings 冲突后保留表单也需人工验收；后端版本冲突与不可改根由真实管理流验证。显示器关联、删除重试、分页、显隐和状态已有相关自动化，均不替代本节实机待验。
- **延后项**：应用重启后未开始输入的继续 / 取消 / 展示策略仍在 TODO，本次没有新队列控制协议；停止当前 Turn 不承诺远程 Dynamic Tool 动作已撤销。

## 桌宠紧凑交互合并验证（2026-09-15）

- **范围**：在 `.worktrees/merge-pet-compact-20260915` 将 `codex/pet-compact-hover-20260914` 的 `f54d09f` 合入 `main` 基线 `9f0762b`；同步 [PRODUCT.md](./PRODUCT.md)、[桌宠 surface](./surfaces/desktop-pet.md) 与相关索引，移除已完成的桌宠布局待办。
- **合并核对**：四处文档冲突已解决，保留主分支的 ThreadWindow 选择修复说明、全功能 QA 进度及双方归档。12 个源码/测试文件与目标分支一致，未引入额外行为修改。
- **自动检查**：worktree 基线 `bash ./scripts/test.sh` 与 `bash ./scripts/swiftw build` 通过；合并后 `bash ./scripts/test.sh`、`bash ./scripts/swiftw test`、`bash ./scripts/swiftw build` 和 `pnpm --filter handagent-electron-shell build` 全部通过。
- **独立审核**：无继承上下文的子 agent 已阅读 Issue #5、实施计划及全部改动目录到 `handAgent.md` 的指南，核对 spec、代码和当前文档；澄清启动与主动隐藏、已实现方案和历史证据范围。137 个受影响文档本地链接与 `git diff --check` 通过。
- **实机边界**：本次未重新打包或运行 App，不新增实机通过结论。原功能分支的常态紧凑布局归档及部分原生验证仅证明其原环境；中文输入法、多屏/四角移动和真实透明穿透等仍按下方 Issue #5 条目复验。

## 本次合并验证（2026-09-14）

- **范围**：在独立 worktree 将 Issue #3/#4 合入 main，保留 Issue #1 桌宠及后端持久输入语义；实施与检查结果见 [合并计划](./medium-powers/plans/2026-09-13-issue-4-main-merge.md)。
- **自动检查**：验证桌宠与 ThreadWindow 的独立投影、首轮关联、忙碌/等待回复时立即提交、后端 pending、建议与唯一请求回执；同时验证内置模块 Provider 的当前声明、token 隔离、长调用、图片消费和正常退出取消落盘。`bash ./scripts/test.sh`、`bash ./scripts/swiftw test`、`bash ./scripts/swiftw build` 与 Electron build 全部通过；结果分别保存在本次合并 worktree 的 `.cache/issue-4-main-final-web-electron.json`、`issue-4-main-final-swift.json`。
- **审核与保留**：独立文档审核已核对 Issue #1/#3/#4、修改目录的逐级指南、代码与归档；本地链接及冲突检查通过，main 的桌宠布局、缩放、后端 Thread 与附件路径无非预期代码变化。
- **实机边界**：本次没有启动合并产物或操作已有 App，没有新增实机通过结论。Issue #1 尚未验收的分项继续保留；已归档的桌宠分项和 Issue #4 九项只证明记录中的构建与环境，不据此宣称合并产物已重新验收。

## Issue #4 内置模块验收状态

- **已归档**：CH1–CH5、AU1–AU3、HOST1 九项已在原功能分支完成，见 [实机归档](./archive.md)；不重新列为待验。实机使用 mock LLM 与真实系统、模块、存储及 Dynamic Tool 通路，未验证真实外部模型推理。
- **证据根目录**：`/Users/mu9/proj/handAgent/.worktrees/issue-4-builtin-modules`，现存脱敏汇总和原始证据清理边界见 [实施记录](./medium-powers/plans/2026-09-13-issue-4-builtin-modules.md)。可复用动作见 [实机步骤](./human/builtin-features-qa.md)。
- **未验边界**：macOS TCC 拒绝没有通过撤销既有授权实测；无可见窗口的 Swift Host 自激活未记为通过。九项通过不覆盖这两种场景。

## 待验收项

### 全功能补充回归（2026-09-14）

从主 checkout 的 `main` 打包，使用可丢弃资料；真实模型与可控 fixture 的结论分别记录。已有桌宠、Thread 与触发器详细分项继续按下文逐项验收，本节补足当前产品的其他入口。

- [ ] QA-INPUT 主动输入：PromptPanel 纯文字、Append Prompt、文本选区和区域截图可确认提交；取消捕获不提交，输入附件与实际选区/图像一致；ThreadWindow 可查看历史内容并继续回复。
- **QA-INPUT 本轮记录（2026-09-14）**：当前包的既有 `test` Append Prompt 经 Tab 追加，真实模型返回 `QA_APPEND_OK`，同一 Thread 继续回复返回 `QA_FOLLOWUP_OK`；UI 与 SQLite 的 `skill` / text 及两轮消息一致。截图热键确实启动系统圈选器，Escape 后无面板、无新增 Thread 或更新时间变化。文本选区未配置热键，已请求临时配置确认但尚未更改；自动化拖动两次落在 TextEdit 选区，窗口捕获与 Quick Look 可用，准确圈选和图片提交仍待验，不记产品缺陷。证据见 `.cache/live-qa-20260914/input-partial.json`；未提交的图片草稿、预览与新测试文稿窗口已关闭，原设置未变，App/后端保留供后续 QA。
- [ ] QA-SETTINGS 设置：模型 provider/API/model/base URL 保存与热加载、无效配置错误可见；主题同步 PromptPanel/Settings/ThreadWindow/桌宠，热键编辑与恢复正常；不输出模型密钥。
- [ ] QA-TOOLS 工具与桌宠：真实界面确认 Pet 归属、任意路径读取与固定根写入、权限本次允许/拒绝/记住决定、工具详情展开；MCP 配置的启用与错误可见，测试仅使用本轮临时文件根和可丢弃工具。
- [ ] QA-HOST 合并产物内置功能回归：按 [内置功能步骤](./human/builtin-features-qa.md) 验证常驻采集/查询、Automation 开关、录制/保存/重跑及失败记录；关闭窗口继续，禁用 Automation 停止其任务，重启持久化，退出取消结果落盘。该项验证当前合并产物，不改写原功能分支九项归档结论。
- [ ] QA-TRIGGER 触发执行：System Clock 到时只触发一次并保存 Thread；Chrome Bookmarks 当前 bridge 与 native host 可连通，扩展连接状态和文件夹更新可见，测试收藏触发正确提示词，重启后恢复连接。

### ThreadWindow 后台创建与主动选择隔离

- **状态**：2026-09-14 修复 `229d728` 已合入 main；主 checkout 的 TypeScript/Web、隔离 home Swift test、Swift build、正式模式打包、签名与包内 Web/Electron 文件一致性检查均通过。本组逐项实机回归，通过项进入 [归档](./archive.md)，下列分项仍待验。
- **自动化边界**：真实 Web App 的选择、草稿、提交目标、首轮关联、重复/失败创建回执的一次性消费和早到原生请求，以及 Electron parser/runtime/prewarmer 的目标交付和失败回执均已覆盖；TypeScript/Web、隔离 home Swift test、Swift build 与 Electron build 通过，结果见 [修复计划](./medium-powers/plans/2026-09-14-thread-window-selection.md)。JSDOM 和 Electron 替身不证明原生焦点或打包环境。
- **修复前证据**：主 checkout `.cache/live-qa-20260914/background-selection-repro.json`，`main / 52bc459` 包在 macOS 15.5 arm64 连续两次后台创建抢选，第二次报 `QA_SELECTION_FAILED`；返回 A 后草稿恢复。该最小 WebSocket 复现不等于完整 AgentTrigger 实测。

- [ ] **PromptPanel 明确目标**：分别在隐藏预热、已经可见、关闭后重建的 ThreadWindow 中提交唯一标记的首轮输入，确认打开的是本次 Swift 创建的目标、读取到其历史并可继续回复。在同一可见窗口中返回 A，原草稿仍保留；重建窗口按既有页面重建规则清空草稿。
- **PromptPanel 工具边界（2026-09-14）**：原生快捷键已打开主包面板，Host PID 26306 和后端正常；Computer Use 按主包完整路径两次超时，按 bundle ID 报多包歧义，按应用名误启动旧 worktree 包。误启动实例已停止，没有向面板输入或提交。已请求允许按主包 PID 使用原生 AX 操作，未获确认前保留本项；错误包的 status 127 不记为当前产品缺陷。主包设置 hash 未变，证据见 `.cache/live-qa-20260914/selection-fixed-promptpanel-tool.json`。
- [ ] **窗口与桌宠边界**：PromptPanel 打开历史时先隐藏面板且不恢复旧应用焦点；普通历史入口和无目标 focus 只打开或聚焦现有窗口。后台创建 B 后桌宠仍保持主动选择，A / B 的后续进度不抢选；ThreadWindow 的选择独立保持。

### 打包应用 Electron 冷启动回归

- **状态**：2026-09-14 默认冷启动、失效 binary 覆盖与完整生命周期的功能实测已归档；本节只保留启动就绪事件的直接观测。
- **自动检查**：`AppServicesTests`、`bash ./scripts/test.sh`、`bash ./scripts/swiftw test`（340 项）与 `bash ./scripts/swiftw build` 均通过。进程用例使用外部 pnpm/Electron 边界替身，只证明启动配置、真实 Process 与 ready 解码；实现及验证边界见 [修复计划](./medium-powers/plans/2026-09-14-packaged-electron-startup.md)。
- **原失败证据**：主 checkout 的 `.cache/live-qa-20260914/` 中 `baseline.json`、`app.log`、`plain-launch-error.log`；源码 `ca1c02b`、macOS 15.5 arm64，正常打开包与直接运行 binary 均出现 `env: electron: No such file or directory` / status 127，4317 未监听。原失败实例已停止，后端未启动。

- **剩余验证**：默认与失效 binary 两次启动直接捕获 `agent_server.health available=true`、`thread_window.prepared`，核对两者到达前不能提交、到达后首次提交打开 ThreadWindow；同时记录实际 runtime 和 main 路径。当前功能成功不代替内部事件时序证据。
- **当前证据**：`.cache/live-qa-20260914/lifecycle.json`；启动、焦点、真实回复、关窗后台运行、两种前台退出和重启历史恢复已进入 [归档](./archive.md)。失效覆盖仅保留在 Host 环境，子进程实际使用主 checkout runtime 与当前 bundle main。
- **未验边界**：stdout 与已过滤统一日志均未捕获这两个内部事件，不能推断消息时序；猜测的 `/health` 返回 404 不记为产品缺陷。无法定位 checkout 时保留全局 runtime 路径，不据此宣称自包含发行包，详见 [打包边界](./dev.md#打包边界)。

### Issue #1 月见八千代桌宠与 Thread 轻量对话

- **状态**：已实现；以下实机分项均待验收。
- **规格**：基础能力见 [Wisp Pocket #1](https://github.com/Lixuhang987/Wisp-Pocket/issues/1)；常态收紧、悬停统一滚动、点击显隐与首次文字见 [Issue #5](https://github.com/Lixuhang987/Wisp-Pocket/issues/5)，相关旧展示要求已被替代。
- **自动化入口**：`bash ./scripts/test.sh`、`bash ./scripts/swiftw test`、`bash ./scripts/swiftw build`、`pnpm --filter handagent-electron-shell build`；后端 `pet-conversation`、renderer `pet-interaction` 和原生边界 `pet-window` 用例不能替代本节实机验收。
- **材料与记录**：使用可丢弃的文本、PNG/JPEG/WebP 图片、可访问的公共网页链接与有可复制正文的 PDF；记录源应用、实际松手区域、Thread 身份、可见结果和必要系统证据。需要真实模型理解的项目使用有效 provider；可控 fixture 的结果单独注明。
- **本轮基线（2026-09-13）**：在用户指定分支的现有 worktree 验证，TypeScript/Web、Swift test/build 与打包均通过；源码为 `0194a22` 加开始时已有的 8 个未提交文件，差异快照和本轮日志保存在 `/tmp/issue1-live-qa-20260913-1030/`。使用默认 `dist/Wisp Pocket.app`、真实模型设置和独立桌宠位置文件；外置 `/tmp` 包缺少可解析的 `zod`，不作为本轮正常启动环境。
- **模型环境对照（2026-09-13）**：当前 provider 的 `responses` 路径出现空流或 `unexpected EOF`；同一 provider/model 的 `chat` 路径通过真实请求返回 `QA_OK`。图片测试临时将 `llm.api` 改为 `chat`；本轮结束时已恢复原始 `responses` 设置，原始文件 SHA256 一致，密钥备份已删除。对照结果见本轮 `evidence/chat-provider-probe.json`，设置变化与恢复依据见 `evidence/model-config-change.json`。
- **本轮结束（2026-09-13）**：启动/首次文字、移动/位置恢复、文本与图片两区域拖入已归档；用户确认的悬停视觉问题随后已实现修复，复验列在下方。链接及后续分项仍待验。App/后端与 4317 已停止，测试文稿和 Finder 窗口已关闭；浏览器空间 51 已由用户接管而保留。清理证据见本轮 `evidence/qa-paused-cleanup.json`。
- **浮动气泡与缩放调整（2026-09-13，已暂停）**：实现与独立文档审核已提交为 `2d21c16`，相关 19 项用例、TypeScript/Web、Swift test/build、Electron build、打包及产物一致性检查通过。仅完成当前包的常态截图和几何观察，右键缩放、悬停对照及交互复验尚未完成，本轮没有新增归档项。用户要求整理状态后暂停；本轮 App、后端、fixture 和测试底板均已停止。完整状态、证据、原有修改保护与恢复顺序见[暂停交接](./medium-powers/plans/2026-09-13-pet-floating-bubbles.md#暂停交接2026-09-13)。
- **常态收紧与统一浏览（2026-09-14）**：Issue #5 已实现并完成两轴代码审核与独立文档审核；最终 29 项交互/原生窗口边界、19 项真实 Thread/SQLite 用例、Electron build、仓库 TypeScript/Web、Swift test/build 和打包均通过。当前包已核对 210×44px、三行裁剪、零/一/四项自然叠加、统一滚动与再次展开回底、移出后保留焦点、点击显隐、首轮失败重试及顶部固定锚点。完整通过项由脚本归档，其余整项继续待验；详情见[实施计划](./medium-powers/plans/2026-09-14-pet-compact-hover.md)。
- **本轮实机边界**：UI 使用本地通知夹具，不能替代真实模型及持久化验收；中文输入法、多屏与四角移动、真实透明穿透仍待复验。Computer Use 指针事件未同步到系统光标，未把角色移动或底板点击未发生计作产品缺陷。所有本轮测试进程及 4317/4328/9237 端口已清理。

- [ ] 角色图集与主题：观察空闲、处理、等待、失败和移动状态，角色不闪透明空帧；亮暗主题文字可读，启用减少动态效果后动画停止。
- [ ] 角色大小与持久化：默认角色为原图集显示尺寸的三分之二；右键菜单选择“调整大小”打开滑杆，分别设为新默认的 50%、100%、150%，重启后恢复选择，点击恢复默认回到 100%。只显示角色时也能打开大小控件；Escape、关闭按钮、点击外部或窗口失焦可关闭，右键不开始拖动或提交消息。
- [ ] 缩放与对话布局隔离：保存一份回复草稿，缩放前后比较截图及 DOM 几何；只改变角色和实际命中范围，角色右下锚点、右侧对话列位置、气泡宽度/字号、输入框与草稿保持不变，缩小后空出的区域可穿透。大小偏好存储不可用时本次调整仍可用。

- [ ] 屏幕边缘：移动到四边与角落，再悬停/移出对话区，并增加长建议；角色与回复框留在可用工作区。常态和悬停都只利用锚点上方空间，顶部不足时裁剪上方内容，回复框与角色屏幕位置保持；悬停可滚动查看完整内容，多屏切换或工作区变化后仍可找回。
- [ ] 透明命中：桌宠置顶，窗口透明空白及独立气泡间隙可点击下方应用；常态顶部裁剪及悬停滚动后，被裁掉的消息或建议不拦截点击。角色、可见气泡、建议与回复控件仍可接收点击、滚动和跨应用拖放。

- [ ] 链接两区域拖入：从浏览器拖出公共网页链接，分别松手角色与气泡/历史，确认分流正确，并依据实际网页正文给建议，不能仅复述 URL。
- [ ] PDF 两区域拖入：从 Finder 拖入有已知正文的 PDF，分别松手角色与气泡/历史，确认分流正确，建议能引用实际正文，历史保留文件名。
- [ ] 最终松手判定：同一次拖动先经过角色再经过气泡，并反向重复；高亮与“新对话”/“添加到当前对话”提示随目标变化，经过不提交，只按最终松手区域创建或追加。
- [ ] 按需读取与追问：松手后提交普通输入；模型按任务需要调用读取工具，依据真实内容回答、追问或按明确要求执行，无首次只能分析阶段。其他工具仍遵守激活与 Permission。
- [ ] 建议与普通消息：当前建议与回复框位于角色右侧，常态即可操作可见选项；在等价样本中点击建议、输入同一句话、输入不同自由回复，都形成普通用户历史并继续同一 Thread，后续执行及结果留在桌宠消息中。全部选项自然换行增高，超出上方空间时悬停统一浏览，回复框保持可用。
- [ ] 持续等待：建议或追问放置超过一分钟仍在等待，不自动执行、重试或消失；普通回复能立即继续处理，不被排在等待结束之后。

- [ ] 常态最新消息：短正文按内容收紧，长正文只显示开头最多三行且内部不能滚动；用户新消息和工具调用不替换最新非空 assistant 正文。无历史时可仅显示空回复框，不显示虚构的 assistant 正文。
- [ ] 悬停统一浏览：角色在左下、对话列在右；仅进入对话区展开，移出立即回常态。历史消息、完整最新正文、全部当前建议与 Permission 请求共用一个滚动容器，最新正文不重复；消息仍左桌宠、右用户独立呈现，容器透明，回复框固定在容器外。
- [ ] 历史滚动：每次进入悬停均回到底部，切换 Thread 后展示新 Thread 的最新内容；同次展开在底部时跟随流式增量、建议和新消息，手动上翻后不抢回底部。移出再进入应重置到当前底部，正文和建议均无嵌套滚动区。

- [ ] 输入焦点：点击角色唤出后无需再点输入框即可键入；只因聚焦不展开历史，hover 与后台更新不抢其他应用焦点。输入后移出对话区立即回常态，回复框保持位置、焦点和草稿，可继续输入；中文输入法候选确认与 Enter/Shift+Enter 正常。
- [ ] 隐藏与恢复：角色单击切换整套对话显隐，气泡不再有 ×；再次唤出聚焦并继续原草稿。隐藏期间普通后台进度、结果、错误和新 Thread 不弹回；主动点击 / 拖入可恢复，有效 Permission 请求按 M05 例外召回；角色拖动结束不误触切换。隐藏不提交消息、不回答询问、不取消任务。
- [ ] 路径接收期间隐藏：分别向角色与对话区拖入图片/PDF，在“正在接收…”时单击角色隐藏；路径取得与提交完成、Thread 创建通知或保存错误均不弹回，输入仍按松手目标新建或追加。再次点击恢复并聚焦，不因隐藏取消已交付的输入。
- [ ] 首次文字：在隔离的无历史环境点击打开空回复框、取消再打开，发送前不创建 Thread；首次发送只创建一个 Thread，接收后历史包含该输入，后续回复继续同一 Thread。创建或提交失败保留可编辑草稿并说明错误，重试已有空 Thread 也等待接收确认；确认不擦掉随后新编辑的文字，发送期间隐藏后确认或错误均不弹回。
- [ ] 本宠 Thread 选择：在 A 编辑草稿时后台创建 B，A 选择和草稿不变；从本宠对话弹层主动选 B，再切回 A 恢复草稿；其他宠历史不混入。
- [ ] 两界面共享：桌宠与 ThreadWindow 打开同一 Thread，用户输入、assistant 回复、建议及附件内容一致；从任一界面回复后另一界面不继续显示过期建议。从完整窗口删除当前 Thread 后，桌宠在线及重连时均切换到本宠仍存在的最近更新历史，列表为空时清空展示。
- [ ] Permission 唯一回执：两界面呈现同一真实请求，从一端回答后两端都清理；快速竞争回答只应用一个结果。建议按钮仍走普通消息，权限仍走各自请求控件。
- [ ] 执行中排队：当前执行期间分别从桌宠和 ThreadWindow 追加文字/拖入内容，立即看到“待处理”；当前工作不中断，结束后按接收顺序继续处理，待处理标记随开始消除。
- [ ] 重启后的未处理输入：等待前一任务时提交后续输入，确认已经接收后重启；文本/链接、附件和未开始输入仍在同一 Thread 历史并保留待处理状态，下一次回复可继续处理。
- [ ] 图片/PDF 路径：输入接收后移动或删除原文件，再重启打开历史；输入仍显示文件名卡片且不显示原路径，后续 file.read 明确失败，不声称保存了用户资料副本。角色配置图片与 PromptPanel 直接图片另验其 Blob 副本。
- [ ] 读取失败后回复：使用损坏图片、损坏/加密/扫描 PDF 或不可读取网页；输入仍保留，桌宠说明具体障碍并等待消息，补充正文或回复后可继续，不能假报已读。
- [ ] 连接与运行恢复：短暂中断服务后桌宠重新连接并恢复当前 Thread；主动隐藏状态在同一 renderer 内保持。若已有 Turn 因服务重启中断，历史明确说明，未开始输入不被当作失败执行自动重放。

### Wisp Pocket 品牌与桌宠命名

- **状态**：已实现，待打包与实机确认。
- **自动化验证**：`bash ./scripts/test.sh`、`bash ./scripts/package-app.test.sh`、`bash ./scripts/swiftw build`。
- **验收步骤**：
  1. 打包后确认产物名称为 `dist/Wisp Pocket.app`，Finder、Dock 和菜单栏显示名为 `Wisp Pocket`。
  2. 打开 PromptPanel、ThreadWindow、权限错误提示和 Chrome Bookmarks 扩展相关界面，确认用户可见产品名统一为 `Wisp Pocket`。
  3. 确认桌宠相关文案使用“桌宠”或“月见八千代”，不把桌宠称为“Wisp”。
  4. 确认 Swift target、npm package、环境变量和协议事件等内部构建标识仍可正常工作。

## 文档卫生回归

- **整体产品与 surface 记录（2026-09-15）**：新增 [PRODUCT.md](./PRODUCT.md) 与 [surface 索引](./surfaces/surfaces.md)，记录四个主要界面和 Settings 九个子页；产品文档集中维护，界面现状与待实施方案分开。已核对 55 个本地链接、四份 brief 的六块结构和 `git diff --check`；同次纯文档任务的 `bash ./scripts/test.sh`、`bash ./scripts/swiftw test`、`bash ./scripts/swiftw build` 全部通过。未修改应用代码，未进行新一轮实机/视觉验收。
- **本次文档待核验**：从 `AGENTS.md → docs/docs.md` 进入产品文档与 surface 索引，确认四个界面的任务边界易于理解；对照现行 App 核验布局记录，重点核对已合入的 Issue #5 点击输入、常态收紧与悬停统一浏览；原功能分支实机证据不等于本次合并产物已复验。产品人群细分、成功指标与导航调整仍保留待决。
- **范围**：`AGENTS.md`、`CONTEXT-MAP.md`、三个 `CONTEXT.md`、`handAgent.md`、`README.md`、`DESIGN.md`、各级目录指南与 `docs/*.md`。
- **验收步骤**：
  1. 按 `AGENTS.md -> CONTEXT-MAP.md -> 相关 CONTEXT.md -> handAgent.md -> apps/packages/docs` 阅读，确认每级索引只列直接子节点。
  2. 检查三个 `CONTEXT.md`：每个术语只有一个 owner，定义不包含类名、路径或实现步骤，并明确必要的 Avoid 同义词。
  3. 抽查 Thread、Append Prompt、AgentTrigger 与 Automation 文档，确认使用 glossary 规范词，没有重新复制术语定义。
  4. 打开 `README.md`，确认产品术语一致且不引用缺失资源；打开 `DESIGN.md`，确认 token 源只指向 `design/tokens.json`，不再链接已删除过程稿。
  5. 打开 Settings 相关文档，确认 `SettingsTextField` / `SettingsPage`、dark theme 可读性和 `SwiftLint` 约束仍可追踪。
  6. 打开 `bugs.md`，确认只保留未修复缺陷；已实现待验收项在本文。
  7. 从 `AGENTS.md` 的 `Agent skills` 区块进入 `docs/agents/`，确认 GitHub Issues、默认 triage 标签和 multi-context 消费规则仍一致。

### README 产品介绍

- **状态**：已合并面向用户的产品介绍与桌宠当前能力，待 GitHub 页面展示验收。
- **合并整理（2026-09-13）**：已对照双方提交、规格和目录文档解决 README / TODO 冲突，保留产品介绍结构、桌宠能力与后续规划；TODO 中过期的实现准备项已移出，桌宠实机待验项继续按上文核对。
- **合并前的 README 验证（2026-09-13）**：README 的 9 个链接、锚点和 Markdown 结构检查通过；`bash ./scripts/test.sh`、`bash ./scripts/swiftw build` 通过。`bash ./scripts/swiftw test` 执行 312 项，其中 `AppCoordinatorTests.testThreadWindowOpenAckDoesNotPromoteSwiftHostPolicy` 与 `testThreadWindowClosedDoesNotDemoteSwiftHostPolicy` 失败，复跑一致；对应代码与测试未修改。
- **合并后验证（2026-09-13）**：`bash ./scripts/test.sh`、`bash ./scripts/swiftw test`、`bash ./scripts/swiftw build` 与 `pnpm --filter handagent-electron-shell build` 全部通过；合并前记录的两项 Swift 失败未再出现。README、TODO 与本文的本地链接 / 锚点、冲突标记和 `git diff --check` 检查通过。
- **验收步骤**：
  1. 从首页阅读使用场景，确认能理解快捷键输入、桌宠资料拖入、近期活动检索和收藏触发任务各自解决的问题。
  2. 确认 Context History 常驻、Automation 独立默认关闭，默认历史 / 文件读取与 Pet 固定根表述一致；多宠与本宠历史切换已实现但原生交互仍待验，分享 / 标记和个人记忆仍是后续规划。
  3. 检查顶部导航、工程设计表格、开发验证折叠区及文档链接，确认在 GitHub 页面可正常阅读与跳转。
  4. 检查 TODO，确认已实现的桌宠基础能力不再列为未实现，后续能力与实机待验项分别保留在对应清单。

### 桌面 Agent UI 参考研究

- **状态**：研究与来源核验完成，视觉方向待选择；本次仅新增研究文档与索引。
- **入口**：[研究索引](./research/research.md)。
- **研究提交时检查（2026-09-13）**：`bash ./scripts/test.sh`、`bash ./scripts/swiftw build` 通过；`bash ./scripts/swiftw test` 执行 312 项，仍为上文合并前 README 验证记录中的两项失败，研究提交未修改相关代码。
- **人工核验步骤**：
  1. 从 `docs.md` 进入研究索引和桌面 Agent 参考，确认每级只列直接子节点。
  2. 打开候选的官方界面与演示链接，确认截图版本、平台与本机 / 云端执行边界均有说明。
  3. 用同一生活任务比较输入、执行中、需要确认、完成与回访状态，选定主视觉与局部交互参考；不把研究建议视作已实现能力。

### ThreadWindow Radix UI 弹出层迁移

- **状态**：已实现，待实机 QA。
- **自动化验证**：`pnpm --filter handagent-thread-window-web exec vitest run tests/composerInputItems.test.ts`、`pnpm --filter handagent-thread-window-web test`、`pnpm --filter handagent-thread-window-web build`、`bash ./scripts/test.sh`。
- **验收步骤**：
  1. 打开 Electron ThreadWindow，在 Composer 输入 `/`，确认 slash popover 在输入框附近显示且不被裁剪。
  2. 用过滤词、`ArrowUp`、`ArrowDown` 和 `Tab` 验证候选高亮、选择和 textarea 焦点。
  3. 用 `Escape` 和点击外部区域验证 popover 关闭并清除 `/` 前缀。
  4. 缩小窗口高度，确认 popover 自动避让或保持在视口内可滚动。
  5. 点击历史 thread 删除按钮，确认 Radix AlertDialog 居中、`Escape` / 取消不删除、确认后删除。

## AgentTrigger 设置二级菜单与默认 Package

- **状态**：已实现，待实机 QA。
- **自动化验证**：`bash ./scripts/swiftw test --filter AgentTriggerStoreTests`、`bash ./scripts/swiftw test --filter AgentTriggerSettingsViewModelTests`、`bash ./scripts/swiftw test`、`bash ./scripts/swiftw build`、`bash ./scripts/test.sh`。
- **Chrome bridge 核对（2026-09-14）**：真实 runtime、Provider、Network listener 与 HTTP 在临时 home 连续 20 轮 reload 通过；每轮按磁盘 `bridge.json` 的 host/port/token 请求 hello 和文件夹快照，并读回落盘结果。三项最终检查通过，Swift suite 在已确认 Foundation home 重定向的临时环境执行 342 项；结果与测试隔离见 [核对计划](./medium-powers/plans/2026-09-14-chrome-bridge-verification.md)。本轮只改测试，历史 Chrome P1 仍留在 [bugs.md](./bugs.md)，未新增实机通过结论。
- **实机补验边界**：环境可用后从主 checkout 打包并启动，确认当前 App 是 bridge 发现文件的写入者；经产品 native host 发送 hello / folderTreeSnapshot，核对 Settings 连接状态、文件夹选择与保存，再实际收藏并验证提示词及 Thread，重启后复验连接。当前单进程 HTTP 结果不证明这些步骤，也不证明多个 App 实例并行时发现文件正确。
- **验收步骤**：
  1. 备份并删除 `~/.spotAgent/agent-triggers/`，启动桌面 App，确认 Settings -> 触发器一级页直接显示 `Chrome Bookmarks` 与 `System Clock`。
  2. 进入 Chrome Bookmarks 二级页，确认顶部 name / description、空态、新增自动化和返回一级可用。
  3. 创建 Chrome Bookmarks AgentTrigger Instance，验证标题、收藏夹选择和提示词的必填校验；保存后确认列表和 `instances.json` 同步。
  4. 进入 System Clock 二级页连续创建两条 AgentTrigger Instance，确认列表和磁盘持久化都包含两条。
  5. 删除某条 Instance，确认列表立即移除且 runtime reload。
  6. 删除内置 package 目录后重启，确认启动期恢复内置 manifest，且不覆盖用户已有实例。

## 默认 Websearch 与 Responses SSE 回归

- **状态**：已实现，待真实 provider 实机 QA；上次阻塞在本地 provider 返回 401 invalidated oauth token。
- **自动化验证**：`pnpm exec vitest run packages/core/tests/tools/websearch-use-cases.test.ts packages/core/tests/permission/security-use-cases.test.ts packages/core/tests/llm/vercel-client.test.ts`、`bash ./scripts/test.sh`。
- **验收步骤**：
  1. 在启动 agent-server 的环境提供有效 `TAVILY_API_KEY`，并配置可用的 OpenAI-compatible `responses` provider。
  2. 提交需要近期信息的问题，确认模型未先调用 `use_tools` 也能直接使用 `web_search`。
  3. 确认 `web_search` 返回 URL、snippet、source；随后让模型用 `fetch_page` 精读其中一个公共 URL。
  4. 确认 Responses SSE 中连续 JSON 事件不会再触发 `JSONParseError`，并能生成最终回答。
  5. 去掉 `TAVILY_API_KEY` 后重启，确认 `web_search` 返回明确缺 key 错误且 App 不崩溃。
  6. 请求抓取 localhost、127.0.0.1 或私网地址，确认 `fetch_page` 拒绝。

## Issue #3 前后端状态所有权收敛

- **状态**：前端职责拆分与后端保留核查已完成，输入行为已按 Issue #1 的后端持久队列对齐；本组逐项实机回归，通过项进入 [归档](./archive.md)，下列分项仍待验。自动化与提交前检查结果见 [规格入口](./issue-3-design.md)；构建、store 测试与静态组件渲染不计作实机验收。

- [ ] **提交与待处理**：空闲、运行和等待普通回复时分别提交输入；确认均立即发送、接收确认后显示 pending，后端按接收顺序处理，各自开始后只清除对应标记，A、B 互不影响。前端不提供移除已提交等待项的操作。
- [ ] **首轮关联与占位**：经 preload initial-prompt fallback 连续创建两个 Thread，交错返回创建通知；核对各自先加载再提交首轮，snapshot 保留首轮摘要占位，正式输入记录替换本地摘要且保留其他已保存 pending，内容不串线。
- [ ] **历史与流式展示**：显式打开历史 Thread，核对文本、图片、Append Prompt 和文本选区内容；连续回复更新同一消息，重复 assistant delta 不重复显示。后台创建抢选已由独立任务修复，按 [选择隔离回归](#threadwindow-后台创建与主动选择隔离) 验收，不改写原 Issue #3 实施范围。
- [ ] **请求面板**：在不同 Thread 触发 Permission / Workspace 请求，回答后确认只清理对应面板；分别检查完成、中断、失败和 Thread error 后的请求清理及另一 Thread 的面板保留。
- [ ] **连接与缓冲**：延迟 socket open，核对已缓冲命令和 ClientResponse 的发送顺序；意外断连后显示 disconnected 并禁用 Composer，ThreadWindow 保持无自动重连与自动订阅恢复；显式 resume 可恢复 snapshot 中的待答请求，桌宠重连按 Issue #1 条目另验。
- [ ] **宿主窗口回执**：关闭 Settings 后从 PromptPanel 提交，确认隐藏面板时 Swift Host 回落到 accessory；ThreadWindow 打开回执和关闭均不再次改变 Swift Host 的 Dock / Cmd+Tab 可见性。本轮只校正相关测试的观察阶段。

## Issue #2 后端 Thread 所有权重构

- **自动化状态**：实现与自动化回归已提交；以下项目保留为真实 agent-server / UI 环境的人工验收。

- [ ] 执行期间关闭全部 Thread UI 连接，确认 Turn 继续运行；重新连接后用 `thread.resume` 读取结果。
- [ ] 在权限请求中分别选择“本次允许”和“永久允许”，确认永久规则在另一 Thread、不同参数和重启后仍按完整工具名称命中。
- [ ] 在执行中删除 Thread，确认后端报告删除成功且晚到模型 / Tool 结果不会重新创建历史。
- [ ] 人工注入数据库写入失败，确认 Thread 暂停后续输入，恢复后只基于已保存历史继续。
