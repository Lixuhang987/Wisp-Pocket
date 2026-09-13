# 多桌宠架构事实审计（2026-09-14）

受检 worktree：`/Users/mu9/proj/handAgent/.worktrees/pet-dialogue-design-20260914`，生产代码基线 `ca1c02b`。本报告仅静态阅读代码，未修改生产代码；本轮基线由主 agent 执行。本报告的提议不是当前实现，文末记录的文档漂移已在本轮文档审核中修正。
已沿 `AGENTS.md → handAgent.md → apps/packages/docs` 读取所涉目录文档；架构事实以下列生产代码为证据。用户所称 session 在现有代码中应继续映射为 `Thread`，无需第二套历史存储。

## 已实现事实与直接缺口

| 范围 | 代码事实与证据（相对仓库路径:行号） | 多桌宠设计的含义 |
| --- | --- | --- |
| 创建 Thread | `thread.start.payload` 仅有 `workspaceId`、可选 `dynamicTools`：`packages/core/src/protocol/types/ThreadCommand.ts:4`；Router 只传这两项：`apps/agent-server/src/thread/ThreadCommandRouter.ts:71`。 | 当前没有桌宠身份或人设绑定；不能靠多个窗口实现隔离。 |
| 查询/恢复 | `thread.list` 无筛选、分页参数：`packages/core/src/protocol/types/ThreadCommand.ts:21`；`thread.resume` 订阅并返回 snapshot：`apps/agent-server/src/thread/ThreadCommandRouter.ts:87`。 | 可复用生命周期；需补每宠筛选、历史目录与稳定恢复。 |
| 公共协议 | `ThreadListEntry` 只有 ID、预览、时间、消息数、workspaceId；snapshot 只有消息、状态、待答请求：`packages/core/src/protocol/types/ThreadProtocolShared.ts:23`、`:39`。 | list/started/snapshot 都需暴露一致的归属信息，否则冷启动或重连无法证实“这是谁的会话”。 |
| 运行 owner | `ThreadRegistry` 的 Map 唯一管理加载、创建、删除：`packages/core/src/thread/ThreadRegistry.ts:5`；`Thread` 持有历史、输入、Turn、requests：`packages/core/src/thread/Thread.ts:12`。 | 保留这一唯一 owner；不为桌宠另建运行队列。 |
| 持久 metadata | `ThreadMetadata` 不含 pet/persona/revision：`packages/core/src/thread/types/ThreadHistory.ts:5`；SQLite `threads` 同样没有这些列：`packages/thread-store/src/ThreadStore.ts:324`。 | 身份、创建时人设快照需完整贯穿 DTO、存储、恢复，不能只存在 renderer。 |
| 历史查询规模 | SQLite 全量 `SELECT * FROM threads ORDER BY updated_at DESC`：`packages/thread-store/src/ThreadStore.ts:267`。 | 三宠各自历史应后端按归属查询；长期使用需 cursor，而非三份全量历史遍历。 |
| 输入保证 | `opId` 作为已存 user ID 去重；先落盘后排队：`packages/core/src/thread/Thread.ts:51`、`:130`；执行中收到的新输入单独进入队列：`:174`。 | 可复用持久接收语义；“已发送”应等 `user.message.recorded`，不能等价于 socket.send。 |
| 冷恢复 | load 修复残缺 Turn 后创建 Thread：`packages/core/src/thread/ThreadRegistry.ts:24`；构造器恢复 `pendingInputs`，仅 submit 触发 startQueued：`packages/core/src/thread/Thread.ts:25`、`:51`。 | 重启不自动重跑已开始操作；待处理输入与失败任务必须可见。 |
| 广播/选择 | `thread.started` 自动订阅全部连接：`apps/agent-server/src/thread/ThreadNotificationPublisher.ts:50`；桌宠取最新创建项：`apps/electron-shell/src/activity-window/petThreadController.ts:95`；ThreadWindow 无条件切选新 Thread：`apps/thread-window-web/src/App.tsx:54`。 | 后台触发、其他宠新建会话会抢选；“本宠归属 + 明确用户导航”必须替代全局 latest。 |
| 桌宠历史 | `PetSnapshot` 仅一个 threadId；controller 没有公开选择历史操作：`apps/electron-shell/src/activity-window/petThreadController.ts:9`、`:52`；PetConversation 只渲染传入 Thread：`apps/electron-shell/src/activity-window/PetConversation.tsx:24`。 | 现有“历史”是当前 Thread 内旧消息，不是每宠历史 Thread 浏览器。 |
| 首次纯文字 | `respond()` 无 currentThread 就返回：`apps/electron-shell/src/activity-window/petThreadController.ts:73`；回复框仅 `thread &&` 时存在：`apps/electron-shell/src/activity-window/App.tsx:175`。 | 必须补空态聊天入口与首次创建，不能只改善现有回复框。 |
| 草稿 | `App` 持有单个 draft，threadId 改变就清空：`apps/electron-shell/src/activity-window/App.tsx:37`、`:74`。 | 需要 `{petId, threadId|new}` 草稿键；切宠、切 Thread、收起和布局切换都不应丢草稿。 |
| 拖入目标 | 放到角色新建、放到对话追加，均 `mode: inspect`：`apps/electron-shell/src/activity-window/petThreadController.ts:60`；异步读文件前捕获 threadId：`apps/electron-shell/src/activity-window/App.tsx:122`。 | 保留先捕获目的地的模式；多宠目标必须同时冻结 petId、threadId、new/append，不能读完再取“当前宠”。 |
| 读取与执行 | inspect 只暴露 `user.ask`，其余工具在运行时拒绝；后续消息进入 reply：`packages/core/src/runtime/AgentRuntime.ts:141`、`:342`；`packages/core/src/thread/Thread.ts:199`。 | “拖给某宠”授权阅读，不自动授权执行建议；任何人设/永久权限都不得绕过这一阶段。 |
| Append Prompt | `skill.prompt` 拼进 user 内容：`apps/agent-server/src/protocol/MessageTranslator.ts:238`；持久化角色明确为 user：`apps/agent-server/src/thread/ThreadPersistence.ts:91`。 | Append Prompt 是本次输入模板，不是持续人设；不应把每宠人设伪装成每轮用户消息。 |
| 人设注入 seam | Runtime 支持 `systemPromptSections`，默认只有 tool-use-policy：`packages/core/src/runtime/SystemPrompt.ts:43`；生产 createRuntime 未传人设：`apps/agent-server/src/server/server.ts:572`；Thread 构造只读 dynamicTools：`packages/core/src/thread/Thread.ts:25`。 | 可复用 system section 机制，但创建/恢复 Runtime 的 Interface 必须拿到不可变人设快照；只改配置 UI 不会影响模型。 |
| 模型/工具 | 默认 LLM 与 Permission 为共享实例，ThreadTools 各 Thread 独立组合：`apps/agent-server/src/server/server.ts:532`、`:537`、`:563`。 | 多宠可不同提示而复用同一模型设置；若声称“宠 A 只读、宠 B 可写”，还需真正 capability policy，提示词不足以限制工具。 |
| Workspace 实体 | Workspace 是命名文件根；Summary 不含 rootPath：`packages/core/src/workspace/types/Workspace.ts:1`、`:10`。 | 保留“文件访问边界”定义；宠和 Thread 是两条正交关系，不把 Workspace 改成宠容器。 |
| Workspace 当前关联 | Thread.workspaceId 被保存/列出，但 Thread 构造未使用它控制 tools：`packages/core/src/thread/Thread.ts:25`；file.read/write 每次按调用参数从全局 registry 取根：`packages/core/src/tools/builtins/FileReadTool.ts:27`、`FileWriteTool.ts:38`。 | **当前 Thread.workspaceId 是元数据/分组线索，不是 Thread 级访问隔离。** 新设计必须说明默认目录与强限制的区别。 |
| 文件边界 | 路径校验使用相对路径、realpath、根内检测：`packages/core/src/tools/builtins/workspace-path.ts:17`；workspace.list 使用 summarize：`packages/core/src/tools/builtins/WorkspaceListTool.ts:19`。 | 选择宠或历史不能扩大文件授权；UI 可显示路径，模型继续使用 workspaceId/相对路径。 |
| 待答请求 | requests 由 core 持有；60 秒超时，首次有效回执清表并 resolved；候选外 workspaceId 不接受：`packages/core/src/thread/ThreadRequests.ts:18`、`:48`、`:75`。 | 多宠提醒需要 threadId 归属与可达入口；新连接通过 resume/snapshot 恢复，不能把一个请求复制成多项权限。 |
| 双端回执 | Router 先查连接与订阅资格：`apps/agent-server/src/thread/ThreadCommandRouter.ts:56`；桌宠可发 Workspace/Permission ClientResponse：`apps/electron-shell/src/activity-window/petThreadController.ts:81`。 | 无须再造桌宠审批协议；请求归属标识和 UI 完整性才是增量。 |
| 权限记忆现状 | scope 只有 once/always：`packages/core/src/permission/types/Permission.ts:18`；按完整 toolName 全局命中、always 写 version 2：`packages/core/src/adapters/filesystem/FilePermissionPolicy.ts:32`、`:43`、`:89`。 | 永久授权不是“只给这只宠”；UI 必须明确其全局含义，不能默默把人物区别解释成权限隔离。 |
| 桌宠审批缺口 | 桌宠仅有允许一次/拒绝：`apps/electron-shell/src/activity-window/PetConversation.tsx:37`；完整窗口已有 always：`apps/thread-window-web/src/components/RequestPanels.tsx:48`；设置按 toolName 撤销：`apps/desktop/Sources/Settings/PermissionRulesViewModel.swift:29`。 | “99%”覆盖应计入永久授权、撤销入口与解释，而非只覆盖即时回复。 |
| 其他宠内能力缺口 | controller 公开接口无 Stop/删除/历史选择：`apps/electron-shell/src/activity-window/petThreadController.ts:52`；tool_call 在宠历史中直接隐藏：`apps/electron-shell/src/activity-window/PetConversation.tsx:25`；宠 preload 无 availableSkills：`apps/electron-shell/src/preload/activityWindowPreload.cts:38`。 | 需要宠上 Stop、任务状态/详情、历史管理与 Append Prompt 可达入口；可用折叠面板承接。 |
| Swift 手动入口 | PromptPanel 提交后必定 focus ThreadWindow：`apps/desktop/Sources/Coordinator/AppCoordinator.swift:223`；Swift start workspaceId 固定 null 且无 petId：`apps/desktop/Sources/AppServices/AgentServer/SwiftThreadClient.swift:63`。 | 快捷键/截取/选区必须携带明确目标宠并回到其对话；保留 hide(restoringFocus:false) 的焦点顺序。 |
| AgentTrigger | Event 只被渲染成 text：`apps/desktop/Sources/AppServices/AgentTrigger/AgentTriggerRuntime.swift:67`；AppServices 后台创建 Thread 并吞失败：`apps/desktop/Sources/AppServices/AppServices.swift:139`；持久 originator 恒 user：`apps/agent-server/src/thread/ThreadPersistence.ts:40`。 | 现状没有目标宠或结构化来源；需 trigger→pet 路由和失败可见性，不能让它切走用户正在聊的宠。 |
| 启动门槛 | `isAvailable = server health && ThreadWindow prepared && 无错误`：`apps/desktop/Sources/AppServices/ElectronShell/ElectronBackedAppServer.swift:28`；桌宠 show 也等该 availability：`apps/desktop/Sources/Coordinator/AppCoordinator.swift:169`。 | 只隐藏 ThreadWindow 不算弱化；需拆 server readiness、pet readiness、可选详情窗 readiness。 |
| 故障耦合 | ThreadWindow crash 会断 Swift thread/provider 并报 fatal；宠 crash 被忽略：`apps/desktop/Sources/AppServices/ElectronShell/ElectronBackedAppServer.swift:161`。 | 桌宠主入口化需要独立恢复桌宠 UI；详情窗崩溃不得下线仍健康的 backend/provider。 |
| 单宠宿主 | main 只创建一个 ActivityWindowController：`apps/electron-shell/src/main/main.ts:75`；controller 只有一组 window/bounds/position：`apps/electron-shell/src/main/windows/activityWindowController.ts:44`。 | 同屏多宠需按实例建窗口集合；单槽切换是同一 Catalog 的另一种布局，不是复制独立应用。 |
| 原生位置/IPC | 位置文件只存一个 right/bottom：`apps/electron-shell/src/main/windows/petPositionStore.ts:5`；IPC 只接受唯一 currentWebContents：`apps/electron-shell/src/main/petWindowIpc.ts:11`。 | 扩展为按 pet/window 映射；必须以 sender 绑定实例，不能接受 renderer 随意操作任意 petId。 |
| 重连 | 通用 socket 不重连：`apps/thread-window-web/src/thread/threadSocketClient.ts:111`；宠每秒重连、list 后 resume latest：`apps/electron-shell/src/activity-window/petThreadController.ts:31`、`:102`。 | 多宠重连应恢复每宠明确选择，处理离线删除；不能把列表排序当用户导航。 |

