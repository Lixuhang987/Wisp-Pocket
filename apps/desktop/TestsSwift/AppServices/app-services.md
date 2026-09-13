# AppServices 测试

本目录验证生产组合、共享设置与宿主系统边界。跨模块行为从公开服务入口进入，不用框架安装或进程启动替身代替业务执行。

## 直接子节点

- [AgentServer/agent-server.md](./AgentServer/agent-server.md)：Provider 连接与 Swift Thread 首轮提交。
- [PlatformBridge/platform-bridge.md](./PlatformBridge/platform-bridge.md)：原生能力、两个内置功能与用户事件边界。
- `AgentSettings/`：模型、Tool 和主题设置持久化。
- `Appearance/`、`Hotkey/`、`Lifecycle/`：外观、快捷键和激活策略边界。
- `ElectronShell/`：Electron 进程、command/event 与可用性 gate。
- 当前目录的 `AppServicesTests.swift`、AgentTrigger 与窗口相关测试：生产服务组合、触发器来源和窗口生命周期。

生产所有权见 [AppServices](../../Sources/AppServices/app-services.md)。内置功能配置的失败回滚与模块启停从 PlatformBridge 完整用例覆盖。
