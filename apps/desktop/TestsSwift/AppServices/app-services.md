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

## 验证边界

`AppServices` 与 `AppServices.testing` 在未注入 AgentTrigger runtime 时仍使用生产 factory 并执行 reload；临时 `AgentTriggerStore` 的 home 不会传给默认 Chrome factory。与触发器无关的用例须注入使用同一临时 Store、空 registry 的 runtime；验证 Chrome 时只在 factory 注入临时 home，保留真实 runtime、Provider、Network listener 与 HTTP。整套测试的进程 home 隔离见 [开发说明](../../../../docs/dev.md#swift-测试隔离)。

Chrome reload 回归每轮从磁盘 `bridge.json` 读取 host、port、token，发送 hello 和文件夹快照，再从新建 Store 读回 `folders.json`；这只验证单个隔离进程的发布与接收，不覆盖真实扩展、native host、Settings 或多个 App 实例对发现文件的影响。

包内 main 与 workspace runtime 的组合回归复用真实 `ElectronShellProcess` 与 stdout 事件解码；外部 pnpm/Electron 在系统边界替换，核对 main、runtime 参数与工作目录的组合。该用例不能证明真实 Electron、窗口、后端健康或预热，仍需 [manual-qa](../../../../docs/manual-qa.md) 实机验收。