## 建议的唯一状态 owner 与 Interface

以下名字是设计建议；不要写成仓库已具备模块。目标是把复杂度集中在少量真实 seam，复用现有 Thread 实现。

| 状态/行为 | 唯一 owner | 推荐 Interface 与不变量 |
| --- | --- | --- |
| 桌宠定义、工作提示、人设版本、默认 Workspace、启用状态 | 新的后端 `PetCatalog`，由 agent-server 组合持久化 Adapter | `list/get/create/update/archive`；设置 UI 与宠上编辑都走同一 Interface；不以 renderer localStorage 保存业务配置。 |
| 创建时执行人设 | core Thread 的不可变 `AgentProfileSnapshot` | 创建时由 Catalog 解析 `petId + revision` 并存快照；resume、interrupt 后重建 Runtime 都读该快照；编辑宠默认只影响新 Thread。 |
| Thread 与宠的归属、历史、队列、待答请求 | 现有 core ThreadRegistry/Thread | `thread.start({petId, workspaceId})`、`thread.list({petId, workspaceId?, cursor?})`；`op.submit(threadId)` 的归属从 Thread 解析，不每轮信任任意 petId。 |
| 持久 rollout 与查询索引 | 现有 thread-store，通过 ThreadStorage Adapter | 新 petId/revision/snapshot 字段 round-trip；宠归档不级联删除历史；不存在的配置也必须能显示历史中的名字/人设来源。 |
| 当前会话、草稿、历史筛选、收起状态 | 每宠唯一的 renderer `PetConversationController` | 按 `{petId, threadId|new}` 保存草稿与选择；切布局仅迁移/恢复 UI；同一宠同时只有一个主动编辑面，详情窗独立浏览不篡改其选择。 |
| 同屏/单槽、屏幕位置、层级、窗口绑定、当前快捷键目标宠 | Electron main 的桌面窗口集合 | `showPet/openThread/setDisplayMode`；只存 UI 导航与窗口状态，不保存消息副本；布局切换不新建 Thread、不改变执行。 |
| Workspace 注册及文件根 | 现有 WorkspaceRegistry | 宠仅存 defaultWorkspaceId；若未来强限制，必须另有后端 capability Interface 做校验，禁止将默认值包装成强沙箱。 |
| 工具永久权限 | 现有共享 PermissionPolicy | 保留 once/always 的真实全局范围；宠权限卡显示所属宠/Thread 和全局记忆后果；能力限制与权限记忆分别建模。 |
| PromptPanel/主动选区/截图/全局热键 | Swift Coordinator 产生带目标的输入意图 | 目标宠在打开输入时冻结；提交后 `pet.open_thread`；创建确认与持久接收确认区分，详情窗失败不应回滚成功输入。 |
| 自动触发来源和目标 | Swift AgentTrigger Instance | 存 `targetPetId` 与明确新建/续接策略；后台结果只给所属宠加待决定/未读标记，不抢焦点；取消/失败有可恢复记录。 |
| ServerRequest | 现有 ThreadRequests | 继续 requestId 一次仲裁、snapshot 恢复；前端只投影。单槽中非当前宠等待审批时必须能定位过去。 |

