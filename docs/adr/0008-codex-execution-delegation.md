# 将扩展执行职责委托 Codex CLI

2026-10-04 用户确认：移除 `use_tools`，主 Agent 只保留问答、读取与 Codex 委托，自行判断任务复杂度；复杂任务与所有写文件任务交给用户预先安装并登录的 Codex CLI，扩展执行能力全部迁到 Codex。这一选择将执行职责交给 Codex，而不是单纯删除工具懒激活步骤后让主 Agent 继续直接执行全部工具。

用户后续确认：Wisp 现有 MCP、macOS 与 Automation 能力迁移先不做，列为后续 TODO，本期不改动其实现或新增接入接口；Codex 沿用用户既有模型与配置，由主 Agent 自行判断新建或 resume。主 Agent 移除扩展执行入口，不表示现有扩展能力已经迁移完成。

决定尚未实施。Codex 不自动获得 Wisp 的 MCP、macOS 或 Automation 能力；会话接续的关联范围、上下文、授权、取消与结果回传仍需逐轮确认，不将推荐方案当成已接受契约。产品边界见 [PRODUCT](../PRODUCT.md)，访谈与后续实施流程见 [TODO](../TODO.md)。
