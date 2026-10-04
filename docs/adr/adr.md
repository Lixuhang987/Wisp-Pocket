# 架构决策

本目录记录跨模块架构选择及理由；目标设计是否已实现，以各决策的说明为准。

## 直接子节点

- [0001-backend-state-ownership.md](./0001-backend-state-ownership.md)：整个后端的状态归属与依赖边界重构原则。
- [0002-tool-permission-memory.md](./0002-tool-permission-memory.md)：删除 Thread 授权记忆，永久权限按工具名称匹配。
- [0003-context-history-without-plugin-framework.md](./0003-context-history-without-plugin-framework.md)：以内置 Context History / Automation 替代通用 Plugin 框架，保留持久化与真实功能验收边界。
- [0004-context-history-default-tools.md](./0004-context-history-default-tools.md)：默认开放历史与文件读取、文件按路径交付、取消输入分阶段并移除采集开关；已实现，实机待验。
- [0005-settings-data-ownership.md](./0005-settings-data-ownership.md)：设置按数据使用方划分读写边界，原生独立偏好与后端配置接口已实现；MCP 运行刷新后续实现，实机待验。
- [0006-workspace-pet-separation.md](./0006-workspace-pet-separation.md)：历史 Workspace / Pet 拆分决策；Pet 所有权与 Thread 双归属已由 0007 替代，固定项目根与逐 Turn AGENTS.md 保留。
- [0007-frontend-pet-workspace-threads.md](./0007-frontend-pet-workspace-threads.md)：Pet 前端唯一 store、Thread 仅归 Workspace、独占分配与 Permission 承接已实现，实机待验。
- [0008-codex-execution-delegation.md](./0008-codex-execution-delegation.md)：主 Agent 收敛为问答、读取与 Codex 委托，复杂任务、写文件和扩展执行交给 Codex 的目标；访谈中，尚未实现。
