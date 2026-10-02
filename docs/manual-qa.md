# 手工验收清单

本文记录已实现、自动化测试不足以证明真实系统行为的回归项。仍未修复的缺陷放 [bugs.md](/Users/mu9/proj/handAgent/docs/bugs.md)。

## 验收前提

先完成依赖安装，并通过 `bash ./scripts/test.sh`、`bash ./scripts/swiftw test` 和 `bash ./scripts/swiftw build`。

## 默认读取工具规格发布（2026-10-02）

- **状态**：中文规格已发布为 [Issue #6](https://github.com/Lixuhang987/Wisp-Pocket/issues/6)，标签为 `ready-for-agent`；本轮仅交付规格与 [ADR 0004](./adr/0004-context-history-default-tools.md)，尚未实现，不计为产品实机验收通过。
- **范围**：共享后端默认开放历史读取、任意路径 `file.read` 和按需 `user.ask`，取消 `mode` / `inspect/reply`；输入前端只调整桌宠，PromptPanel 截图继续现有图片协议，ThreadWindow 前端保持现状。Swift 常驻采集与设置状态按已确认决定调整。
- **规格核对**：用户已确认真实 Thread/Runtime/SQLite 主路径测试边界；已回读 Issue 的 33 条用户故事、21 项自动化验收及实机范围，核对 `ready-for-agent` 标签。文档一致性与 diff 检查通过。
- **提交检查**：TypeScript/Web、Swift test/build 三项检查均通过；Issue 正文与发布稿一致，6 个新增本地文档链接有效。本轮仅修改文档，不新增产品行为或实机通过结论。
- **后续验收**：实现后按 Issue 验证首次工具可见、免确认读取、原路径变更/失效、图片实际进入模型及采集失败时旧历史可查；原生拖入和真实模型理解另做实机 QA，回归未修改的 PromptPanel / ThreadWindow。

## 多桌宠规格文档交付（2026-10-02）

- **状态**：[A「口袋对话」spec](./medium-powers/specs/multi-pet-pocket-dialogue/multi-pet-pocket-dialogue.md) 已发布为 [Issue #7](https://github.com/Lixuhang987/Wisp-Pocket/issues/7)，标记 ready-for-agent，未实现多宠能力。本项记录文档交付，不计为产品实机验收通过。
- **最终范围**：自由创建 N 宠同屏，每宠角色提示 / 静态自定义图片 / rootPath，Pet 直接替代 Workspace；文件根可重复、Thread 按 petId 区分，不做跨宠转交。file.read 默认开放、任意路径、免 Permission；原文件路径交付，不预读或复制用户资料。写入仍受 Thread 快照文件根与 Permission 限制。
- **交互边界**：点击唤出并聚焦、常态最新消息、hover 当前 Thread 全部历史、移出收起且保留焦点 / 草稿。隐藏宠的有效 Permission 请求使它重新显示到桌面而不抢焦点；同宠其他 Thread 由用户显式选择，不增加特殊提醒或自动切选。
- **范围删减**：不做宠物归档、旧 API 兼容或旧开发数据迁移；不接收桌宠截图 / 剪贴板图片，删除额外键盘 / VoiceOver 设计与验收条款。应用重启后的排队消息处理单列 TODO。
- **决策核对**：[实现前九项决定](./medium-powers/specs/multi-pet-pocket-dialogue/implementation-questions.md)已由用户回答，统一 [ADR 0004](./adr/0004-context-history-default-tools.md)、PRODUCT 与 spec；仅文档修改，尚未执行数据重建。
- **规格发布**：Issue 正文内嵌完整数据 / 交互 / 验收与确认决定，引用 Issue #6 的共享后端规则；正文与发布稿一致，ready-for-agent 标签、34 条故事 / 28 项自动化 / 7 项实机验收回读通过；本轮链接 / diff 与 TypeScript/Web、Swift test/build 三项检查均通过。
- **后续验收**：按当前 34 条用户故事、T01–T28 自动化场景和 M01–M07 实机场景补证据；现有单宠 QA 不能作为多宠通过证明。
- **本轮验证**：本轮规格链接 / 编号 / 范围 / diff 与 TypeScript/Web、Swift test/build 三项检查均通过；仅修改文档，不新增产品实机通过结论。

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
- [ ] QA-TOOLS 工具与工作区：真实界面完成 Workspace 选择、文件读写、权限本次允许/拒绝/记住决定、工具详情展开；MCP 配置的启用与错误可见，测试仅使用本轮工作区和可丢弃工具。
- [ ] QA-HOST 合并产物内置功能回归：按 [内置功能步骤](./human/builtin-features-qa.md) 验证开关、采集/查询、录制/保存/重跑及失败记录；关闭窗口继续，禁用停止，重启持久化，退出取消结果落盘。该项验证当前合并产物，不改写原功能分支九项归档结论。
- [ ] QA-TRIGGER 触发执行：System Clock 到时只触发一次并保存 Thread；Chrome Bookmarks 当前 bridge 与 native host 可连通，扩展连接状态和文件夹更新可见，测试收藏触发正确提示词，重启后恢复连接。

### ThreadWindow 后台创建与主动选择隔离

- **状态**：2026-09-14 修复 `229d728` 已合入 main；主 checkout 的 TypeScript/Web、隔离 home Swift test、Swift build、正式模式打包、签名与包内 Web/Electron 文件一致性检查均通过。本组逐项实机回归，通过项进入 [归档](./archive.md)，下列分项仍待验。
- **自动化边界**：真实 Web App 的选择、草稿、提交目标、首轮关联、重复/失败创建回执的一次性消费和早到原生请求，以及 Electron parser/runtime/prewarmer 的目标交付和失败回执均已覆盖；TypeScript/Web、隔离 home Swift test、Swift build 与 Electron build 通过，结果见 [修复计划](./medium-powers/plans/2026-09-14-thread-window-selection.md)。JSDOM 和 Electron 替身不证明原生焦点或打包环境。
- **修复前证据**：主 checkout `.cache/live-qa-20260914/background-selection-repro.json`，`main / 52bc459` 包在 macOS 15.5 arm64 连续两次后台创建抢选，第二次报 `QA_SELECTION_FAILED`；返回 A 后草稿恢复。该最小 WebSocket 复现不等于完整 AgentTrigger 实测。

- [ ] **PromptPanel 明确目标**：分别在隐藏预热、已经可见、关闭后重建的 ThreadWindow 中提交唯一标记的首轮输入，确认打开的是本次 Swift 创建的目标、读取到其历史并可继续回复。在同一可见窗口中返回 A，原草稿仍保留；重建窗口按既有页面重建规则清空草稿。
- **PromptPanel 工具边界（2026-09-14）**：原生快捷键已打开主包面板，Host PID 26306 和后端正常；Computer Use 按主包完整路径两次超时，按 bundle ID 报多包歧义，按应用名误启动旧 worktree 包。误启动实例已停止，没有向面板输入或提交。已请求允许按主包 PID 使用原生 AX 操作，未获确认前保留本项；错误包的 status 127 不记为当前产品缺陷。主包设置 hash 未变，证据见 `.cache/live-qa-20260914/selection-fixed-promptpanel-tool.json`。
- [ ] **窗口与桌宠边界**：PromptPanel 打开历史时先隐藏面板且不恢复旧应用焦点；普通历史入口和无目标 focus 只打开或聚焦现有窗口。后台创建 B 后桌宠仍按创建时间选择最新 Thread，A 的后续进度不抢回桌宠；ThreadWindow 的选择独立保持。

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
- [ ] 角色大小与持久化：默认角色为原图集显示尺寸的三分之二；右键打开滑杆，分别设为新默认的 50%、100%、150%，重启后恢复选择，点击恢复默认回到 100%。只显示角色时也能打开大小控件；Escape、关闭按钮、点击外部或窗口失焦可关闭，右键不开始拖动或提交消息。
- [ ] 缩放与对话布局隔离：保存一份回复草稿，缩放前后比较截图及 DOM 几何；只改变角色和实际命中范围，角色右下锚点、右侧对话列位置、气泡宽度/字号、输入框与草稿保持不变，缩小后空出的区域可穿透。大小偏好存储不可用时本次调整仍可用。

- [ ] 屏幕边缘：移动到四边与角落，再悬停/移出对话区，并增加长建议；角色与回复框留在可用工作区。常态和悬停都只利用锚点上方空间，顶部不足时裁剪上方内容，回复框与角色屏幕位置保持；悬停可滚动查看完整内容，多屏切换或工作区变化后仍可找回。
- [ ] 透明命中：桌宠置顶，窗口透明空白及独立气泡间隙可点击下方应用；常态顶部裁剪及悬停滚动后，被裁掉的消息或建议不拦截点击。角色、可见气泡、建议与回复控件仍可接收点击、滚动和跨应用拖放。

- [ ] 链接两区域拖入：从浏览器拖出公共网页链接，分别松手角色与气泡/历史，确认分流正确，并依据实际网页正文给建议，不能仅复述 URL。
- [ ] PDF 两区域拖入：从 Finder 拖入有已知正文的 PDF，分别松手角色与气泡/历史，确认分流正确，建议能引用实际正文，历史保留文件名。
- [ ] 最终松手判定：同一次拖动先经过角色再经过气泡，并反向重复；高亮与“新对话”/“添加到当前对话”提示随目标变化，经过不提交，只按最终松手区域创建或追加。
- [ ] 自动读取与建议：四类输入松手后无需另点开始；建议有实际内容依据，缺少意图、目标位置或偏好时追问。用户决定前不执行建议，即使已有永久 Tool Permission。
- [ ] 建议与普通消息：当前建议与回复框位于角色右侧，常态即可操作可见选项；在等价样本中点击建议、输入同一句话、输入不同自由回复，都形成普通用户历史并继续同一 Thread，后续执行及结果留在桌宠消息中。全部选项自然换行增高，超出上方空间时悬停统一浏览，回复框保持可用。
- [ ] 持续等待：建议或追问放置超过一分钟仍在等待，不自动执行、重试或消失；普通回复能立即继续处理，不被排在等待结束之后。

- [ ] 常态最新消息：短正文按内容收紧，长正文只显示开头最多三行且内部不能滚动；用户新消息和工具调用不替换最新非空 assistant 正文。无历史时可仅显示空回复框，不显示虚构的 assistant 正文。
- [ ] 悬停统一浏览：角色在左下、对话列在右；仅进入对话区展开，移出立即回常态。历史消息、完整最新正文、全部当前建议与 Permission/Workspace 请求共用一个滚动容器，最新正文不重复；消息仍左桌宠、右用户独立呈现，容器透明，回复框固定在容器外。
- [ ] 历史滚动：每次进入悬停均回到底部，切换 Thread 后展示新 Thread 的最新内容；同次展开在底部时跟随流式增量、建议和新消息，手动上翻后不抢回底部。移出再进入应重置到当前底部，正文和建议均无嵌套滚动区。

- [ ] 输入焦点：点击角色唤出后无需再点输入框即可键入；只因聚焦不展开历史，hover 与后台更新不抢其他应用焦点。输入后移出对话区立即回常态，回复框保持位置、焦点和草稿，可继续输入；中文输入法候选确认与 Enter/Shift+Enter 正常。
- [ ] 隐藏与恢复：角色单击切换整套对话显隐，气泡不再有 ×；再次唤出聚焦并继续原草稿。隐藏期间后台进度、结果、错误和新 Thread 不弹回，主动点击或拖入才恢复；角色拖动结束不误触切换。隐藏不提交消息、不回答询问、不取消任务。
- [ ] 附件读取期间隐藏：分别向角色与对话区拖入图片/PDF，在“正在接收…”时单击角色隐藏；读取与提交完成、Thread 创建通知或保存错误均不弹回，输入仍按松手目标新建或追加。再次点击恢复并聚焦，不因隐藏取消已交付的输入。
- [ ] 首次文字：在隔离的无历史环境点击打开空回复框、取消再打开，发送前不创建 Thread；首次发送只创建一个 Thread，接收后历史包含该输入，后续回复继续同一 Thread。创建或提交失败保留可编辑草稿并说明错误，重试已有空 Thread 也等待接收确认；确认不擦掉随后新编辑的文字，发送期间隐藏后确认或错误均不弹回。
- [ ] 最新 Thread 选择：让 A 等待或执行，再创建 B；B 接管桌宠，A 后续进度/结果不抢回气泡；A 的历史仍能从现有 ThreadWindow 历史入口找回。
- [ ] 两界面共享：桌宠与 ThreadWindow 打开同一 Thread，用户输入、assistant 回复、建议及附件内容一致；从任一界面回复后另一界面不继续显示过期建议。从完整窗口删除当前 Thread 后，桌宠在线及重连时均切换到仍存在的最新历史，列表为空时清空展示。
- [ ] Permission/Workspace 唯一回执：两界面呈现同一真实请求，从一端回答后两端都清理；快速竞争回答只应用一个结果。建议按钮仍走普通消息，权限/工作区仍走各自请求控件。
- [ ] 执行中排队：当前执行期间分别从桌宠和 ThreadWindow 追加文字/拖入内容，立即看到“待处理”；当前工作不中断，结束后按接收顺序继续处理，待处理标记随开始消除。
- [ ] 重启后的未处理输入：等待前一任务时提交后续输入，确认已经接收后重启；文本/链接、附件和未开始输入仍在同一 Thread 历史并保留待处理状态，下一次回复可继续处理。
- [ ] 图片/PDF 副本：输入接收后移动或删除可丢弃样本的原文件，再重启并打开历史；图片仍显示，PDF 副本仍能读取，不依赖原路径。
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
  2. 确认 Context History 与 Automation 为默认关闭的内置功能，说明与已归档范围一致；书签连接仍在完善；桌宠拖入与轻量对话已实现，原生交互仍有待验项；桌宠内切换对话、分享 / 标记入口与个人记忆属于后续规划。
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
