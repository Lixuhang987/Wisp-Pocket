# 架构决策

本目录记录跨模块架构选择及理由；目标设计是否已实现，以各决策的说明为准。

## 直接子节点

- [0001-backend-state-ownership.md](./0001-backend-state-ownership.md)：整个后端的状态归属与依赖边界重构原则。
- [0002-tool-permission-memory.md](./0002-tool-permission-memory.md)：删除 Thread 授权记忆，永久权限按工具名称匹配。
- [0003-context-history-without-plugin-framework.md](./0003-context-history-without-plugin-framework.md)：以内置 Context History / Automation 替代通用 Plugin 框架，保留持久化与真实功能验收边界。
- [0004-context-history-default-tools.md](./0004-context-history-default-tools.md)：默认开放历史与文件读取、文件按路径交付、取消输入分阶段并移除采集开关；已实现，实机待验。
- [0005-settings-data-ownership.md](./0005-settings-data-ownership.md)：设置按数据使用方划分读写边界；原生偏好与 Append Prompt 留在 Swift，后端配置经接口修改，MCP 运行刷新后续实现；已确认、未实现。
