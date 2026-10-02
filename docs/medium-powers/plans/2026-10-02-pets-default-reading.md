# Issue #6 / #7 合并实施计划

依据：[默认读取](https://github.com/Lixuhang987/Wisp-Pocket/issues/6)、[多桌宠](https://github.com/Lixuhang987/Wisp-Pocket/issues/7)。本计划承接用户已确认的用例和测试边界。

## 最新决定与共同合约

- 2026-10-02 用户覆盖 #7：Pet 创建后 `rootPath` 不可修改；后端拒绝更新文件根，编辑界面仅展示。Thread 不保存文件根快照，执行时从不可转移的 `petId` 取得 Pet 固定根。
- 角色提示仍在 Thread 创建时保存版本快照；修改名字和图片即时展示，修改角色仅影响新 Thread。实际文件位置从所属 Pet 派生。
- PetRegistry / SQLite 是配置唯一来源，替换 Workspace；ThreadRegistry / Thread 是执行、历史、请求唯一来源。所有消费者共用 `/api/thread`。
- 普通 `file.read` 与四个历史读取 Tool 默认开放、免 Permission；`user.ask` 按需调用。删除 mode、自动预读与首次执行限制。
- Tool 调用上下文由后端提供 `rootPath` 与中断信号；模型不能传身份参数改变文件范围。读取允许任意路径；相对路径从 Pet 根解析；写入限于 Pet 根并按真实目标路径串行。
- 桌宠仅交付原路径文字，持久接收后确认；PromptPanel 既有图片输入继续使用 Blob / 多模态链路。

## 用例流与先测入口

| 触发与可见结果 | 复用流 / 核心数据与接口 | 首先扩展的测试 |
| --- | --- | --- |
| 创建、编辑多宠；身份稳定，根不可修改 | pet commands → PetRegistry → 同一 SQLite；稳定 id、revision、唯一默认、受管 imageRef | agent-server thread-ownership / pet-conversation：真实存储、重复创建身份、删除墓碑跨重启保留、并发编辑、拒绝根更新 |
| 在指定宠创建并续聊；角色隔离，旧角色恢复 | thread.start(petId) → 后端角色快照 → Thread → Runtime system sections | 真实模型请求捕获；同根多宠隔离、角色编辑前后、重启与分页 |
| 首轮主动读取路径或历史；真实内容进入模型 | 默认 AgentTool → Node 文件 / Swift 已保存历史 → Tool结果 → 三种 LLM adapter | agent-server主路径，真实文本/PDF/图片/历史fixture，权限策略要求询问时读取仍免确认 |
| 写入当前宠固定目录；同目标串行 | Thread.petId → Pet.rootPath → Tool context → 既有原子写入 | 真实目录产物、越界/symlink限制、同根并发与等待中断 |
| 点击、选历史、输入、拖放、收起与恢复 | 固定petId controller → shared inputController → thread协议；草稿按宠/Thread归键 | 既有renderer/controller/IPC测试：持久ACK、固定drop目标、焦点与hover合约 |
| 五宠窗口独立，隐藏后请求召回 | Electron sender→Pet窗口映射；只消费后端事实；可见集合持久 | Electron窗口用例：sender限制、在途接收延迟回收、Permission不抢选择 |
| 启动即采集，失败提示且旧历史可读 | Swift宿主生命周期 → Context History存储；Node只读取，设置展示真实状态 | Swift现有业务用例：权限失败、恢复、退出取消；跨语言真实保存格式fixture |
| Settings管理及后台触发归属 | Swift窄协议client → Pet管理；AgentTrigger.targetPetId → thread.start | 现有Swift client/store/runtime测试：默认宠及明确目标、失效不改投；Settings 冲突表单保留人工验收 |

外部模型、传输和系统能力可替身；不另建业务owner，不把低层调用次数当成功依据。删除旧模式和旧API无需新增证明它们失效的专用测试；有效路径、输入拒绝与边界验证仍需覆盖。

## 分工与顺序

1. 主 agent：worktree、基线、计划、Node历史/文件工具、多模态、整合与最终验证。
2. 后端 agent：Pet类型/Registry、SQLite、Thread角色快照、协议/路由、默认工具与mode移除、主路径测试。
3. 前端 agent：Electron多窗、renderer导航/草稿/原路径输入、必要ThreadWindow协议适配；保留surface。
4. Swift agent：常驻采集、状态、Pet Settings、AgentTrigger和Swift协议；先提供Node读取格式。
5. 各分工先补用例再实现，各自适配所属旧测试并更新目录文档；共享接口先协调，避免重复编辑。
6. 全部实现后运行 TypeScript/Web、Swift test/build、Electron完整build；双轴独立代码审核并修复发现。
7. 分发无上下文的独立文档审核，核对两个issue及本页用户覆盖决定，更新manual QA后提交。

## 验证状态

- 隔离目录：`.worktrees/issues-6-7-pets-reading`，分支 `codex/issues-6-7-pets-reading`。
- 基点：`c40b875a7bfa0d23a51dd0591a13b4b361aca45e`。
- CodeGraph索引已初始化，TypeScript/Web与Swift build基线通过。
- 实机与真实模型尚待验；完成后只记录实际证据，不将自动化替身结果当实机成功。

## 原实现验证记录（2026-10-02）

- 提交 `7e352e7` 完成实现、双轴代码审核与无上下文的独立文档审核；两轴发现已修复，包含删除墓碑、分页 / 失效选择、显隐 / 状态与角色来源。当前事实已同步 owning 文档，M01–M07 及真实模型仍全部待验。
- 当时 TypeScript/Web、Swift test/build、Electron build 与 thread-store 检查通过；日志在 `/tmp/handagent-final-{ts,swift-test,swift-build,electron-build}.log`。这些记录只证明原实现，不替代下述测试维护后的复验。

## 测试维护计划（2026-10-03）

用户要求按更新后的 use-case-driven-development 维护本次测试，且随后确认每 spec 上限改为 4：累计新增按实现前基点 `c40b875` 核算，既有 case 的改名/断言更新不算新增，删除旧 case 不抵扣新增，参数化每项独立计数。本轮只调整测试及其文档，不改产品行为。复用已隔离工作区，`scripts/test.sh` 与 Swift build 维护基线已通过。

| 范围 | 沿用的已有 case / 流程 | 本轮选择及新增预算 |
| --- | --- | --- |
| #6 默认读取 | `default-reading.test.ts` 的 socket → Thread/Runtime → SQLite → 读取材料 → user.ask → 授权保存 | 保留为新增 1：读取前修改原文，校验持久输入仅路径、模型取得当前正文和真实 Swift 历史证据、读取免询问及写入产物 |
| #6 文档资料 | 同一文件中的真实 PDF / 图片读取 | 保留新增 2、3：分别以一份文本 PDF、一张 PNG 从 Runtime 工具调用到模型内容完成读取；删独立 JPEG/WebP、空值和损坏/超限矩阵；FIFO 未保留独立自动化，不把它们打包进大 case |
| #6 模型承载 | `dynamic-tool-images.test.ts` 基点的 Responses/Anthropic 成功参数化 2 项及 Chat 成功 1 项 | 同一模型请求中包含 Dynamic 与普通 Tool 图片，保留原配对、元数据、像素和消息断言；删除额外普通工具参数化 3 项，新增 0 |
| #7 桌宠 renderer | `pet-interaction.test.tsx` 基点的点击/草稿、首轮失败参数化、后台显隐、异步接收目标、普通回复、hover 历史展示用例 | 分别扩展显隐重建、稳定提交身份、Permission 召回、归属/草稿、状态、创建时名称；删重复原路径；五宠逐 Thread/new 草稿在 renderer 重建后隔离恢复单独保留为新增 2，不混并到点击用例 |
| #7 分页选择 | `pet-identity.test.ts` 的本宠分页/重连失效选择 | 保留新增 1：浏览分页仍保留当前输入，断连期间选中项被删，重连后明确 not_found 才清旧草稿并回本宠；普通删除与分页检查并入该连续恢复流程 |
| #7 原生窗口 | `pet-window.test.ts` 基点的非激活显示/交互、离屏恢复、损坏配置与 IPC | 分别扩展真实 collection 的延后回收/召回、显示器相对锚点、两个 sender 隔离；删除额外 multi-pet-window 与位置 case，新增 0 |
| #7 完整历史 | `initial-prompt-flow.test.ts` 基点的 connects/lists/dispatches 用例 | 同一连接列表流程扩展第 51 条自动分页及打开，删另一个分页 case，新增 0 |
| Swift | `testSubmitInitialPromptStartsThreadWithHostDynamicToolsThenSubmitsOp` | 扩展默认宠与图片输入；删重复默认宠 case、独立 Settings 冲突 case 和 fixture 导出 case，新增 0；保留已有采集生命周期/格式回归和静态 Swift 夹具 |

#7 后端 `pet-identity.test.ts` 保留新增 2 项：公开 socket 管理五宠并验证不可改根、编辑版本冲突、角色/图片/SQLite 重建恢复；丢 ACK 后删除、跨重启重试不复活且新命令仍可创建。删除其余 5 项；输入去重扩展 `thread-ownership.test.ts` 已有 `recovers saved history after backend restart without resuming an old turn`，resume 错误分类扩展已有 `reports deletion failure through the protocol`，Permission 观察与答题资格扩展 `pet-conversation.test.ts` 已有 `用户决定后沿在线 Provider 执行真实 CLI；两界面竞争回答权限只执行一次`。不把管理命令错误矩阵拼进角色主路径。#7 前端 2 + 后端 2 = 4；#6 合计 3 项，剩余 1 项不强行使用。本轮保留的独立新 case 均来自前一实现批次，不把本轮当成新的预算。

负向选择：不为删除的 mode、Workspace、自动预读或不支持的输入另写“不能再用”的测试；既有写入范围和 Permission 回归仍保留。删减的精细图片/PDF/历史损坏与系统输入边界仅作人工检查建议，不宣称仍有逐分支自动化覆盖。静态 Swift 夹具继续提供跨语言格式证据，生成夹具不是独立测试成果。

执行顺序：核对基点及累计 case → 更新本计划和 TODO → 按分工维护既有测试/删重复项 → 跑专项与仓库/Swift检查 → 独立审计预算、覆盖和文档 → 更新 manual QA、移出 TODO 并提交。

## 本轮独立审核（2026-10-03）

- 相对 `c40b875` 逐项核算：原实现 `7e352e7` 新增 43 项，最终保留 7 项（#6 为 3，#7 为后端 2 + 前端 2）；参数化逐项计算，包括 macOS 执行的 `skipIf(win32)` FIFO 用例，未用旧用例删除抵扣新增。
- 原 43 项分布：默认读取 13、普通 Tool 图片 3、Swift 夹具导出 1；后端身份 7、renderer 身份 12、renderer 角色来源 1、多窗 2、窗口位置 1、Web 分页 1、Swift 默认宠 / Settings 2。最终新增仅在 `default-reading.test.ts` 与两端 `pet-identity.test.ts`。
- 原有回归映射：普通 Tool 图片扩展既有 SDK 图片流；默认宠 / 图片扩展 Swift 首轮提交；分页扩展连接列表；窗口集合 / sender / 位置扩展原窗口流；输入去重扩展历史重建；观察者权限扩展真实 CLI 授权。删除的 Workspace / mode / 自动预读路径不再有效，其他存续行为继续由原用例回归。
- 审核修正两处：删除失败 / resume 故障改为同一 Thread 的连续恢复与删除流程，避免另起场景拼接；既有写入用例恢复 relativePath / bytesWritten 公开返回值断言。未发现其他无关场景打包或业务 owner 替身；模型 / 传输 / 系统与故障注入仍限边界。
- owning 文档已沿受影响测试目录、host-automation Sources 及父目录读至 `handAgent.md`；静态 Swift 夹具来源、删除 PDF 夹具后的索引与 manual QA 已同步。JPEG/WebP、失败矩阵及 Settings 冲突表单仅保留人工检查边界，未记为实机通过。

- 最终复验通过：`bash ./scripts/test.sh`、Swift test/build、Electron/Web 完整 build，以及 thread-store 5 项。Electron 126 项、Web 90 项通过；主路径和模型适配专项也通过。最新日志：`/tmp/pet-test-maintenance-final.log`、`/tmp/pet-tests-maintained-swift.log`、`/tmp/pet-test-maintenance-swift-build.log`、`/tmp/pet-test-maintenance-store.log`，前端日志为 `/tmp/handagent-test-maintenance-{electron,web,frontend-build,web-build}.log`。
- 独立预算/文档审核结论无遗留，55 个本地文档链接与 diff 检查通过；完成项已从 TODO 移出。生产代码未改，实机状态不变。
