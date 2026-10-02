# 以内置模块替代通用 Plugin 框架

状态：已确认；内置实现已接入，实际功能验收状态见 [manual-qa](../manual-qa.md)。完整范围与验收标准见 [Issue #4](https://github.com/Lixuhang987/Wisp-Pocket/issues/4)。

Context History 与 Automation 的启停、业务状态和工具入口可以由专用模块承担，当前没有需要通用插件发现、安装、依赖与进程托管的产品需求。决定移除通用 Plugin 框架，将两者作为 Swift Host 明确接入的内置模块，保留 Dynamic Tool 作为实时宿主与 Automation 面向 Agent 的轻量能力接口；已保存 Context History 的查询已由 [ADR 0004](./0004-context-history-default-tools.md) 调整为 agent-server 普通 Tool，以降低维护与验证成本。

采集跟随应用生命周期：Context History 随应用常驻采集，关闭窗口继续，完全退出 Wisp Pocket 后停止；原采集开关已由 ADR 0004 移除。Automation 仍保留独立启用开关。Automation 保留录制、流程保存、执行、历史与修复数据入口；可复用流程依靠持久化，不要求进程永久运行。macOS 能力由宿主内部实现共享，业务历史和已保存流程不随框架移除而删除。

本轮范围是重构并验证现有功能；交付须覆盖真实工具通路与实机用例，单元测试与构建不能替代实机验收。修复数据入口不等于模型自主修复。未来新增能力显式接入产品，通用扩展机制留待出现实际的多实现管理或外部安装需求后再决定。