## 最小跨层改动清单（供后续实施计划使用）

| 改动 | 必须覆盖的路径 |
| --- | --- |
| petId/profile revision 首尾贯通 | core protocol/types → server 输入校验/Router → ThreadServices/Thread → ThreadPersistence → thread-store schema/rollout → list/started/snapshot → Web guards/store → Swift codec。 |
| 人设可复现 | `ThreadServices.createRuntime` 现在仅接 id/tools，需要传创建快照；`SystemPromptSection` 每轮临时注入，历史不要伪造 user 语句。 |
| 宠历史与纯文字 | 替换全局 latest 选择；新增空态发送、历史选择、删除/重命名、执行状态、停止、待答、草稿保留；后端存在的能力优先复用。 |
| 两种显示模式 | 先确定 petId 与窗口实例分离；多窗口 IPC sender→实例校验、每宠位置及屏幕归位、单槽未读提醒与快捷键目标同步。 |
| PromptPanel/Trigger 回流 | Swift 输入带 petId；窗口 command 带目标；server health 与详情窗预热解耦；保留必要的焦点顺序测试。 |
| 99% 的可审计定义 | 用例覆盖是前置门槛，不等于真实任务成功率；真实目标须固定分母并统计在桌宠完成/无需 ThreadWindow 完成的比例。能力检查包括首次纯文字、拖入新建/追加、跟进、审批、选 Workspace、暂停、中断、历史找回、结果访问、模板、设置和故障恢复；不是“99% 的代码在宠组件”。 |

