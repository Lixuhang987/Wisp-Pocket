# Issue #10：Codex CLI 委托执行实施计划

规格：[Issue #10](https://github.com/Lixuhang987/Wisp-Pocket/issues/10)；决定：[ADR 0008](../../adr/0008-codex-execution-delegation.md)。本计划只落实已确认首版，不实现扩展能力迁移或统一工具终止机制。

## 用例与接口

- 用户要求写文件或处理复杂任务 → 主 Agent 整理 `prompt` → `codex.execute` 经过现有 Permission → agent-server 启动非交互 CLI → JSONL 会话身份独立保存 → 最终结果进入真实 Tool/Thread 历史 → 主 Agent 汇报。
- 后续输入由 Agent 选择省略 `sessionId` 新建或明确接续。工具仅接受 `prompt` 与可选 `sessionId`，strict 校验拒绝额外身份/目录/命令参数；执行根来自当前 Thread 的 Workspace。
- `ThreadTools` 改为每轮解析已允许的工具集合，不保留激活状态。Thread 的工具工厂接收 Thread 身份，以便从持久层生成当前会话 ID 与任务摘要的工具描述；同轮新会话 ID 从工具结果取得。
- agent-server 的 Codex 适配负责命令参数、stdin、JSONL、退出与有界最终输出；不把 AbortSignal 转成进程终止，也不自行重试。CLI 沿用用户配置，普通 exec 与明确 ID 的 resume 均从后端工作目录启动。
- ThreadStore 增加 Codex 会话关联表与按 Thread 查询/登记 API；关联有 Thread 外键和会话唯一归属，删除 Thread 级联删除。收到 `thread.started` 时独立登记，不依赖整轮工具结果提交；删除后的晚到登记不能复活 Thread。
- 设置复用内置工具页，移除 file.write 开关，展示 Codex 的安装、登录/启动状态与重新检查入口。后端通过已有设置 HTTP 边界提供状态，不启动实际任务、安装或登录；模型、MCP 与原生设置的草稿语义保留。
- 主 Agent 默认目录为文件/历史读取、Web 检索/正文、Codex 委托及 Runtime 的 user.ask；项目规则与系统提示加入委托职责说明。MCP/Swift Provider 原有实现、配置、通道保留，但不暴露为主 Agent 执行入口。

## 测试入口与预算

主入口是现有 agent-server Thread 用例层：真实 Runtime、Permission、SQLite 和进程适配，模型和 CLI 外部依赖使用可控替身。可控 CLI 是实际启动的 Node 夹具，读取 stdin、输出 JSONL 并写临时文件；不 mock Thread 或持久 owner。

累计新增测试：上限 **3**，当前 **3**。

1. 新增委托主路径：首次写真实文件、保存会话身份、关闭重建，再 resume 同一会话修改文件；验证实际结果、工作目录、上下文与会话描述。
2. 新增授权/归属主路径：公开 Permission 回执控制进程启动，覆盖本次与永久决定、唯一有效回执和本 Thread 会话选择。
3. 新增失败恢复主路径：CLI 启动/执行错误进入模型与最终结果，补充输入后沿同一 Thread 成功执行；同一恢复场景不拆参数化用例。

先更新或复用以下既有用例，保留其有意义的覆盖：

- `apps/agent-server/tests/use-cases/default-reading.test.ts` 的默认读取/按需追问主路径，写入步骤改成 Codex 委托，移除激活步骤。
- `apps/agent-server/tests/use-cases/pet-conversation.test.ts` 的真实 CLI 与两界面竞争权限用例，改用普通 Codex 工具；保留消息投影、SQLite 恢复与唯一回执。
- `apps/agent-server/tests/use-cases/thread-ownership.test.ts` 的断连、排队、恢复与晚到结果隔离；外部 Tool 中断用例更新为本期受支持的普通工具，不断言进程停止。
- `apps/agent-server/tests/use-cases/settings-api.test.ts` 及已有 renderer 设置用例，覆盖状态查询、权限撤销和其他配置保存；只删除已经失效的内置写入开关断言。
- 懒激活专属测试随删除机制删除；通用注册、Permission、Dynamic adapter、读取及 Web 边界保留。跳过以“旧工具调用失败”为目标的负向测试，不新增进程终止测试。

## 执行 TODO

- [x] 从主 checkout 使用仓库脚本创建 `.worktrees/codex-cli-delegation/`；CodeGraph projectPath 为该目录绝对路径，所有 MCP 查询显式传入。
- [x] 在 worktree 完成 `scripts/test.sh` 与 `scripts/swiftw build` 分层基线，沿 owning 文档链读取上下文。
- [x] 核对真实工具注册、Thread/SQLite 和设置入口，确定流程、接口与测试预算。
- [x] 先写委托主路径并确认失败，再实现 CLI 与会话持久化、工具集合与系统策略。
- [x] 更新既有工具/设置/授权用例，完成首版状态 UI 与必要验证。
- [x] 同步 owning 文档、ADR/产品对齐与 manual QA，保留两个后续 TODO。
- [x] 运行 TypeScript/Web、Swift test/build 三项提交前检查；真实 CLI 烟测与界面验收分开记录。
- [x] 以 worktree 起点 `417dd275ad5253b2a5a9e5c8994a0d41d8d6c975` 审查本次变更，分别执行 Standards 与 Spec 独立审查并修复问题。
- [x] 分发无继承上下文的独立文档审核子 agent，确认结论与 manual QA 更新。
- [ ] 提交当前分支并记录 commit。

## 验证与完成状态

首版代码与独立文档审核已完成，累计新增 3 条，其余复用。基线两项通过；全部修正后的最终 `scripts/test.sh`、`swiftw test`、`swiftw build` 和新增适配严格 TypeScript 检查均 success。全量脚本曾出现未修改的 Thread 选择用例与 worker RPC 超时，串行复跑后消失，最终全量已通过。Standards/Spec 审核各发现 2 项，修复后独立复核全部解决，无阻断残余。真实 Codex 0.160.0 new/resume 烟测通过：同一 ID、smoke.txt alpha→bravo、success=true/退出0，配置警告保留 diagnostics，证据为 `.cache/codex-qa/real-cli-smoke.log`。完整宿主 UI、真实主模型决策与安装/登录异常实机验收仍在 manual QA；自动化替身和适配烟测不替代这些结论。

## 真实 CLI 结果契约校正

真实 0.160.0 烟测中，成功写文件且 `turn.completed` / 退出 0 的执行也会将配置警告发布为 JSONL `error`。因此裸 `error` 保留为有界诊断，不能单独替代任务终态。执行使用固定、随模块交付的 `--output-schema`，要求 Codex 最终报告任务 success、正文与失败说明；结合会话、Turn、最终任务报告及退出码判断结果；已恢复的中间命令失败只保留诊断，不否定最终任务成功，超大单行丢弃时明确失败并标记截断。此参数只约束最终回复格式，不覆盖模型、账户或权限。自动化仍累计新增 3 个，在既有新主路径内补充警告/已恢复中间失败、首次结果前会话登记、长输出/长错误和超大 JSONL 的结果验证。

## 独立文档审核结论

无继承上下文子 agent 已读取 Issue #10 完整正文（无评论）、本计划、修改目录指南及父链到 handAgent.md，核对生产目录、CLI/结果 schema、Permission、SQLite 会话归属、设置和测试。当前 owning 文档与代码一致；README、产品对齐、ADR、目录索引、开发/mock 说明及历史激活/写入条款已同步，PRODUCT 不写实施进度。TODO 只保留扩展迁移和统一终止两个后续项；manual QA 已新增首版功能待验清单与真实 CLI 烟测范围，未宣称完整宿主/真实主模型通过。55 份本次修改 Markdown 的 348 个本地链接均存在，git diff --check 通过；仅修改文档，提交由主 agent 执行。
