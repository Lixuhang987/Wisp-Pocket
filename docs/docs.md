# docs

`docs` 目录只放不属于单个源码目录、但会影响开发判断的说明。模块级架构事实优先放在最近的 `<dir>.md`；跨模块事实入口仍是 [handAgent.md](/Users/mu9/proj/handAgent/handAgent.md)。

## 直接子节点

- [TODO.md](/Users/mu9/proj/handAgent/docs/TODO.md)：尚未实现的产品 / 架构待办；实现并验证后移出。
- [bugs.md](/Users/mu9/proj/handAgent/docs/bugs.md)：当前仍未修复、需要排查的缺陷。
- [manual-qa.md](/Users/mu9/proj/handAgent/docs/manual-qa.md)：已实现但需要人工回归或实机验收的项目。
- [dev.md](/Users/mu9/proj/handAgent/docs/dev.md)：本地启动、排查和验证边界。
- [dependency-audit.md](/Users/mu9/proj/handAgent/docs/dependency-audit.md)：依赖收敛后仍保留的独立迁移项。
- [llm-api-integration.md](/Users/mu9/proj/handAgent/docs/llm-api-integration.md)：真实 LLM API 集成测试说明。
- [visual-refactor-spec.md](/Users/mu9/proj/handAgent/docs/visual-refactor-spec.md)：前端视觉重构 spec。
- [visual-refactor-design.md](/Users/mu9/proj/handAgent/docs/visual-refactor-design.md)：前端视觉重构实施设计资料。
- [agents/agents.md](/Users/mu9/proj/handAgent/docs/agents/agents.md)：工程 skills 的 issue tracker、triage 标签与领域文档消费规则。
- `human/`：面向人工操作和系统能力的补充说明。
- `medium-powers/`：历史 spec / plan 集合；完成后应压缩为当前事实或 QA 条目。
- `superpowers/`：历史视觉 / 输入资料资产。

## 放置规则

- 当前架构事实不要写进 `docs/` 平铺文件；应放在 owning 模块的 `<dir>.md`。
- 已修复但未实机验收的项目放 `manual-qa.md`，不要继续占用 `bugs.md`。
- 历史证据、日志路径和一次性排查记录只在仍会改变下一次验证动作时保留。
