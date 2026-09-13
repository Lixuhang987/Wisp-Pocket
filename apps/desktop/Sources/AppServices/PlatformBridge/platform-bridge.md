# Host Dynamic Tools

本目录把共享 macOS 能力与两个已知内置模块接入 Dynamic Tool。`DynamicToolProviderService` 处理请求并保留 `callId`；`host_macos` 进入 `MacPlatformProvider`，`context_history` / `automation` 进入 `BuiltinFeatures`，业务状态归 [Host Automation](../../../../host-automation/host-automation.md)。

## 直接文件

- `MacHostDynamicTools.swift`：原生工具声明、方法映射与 Provider 请求分派。
- `BuiltinFeatureToolSpecs.swift`：两个业务模块的公开参数、结果与失败说明。
- `BuiltinFeatures.swift`：显式持有配置、Context History 和 Automation，并同步启停与工具声明。
- `MacPlatformProvider.swift`：应用/窗口、ScreenCaptureKit、Vision 与 Accessibility 的共享系统实现。
- `MacAutomationLiveEventRecorder.swift`：按 Recording Session 共享并回收 macOS 事件监听。

## 所有权与生命周期

- 生产组合点 [AppServices](../app-services.md) 创建同一个 `MacPlatformProvider`，原生 Tool 与两个模块直接复用它。`HostAutomationCapabilities` 只表达固定系统边界，不做能力发现、安装或进程托管。
- 两个模块默认关闭。启用选择由 [BuiltinFeatureSettingsStore](../AgentSettings/agent-settings.md) 持久化；写入成功才应用选择并发布新的工具声明。
- Context History 采集与 Automation 操作由应用生命周期管理。关闭窗口继续；禁用或退出取消任务并清理监听，已保存历史与 Policy 保留。
- 正常退出由 [Coordinator](../../Coordinator/coordinator.md) 等待 `BuiltinFeatures.stopAndWait()`：先撤下业务声明、配置回调并停止模块，再等待 Automation 在途操作收尾。同步 `stop()` 只发出取消，不代表 Run 已保存；等待与持久化边界见 [业务源码指南](../../../../host-automation/Sources/sources.md)。
- Thread 中断只停止推理与旧 Turn 投影；现有 Dynamic Tool 协议没有远程 cancel，不会自动停止 Host 步骤。需要停止 Automation 宿主任务时禁用功能或退出应用，Thread 等待上限见 [core Thread](../../../../../packages/core/src/thread/thread.md)。
- 原生 `host_macos` 工具始终声明；业务 namespace 只在对应模块启用时声明。禁用后的调用返回失败，不把旧 Thread 中仍保留的声明当作启用授权。
- Automation event tap 只在请求 `captureUserEvents=true` 时创建，多个 Recording Session 共享监听源；最后一个会话停止或模块停机后释放。实时事件的证据时间合约见 [业务源码指南](../../../../host-automation/Sources/sources.md)。

## 通道与内容合约

- [DynamicToolProviderConnectionClient](../AgentServer/agent-server.md) 使用独立 `/api/dynamic-tools` WebSocket，连接或工具选择变化时发送 `provider_hello`。同一 socket、同一 `clientId=swift-host` 的再次声明保留待完成调用，server 身份边界见 [server](../../../../agent-server/src/server/server.md)。
- Swift 创建 Thread 时把当时的工具集合写入 `thread.start.payload.dynamicTools`；桌宠与 ThreadWindow 不显式传集合时采用服务端当前在线声明。刷新保留当前连接 token，旧连接不能改写新 Provider 声明；已有 Thread metadata 不随 hello 更新。启用后以新建 Thread 验证新能力，禁用后即使旧声明仍在，模块也拒绝调用。
- 结果沿用 `success` / `contentItems`；JSON 元数据放在 `inputText`，可显示图片放在 `inputImage`。截图查询保留图片与样本关联；权限不足、损坏数据和未知调用返回明确失败。
- 动态工具通道不承载 `/api/thread` 消息，不自动向 UserInput 注入宿主状态。上下文与操作仍由 Agent 按需调用。

## macOS 边界

- `MacPlatformProvider` 共享前台应用及其窗口、应用激活、截图/缩略图、AX 快照与动作；原生工具还保留剪贴板、应用/窗口列表与 OCR。
- 应用激活只定位已运行目标。宿主自身走 `NSApplication` 激活入口；外部应用的 AppKit 请求被拒绝时，使用已有 Accessibility 授权设置目标 `AXFrontmost`，权限不足或目标失效返回明确错误。原生工具声明须说明后台激活可能需要辅助功能权限。
- 激活成功要求系统前台 PID 与目标 PID 相同，且目标 active 状态同时持续至少 150ms；保留目标退出、取消与超时检查。AppKit 或 AX 接受请求本身不代表完成切换；无可见窗口的宿主自激活仍可能被系统拒绝，不能据外部应用激活成功承诺该场景可用。
- ScreenCaptureKit 负责显示器、窗口或区域截图；图片与实际尺寸必须一致。OCR 只识别传入图片，不自行读取屏幕或文件。
- AX 快照有深度与子节点数量限制。动作支持 press、click、set_value、type_text、hotkey；定位可用 elementId、role/title selector、当前焦点或显式点击坐标，具体组合以工具 schema 和解析类型为准。
- 屏幕录制、辅助功能与用户事件监听权限由系统决定；错误须携带阶段或可读原因。事件监听权限不足不能返回正在录制的空会话。

## 修改与验证

- 修改能力时同步实现、公开 schema、结果内容和 Provider 用例；不要只验证内部函数或生成过标识。
- 测试入口见 [PlatformBridge 测试](../../../TestsSwift/AppServices/PlatformBridge/platform-bridge.md)，真实权限、窗口关闭、退出、录制与执行验收从 [manual-qa](../../../../../docs/manual-qa.md) 进入。