## 基线文档漂移与本轮修正依据

下表描述 `ca1c02b` 的旧文档；对应修正已纳入本轮工作树。保留此表仅用于解释为何研究任务同时更正现状文档，当前规则应阅读各 owning 文档。

| 文档 | 基线漂移 | 本轮更正与证据 |
| --- | --- | --- |
| `docs/adr/0002-tool-permission-memory.md:3` | “尚未实现”过时。 | 已标明协议、Runtime、权限策略与 Settings 已实现 once/always；同时说明 ThreadWindow 有永久决定入口，Pet UI 尚无 always 按钮。不能把 controller 支持等同于可点选。证据：Permission.ts:18、FilePermissionPolicy.ts:32/43/89、ThreadRequests.ts:52、RequestPanels.tsx:48、PermissionRulesViewModel.swift:29。 |
| `packages/core/src/workspace/workspace.md:3` | 只能在 ThreadWindow 选择已过时。 | 已说明通过订阅该 Thread 且声明接收交互请求的桌宠或 ThreadWindow 选择，并将文件注册表实现路由到 adapters。证据：ThreadNotificationPublisher.ts:41/58、PetConversation.tsx:45、petThreadController.ts:86。 |
| `packages/core/src/workspace/workspace.md:16` | “只发 ThreadWindow”“没有活动窗口就 cancelled”均不符合当前 owner。 | 已改为候选发给有资格的订阅连接；取消、超时或 Thread 中断/关闭会取消。没有 UI 回答时等待请求超时，不由窗口是否可见决定。证据：ThreadRequests.ts:40/64/75；canAsk 只查 active Turn/abort/closed：Thread.ts:32。 |
| `apps/desktop/Sources/Settings/settings.md` 权限测试描述 | 仍称测试覆盖“参数摘要”，当前规则已不按参数建模。 | 已改为工具名称、允许/拒绝、永久规则读取与撤销，避免设计继续以旧 argHash 推导每宠规则。证据：PermissionRulesViewModel.swift:5/29/57。 |

## 后续必须验证的架构用例

1. 三宠同时运行；A 的新消息/新 Thread/审批不会切走 B 的当前会话或清空 B 草稿。
2. 单槽切宠期间拖入大文件，上传完成仍进入放手瞬间指定的宠与 Thread；用户能看到目的地。
3. 每宠纯文字冷启动可创建 Thread；持久确认失败时保留原输入；重连不重复执行已接收输入。
4. 修改人设后恢复旧 Thread，仍用它的已保存人设快照；用户明确创建新会话后采用新 revision。
5. 同一请求在详情窗和宠各答一次，仅第一有效回执执行；后台宠待答能通过单槽通知进入。
6. ThreadWindow 未加载、关闭、崩溃时，宠仍可启动、提交、恢复历史和审批；桌宠 renderer 崩溃可单独恢复。
7. 归档宠保留历史；删除 Thread 不删除其他宠的 Thread；Workspace 注销不伪装成删除真实文件。
8. “永久允许某工具”跨宠仍生效且清晰可见；如果产品提供每宠限制，验证后端能力检查而非提示词声明。
9. 原生多屏、透明穿透、焦点、跨应用拖入、快捷键与布局切换需 macOS 实机证据；静态 HTML 原型只能证明交互意图。
