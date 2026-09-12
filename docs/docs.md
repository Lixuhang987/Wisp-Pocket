# docs

`docs` 目录只放不属于单个源码目录、但会影响开发判断的说明。模块级架构事实优先放在最近的 `<dir>.md`；跨模块事实入口仍是 [handAgent.md](/Users/mu9/proj/handAgent/handAgent.md)。

## 直接子节点

- [issue-2-plan.md](./issue-2-plan.md)：后端所有权重构的已完成实施记录。
- [issue-3-design.md](./issue-3-design.md)：状态所有权规格入口、后端保留理由与最终验证状态。
- [backend-state-ownership.md](./backend-state-ownership.md)：后端状态唯一所有权 DAG。

- [TODO.md](/Users/mu9/proj/handAgent/docs/TODO.md)：尚未实现的产品 / 架构待办；实现并验证后移出。
- [bugs.md](/Users/mu9/proj/handAgent/docs/bugs.md)：当前仍未修复、需要排查的缺陷。
- [manual-qa.md](/Users/mu9/proj/handAgent/docs/manual-qa.md)：已实现但需要人工回归或实机验收的项目。
- [dev.md](/Users/mu9/proj/handAgent/docs/dev.md)：本地启动、排查和验证边界。
- [dependency-audit.md](/Users/mu9/proj/handAgent/docs/dependency-audit.md)：依赖收敛后仍保留的独立迁移项。
- [llm-api-integration.md](/Users/mu9/proj/handAgent/docs/llm-api-integration.md)：真实 LLM API 集成测试说明。
- [agents/agents.md](/Users/mu9/proj/handAgent/docs/agents/agents.md)：工程 skills 的 issue tracker、triage 标签与领域文档消费规则。
- [adr/adr.md](/Users/mu9/proj/handAgent/docs/adr/adr.md)：跨模块架构决策、实现状态与排除范围。
- [human/human.md](/Users/mu9/proj/handAgent/docs/human/human.md)：面向人工操作和系统能力的补充说明。
- [medium-powers/medium-powers.md](/Users/mu9/proj/handAgent/docs/medium-powers/medium-powers.md)：历史 spec / plan 集合。
- [superpowers/superpowers.md](/Users/mu9/proj/handAgent/docs/superpowers/superpowers.md)：历史视觉 / 输入资料资产。

## 放置规则

- 当前架构事实不要写进 `docs/` 平铺文件；应放在 owning 模块的 `<dir>.md`。
- 已修复但未实机验收的项目放 `manual-qa.md`，不要继续占用 `bugs.md`。
- 历史证据、日志路径和一次性排查记录只在仍会改变下一次验证动作时保留。
