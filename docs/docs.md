# docs

`docs` 目录只放不属于单个源码目录、但会影响开发判断的说明。模块级架构事实优先放在最近的 `<dir>.md`；跨模块事实入口仍是 [handAgent.md](/Users/mu9/proj/handAgent/handAgent.md)。

## 直接子节点

- [PRODUCT.md](./PRODUCT.md)：整个 Wisp Pocket 的共享产品背景；产品与界面设计前读取，涵盖目的、使用场景、能力边界及待确认事项。
- [product-alignment.md](./product-alignment.md)：产品决定与 spec / issue 历史的对齐记录；区分已确认方向、已实现行为及实机验收状态。
- [surfaces/surfaces.md](./surfaces/surfaces.md)：按用户任务拆分的界面现状与 brief；进入具体界面设计前读取。
- [issue-2-plan.md](./issue-2-plan.md)：后端所有权重构的已完成实施记录。
- [issue-3-design.md](./issue-3-design.md)：状态所有权规格入口、后端保留理由与最终验证状态。
- [backend-state-ownership.md](./backend-state-ownership.md)：后端状态唯一所有权 DAG。

- [TODO.md](/Users/mu9/proj/handAgent/docs/TODO.md)：尚未实现的产品 / 架构待办；实现并验证后移出。
- [bugs.md](/Users/mu9/proj/handAgent/docs/bugs.md)：当前仍未修复、需要排查的缺陷。
- [manual-qa.md](/Users/mu9/proj/handAgent/docs/manual-qa.md)：已实现但需要人工回归或实机验收的项目。
- [archive.md](./archive.md)：已通过实机验收的原始条目与历史证据。
- [dev.md](/Users/mu9/proj/handAgent/docs/dev.md)：本地启动、排查和验证边界。
- [dependency-audit.md](/Users/mu9/proj/handAgent/docs/dependency-audit.md)：依赖收敛后仍保留的独立迁移项。
- [llm-api-integration.md](/Users/mu9/proj/handAgent/docs/llm-api-integration.md)：真实 LLM API 集成测试说明。
- [agents/agents.md](/Users/mu9/proj/handAgent/docs/agents/agents.md)：工程 skills 的 issue tracker、triage 标签与领域文档消费规则。
- [adr/adr.md](/Users/mu9/proj/handAgent/docs/adr/adr.md)：跨模块架构决策、实现状态与排除范围。
- [human/human.md](/Users/mu9/proj/handAgent/docs/human/human.md)：面向人工操作和系统能力的补充说明。
- [research/research.md](./research/research.md)：外部产品与交互研究；区分官方事实、观察和设计建议。
- [medium-powers/medium-powers.md](/Users/mu9/proj/handAgent/docs/medium-powers/medium-powers.md)：待实现规格与历史 spec / plan 集合。

## 放置规则

- 当前架构事实不要写进 `docs/` 平铺文件；应放在 owning 模块的 `<dir>.md`。
- 已修复但未实机验收的项目放 `manual-qa.md`，不要继续占用 `bugs.md`。
- 历史证据、日志路径和一次性排查记录只在仍会改变下一次验证动作时保留。

## 界面规格与调研的阅读顺序

编写 / 修订涉及界面的 spec 或方案时，先读 PRODUCT，再从 [surface 索引](./surfaces/surfaces.md) 进入对应界面的当前交互合约，随后核对 owning 源码目录文档与代码，最后筛选研究 / 历史设计。当前 surface 是明确已有体验的入口，研究中的推荐布局不能自动替换已实现交互。

spec 应明确哪些现有交互保持、哪些因用户要求改变；未经明确要求改变的点击、hover、聚焦、显隐和草稿语义继续保留。发现 surface 与代码冲突时立即修正现状说明，不能将研究建议补写成当前事实。

先判断文档角色再对齐：已确认但未实现的产品目标、spec / ADR 不按旧代码回退；当前 surface 与模块事实按代码核对。历史规格只在后续明确决定覆盖的范围失效，不根据 issue 开闭状态推断实现或验收完成。
