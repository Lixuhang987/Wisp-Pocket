# AgentTrigger

本目录实现 [Desktop Experience](/Users/mu9/proj/handAgent/apps/desktop/CONTEXT.md) 中 AgentTrigger Package、Instance 与 Event 的存储和运行。

## 直接文件

- `AgentTriggerModels.swift`：Package、Instance、Event、配置与策略类型。
- `AgentTriggerStore.swift`：Package 安装、Instance 读写和内置 Package 恢复。
- `AgentTriggerRegistry.swift`：provider kind 到 factory 的注册表。
- `AgentTriggerRuntime.swift`：provider 生命周期、Event 渲染和后台 UserInput 提交。
- `AgentTriggerProviders.swift`：System Clock 与 Chrome Bookmarks Provider。
- `ChromeBookmarksExtensionBridge.swift`：书签扩展 loopback bridge。
- `ChromeBookmarksNativeHostInstaller.swift`：Native Messaging Host 安装与诊断。

## 边界

- Package 位于 `~/.spotAgent/agent-triggers/packages/<id>/trigger.json`；Instance 统一保存到 `instances.json`。
- runtime reload 先停止旧 Provider，再按已安装 Package 启动对应 Provider；没有 Instance 的已安装 Provider 仍可启动以维护连接状态。
- Event 只渲染为后台 UserInput，不把 AgentTrigger 来源写入 agent-server、core 或 thread-store。
- AgentTrigger 与 Automation Policy 是不同概念：前者决定何时创建输入，后者描述可回放的宿主操作。
- Chrome bridge 的可靠性遗留项以 [TODO.md](/Users/mu9/proj/handAgent/docs/TODO.md) 为准。

Instance 必须持久化明确 targetPetId，新表单须主动选择目标。事件提交携带此身份，由 Swift Thread client 的 thread.start 验证存在性；失败写入共享 Store 的可见投递状态，Settings 展示错误。旧开发 Instance 缺少目标不进入运行路径，不转换为默认宠。Pet 配置与查询归 [AgentServer client](../AgentServer/agent-server.md)，触发器不缓存另一份配置。
