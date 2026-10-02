# Issue #6 / #7 合并实施计划

依据：[默认读取](https://github.com/Lixuhang987/Wisp-Pocket/issues/6)、[多桌宠](https://github.com/Lixuhang987/Wisp-Pocket/issues/7)。本计划承接用户已确认的用例和测试边界。

## 最新决定与共同合约

- 2026-10-03 用户修正桌宠：伙伴 / 对话 / 隐藏入口仅在右键菜单出现；当前对话不展示目录，也不通过 title 提示路径。悬停浏览必须保持角色、回复框和短内容的屏幕位置稳定。
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
| Settings管理及后台触发归属 | Swift窄协议client → Pet管理；AgentTrigger.targetPetId → thread.start | 现有Swift client/store/runtime测试：冲突保留表单、明确目标、失效不改投 |

外部模型、传输和系统能力可替身；不另建业务owner，不把低层调用次数当成功依据。删除旧模式和旧API无需新增证明它们失效的专用测试；有效路径、输入拒绝与边界验证仍需覆盖。

## 分工与顺序

1. 主 agent：worktree、基线、计划、Node历史/文件工具、多模态、整合与最终验证。
2. 后端 agent：Pet类型/Registry、SQLite、Thread角色快照、协议/路由、默认工具与mode移除、主路径测试。
3. 前端 agent：Electron多窗、renderer导航/草稿/原路径输入、必要ThreadWindow协议适配；保留surface。
4. Swift agent：常驻采集、状态、Pet Settings、AgentTrigger和Swift协议；先提供Node读取格式。
5. 各分工先补用例再实现，各自适配所属旧测试并更新目录文档；共享接口先协调，避免重复编辑。
6. 全部实现后运行 TypeScript/Web、Swift test/build、Electron完整build；双轴独立代码审核并修复发现。
7. 分发无上下文的独立文档审核，核对两个issue及本页用户覆盖决定，更新manual QA后提交。

## 验证状态（2026-10-02 实施历史）

- 隔离目录：`.worktrees/issues-6-7-pets-reading`，分支 `codex/issues-6-7-pets-reading`。
- 基点：`c40b875a7bfa0d23a51dd0591a13b4b361aca45e`。
- CodeGraph索引已初始化，TypeScript/Web与Swift build基线通过。
- 实机与真实模型尚待验；完成后只记录实际证据，不将自动化替身结果当实机成功。

## 独立文档审核（2026-10-02）

- 无继承上下文的审核已读取 Issue #6/#7、最新不可改根决定，以及各修改目录的 owning 指南并沿父目录至 handAgent.md；复核了后端、Swift 与前端刚更新的目录文档。
- 当前事实已同步根架构 / 术语路由、产品与 surface、ADR 0003/0004、默认工具与输入合约、Pet / Thread 持久化和原生设置；ADR 0001 保留原决策范围并注明 Workspace 已被替换，ADR 0002 同步两种界面的永久授权入口。
- manual QA 已新增 M01–M07 和真实模型 / 采集权限待验项，并校正旧待验步骤；旧实机归档和历史构建证据未改写为本次通过。TODO 的实现收尾项已在最终检查与审核通过后移除，保留延后的重启队列策略。
- 首轮检查 419 个改动文档本地链接，均可解析；git diff --check 通过。显示器关联 / 相对锚点缺口现已补实现与用例，并同步 windows owning 文档；真实多屏行为仍在 M04 待验。

## 代码审核修复与增量文档复核（2026-10-02 实施历史）

- 双轴代码审核提出的五项问题已修复，Standards 复核关闭：删除 Thread 时事务内保留稳定创建身份墓碑，跨重启 ACK 重试不复活历史；ThreadWindow 自动取完分页；桌宠超过一页时以 resume 的 not_found 清理已删选择；点击显隐按宠持久化；历史列表随运行状态更新。
- 文件读取采用非阻塞打开后验证普通文件，真实 mkfifo 用例证明无写入端的 FIFO 不挂住读取；默认读取专项共 13 项。此改动不扩大支持格式。
- 桌宠同时展示当前身份与 Thread 创建时的宠名 / 角色版本；不可改根和仅保存角色快照的决定保持。
- 独立文档审核已复核上述最新代码及 owning 指南，并把重试删除、完整分页、离线删除、显隐恢复、列表状态与角色来源加入 manual QA。M01–M07 及真实模型仍全部待验，未借自动化结果宣称实机通过。
- 最终整合检查全部通过：`bash ./scripts/test.sh`、`bash ./scripts/swiftw test`、`bash ./scripts/swiftw build`、`pnpm build:electron-shell`，另有 thread-store 5 项测试通过。主 agent 日志分别为 `/tmp/handagent-final-ts.log`、`/tmp/handagent-final-swift-test.log`、`/tmp/handagent-final-swift-build.log`、`/tmp/handagent-final-electron-build.log`；文档审核已回读其成功结果。
- 两轴审核最终无遗留：Standards 的 5 项和 Spec 的 2 项均已关闭，其中删除墓碑问题重叠。独立文档增量审核完成，最新实现、规格、owning 指南及 manual QA 一致，最终按 git diff HEAD 核对 418 个本地链接及 PDF 二进制属性，链接与 diff 检查通过；由主 agent 完成提交。

## 2026-10-03 桌宠回归修复计划

- 本轮在 `.worktrees/pets-hover-context-menu-fix` / `codex/pets-hover-context-menu-fix` 执行，基于多宠实现提交 `7e352e7`。上方最终整合与独立审核属于 2026-10-02 历史，不作为本轮检查证据；最新用户要求覆盖旧常驻入口及对话内文件位置展示。
- 用例：角色周围不设常驻管理入口，逐宠对话显隐恢复与点击语义保持；右键角色打开菜单，伙伴 / 对话 / 隐藏沿用现有动作，大小调节继续可用；菜单支持关闭与键盘操作。右侧对话保持标题、交付文件及原角色提示，不展示文件根。仅 hover 展开历史，角色 / 回复框 / 短内容保持底部位置，移出保留焦点和草稿。
- 沿用数据与接口：逐宠 controller 的选择 / 草稿 / 显隐不变；菜单是 renderer 局部状态，动作复用 PetManager、历史弹层及 handAgentPet.hidePet；布局继续通过 setLayout(mode, contentHeight) 和 setInteractiveRegions 发送给原生控制器，不增加协议。
- 先测入口：扩展 pet-interaction 既有大小、hover / 回复节点和 drop 后切历史用例，覆盖右键到动作的完整流；复用 pet-window 的锚点用例。用独立 Electron 渲染 harness 加载当前 worktree 的真实 renderer / CSS / preload / controller，测量 hover 前后标题与回复框屏幕坐标，先复现再验证。此回归任务新增自动测试预算最多 1 项，优先零新增并扩展现有用例；此前 #6/#7 测试保持。
- 检查点：鼠标进入对话 → React expanded → DOM 尺寸 / 内容测量 → preload IPC → 原生 bounds / 命中 → 鼠标仍在同一内容；每一步用真实渲染坐标或既有 IPC 主路径断言验证。
- 先确认跳跃发生在 renderer 布局还是原生定位，再作最小改动；同步目录指南、surface 与规格，独立文档审核后更新 manual QA，执行提交前检查并提交。
- 回归检查已通过：既有 renderer 共 23 项，无新增测试项，扩展其中三个用例；`bash ./scripts/test.sh`、`bash ./scripts/swiftw test`、`bash ./scripts/swiftw build` 与 Electron build 均成功。结果位于本轮 worktree `.cache/pets-fix-final-web.log`、`pets-fix-final-swift-test.log`、`pets-fix-final-swift-build.log`、`pets-fix-electron-build.log`，独立文档审核已回读成功结果。
- 真实 Electron 受控空对话复现：修复前标题上跳 469.55px，标题移入消息的底部对齐滚动内容、紧凑测量包含标题后，连续五次移入 / 移出的标题 / 角色 / 回复框屏幕坐标变化均为 0，路径 title 为 null；菜单截图核对四个入口在角色上方。证据为本轮 worktree `.cache/pet-hover-result.json`、`pet-hover.png`、`pet-context-menu.png`。后端、屏幕与光标为受控 fixture，只证明此布局链路；完整宿主、长历史、中文输入法与多屏仍在 manual QA 待验。
- 无继承上下文的独立文档审核已完成：读取全部多宠规格、修改目录的 owning 指南及父级至 `handAgent.md`，核对最新用户决定、源码与受控渲染证据；修正右键入口、目录查看范围及对话显隐恢复的表述，明确历史检查与本轮证据。manual QA 已更新，全部实机待验项保留；改动文档的本地链接、锚点与 `git diff --check` 通过。TODO 的本轮工作流已迁移到 manual QA 与本节记录。
