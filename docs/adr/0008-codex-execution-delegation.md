# 将扩展执行职责委托 Codex CLI

2026-10-04 用户确认：移除 `use_tools`，主 Agent 只保留问答、读取与 Codex 委托，自行判断任务复杂度；复杂任务与所有写文件任务交给用户预先安装并登录的 Codex CLI，扩展执行能力全部迁到 Codex。这一选择将执行职责交给 Codex，而不是单纯删除工具懒激活步骤后让主 Agent 继续直接执行全部工具。

用户后续确认：Wisp 现有 MCP、macOS 与 Automation 能力迁移先不做，列为后续 TODO，本期不改动其实现或新增接入接口；Codex 沿用用户既有模型与配置，由主 Agent 自行判断新建或 resume。主 Agent 移除扩展执行入口，不表示现有扩展能力已经迁移完成。

委托调用沿用 Wisp Permission 的本次 / 永久允许或拒绝；子级执行沿用用户 Codex 权限，Wisp 不额外扩大权限，也不将非交互 exec 的内部审批伪装成 Wisp 可接管的请求。工作目录固定取当前 Workspace，目录本身不代表沙箱；受限操作或内部审批阻碍回传给主 Agent。

Codex 会话仅可接续当前 Wisp Thread 委托产生并保存的明确 sessionId；每个 Thread 可拥有多个会话，由主 Agent 选择，不使用 `--last`。关联随历史持久保存，重启后仍可接续。每次输入由主 Agent 整理任务、相关背景、约束、验收要求与文件路径；resume 同样交付本次新增要求，由主 Agent 整合结果。

执行作为普通工具等待 Codex 完成后回传，由主 Agent 整合结果；ThreadWindow 复用现有运行状态和最终结果卡片，桌宠由主 Agent 汇报。关闭界面不取消任务，新增输入继续排队；失败明确回传，重试由主 Agent 判断，本期不新增后台任务查询或 Codex 子步骤实时展示。

用户最后确认：本期暂不处理 Codex 执行的专用取消，后续为 Tool 设计统一终止机制并列入 TODO。首版沿用现有 Turn 中断与晚到结果隔离；Turn 已中断不证明 Codex 子进程已停止，既有文件修改继续保留。会话关联的持久保存仍是已确认要求，终止机制后续单独收敛。

用户调用 to-spec 后，已将收敛方案发布为 [Issue #10](https://github.com/Lixuhang987/Wisp-Pocket/issues/10)，首版已实现，自动化、真实 CLI 烟测与完整宿主验收分别见 [实施记录](../medium-powers/plans/2026-10-04-codex-cli-delegation.md) 和 [manual QA](../manual-qa.md)。Codex 不自动获得 Wisp 的 MCP、macOS 或 Automation 能力。产品边界见 [PRODUCT](../PRODUCT.md)，后续实施流程见 [TODO](../TODO.md)。
