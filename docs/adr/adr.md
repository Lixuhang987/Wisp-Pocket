# 架构决策

本目录记录跨模块架构选择及理由；目标设计是否已实现，以各决策的说明为准。

## 直接子节点

- [0001-backend-state-ownership.md](./0001-backend-state-ownership.md)：整个后端的状态归属与依赖边界重构原则。
- [0002-tool-permission-memory.md](./0002-tool-permission-memory.md)：删除 Thread 授权记忆，永久权限按工具名称匹配。
- [0003-context-history-without-plugin-framework.md](./0003-context-history-without-plugin-framework.md)：移除通用 Plugin 框架，保留内置 Context History、Automation 与轻量 Dynamic Tool；已确认，待实施。
