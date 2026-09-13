# PlatformBridge 测试

主要用例从 `DynamicToolProviderService` 的 hello 与 `tool_call_request` 进入真实内置模块、业务调度和临时持久化，再检查响应和重建后读回的数据。不可控的 macOS 权限、窗口、截图、事件或时间才使用替身。

## 直接文件

- `BuiltinContextHistoryUseCaseTests.swift`：启用、变化/周期采样、分层查询、可解码图片、证据关联、重建读取、取消及可见失败。
- `BuiltinAutomationUseCaseTests.swift`：跨调用录制、共享证据、Policy 重建执行、失败进度、修复重跑、参数/版本上界拒绝、禁用取消和配置失败回滚。
- `MacAutomationLiveEventRecorderTests.swift`：多个会话共享事件源、启动失败、最后停止与释放、文本和快捷键事件。
- `MacPlatformNativeAutomationTests.swift`：原生动作契约、应用/窗口关联、图片真实尺寸、Unicode 与快捷键编码、错误跨边界返回。
- `MacHostDynamicToolsTests.swift`：原生声明、请求分派、callId 和失败内容。
- `MacPlatformProviderParsingTests.swift`：截图、AX 目标与动作参数边界。

## 验证边界

- `AutomationUseCaseFixture` 只在测试 target 内共享给 [应用退出用例](../../tests-swift.md)，复用真实 Provider、业务模块和 Store；放开的可见性不形成生产接口，系统动作和录制监听仍是受控边界。
- 在上述用例中生成或解码图片不代表实机截屏已通过；系统替身发出的事件也不证明操作过真实窗口。
- 修改录制证据时区分事件时间与停止录制时采样，避免测试把两者当成同一时刻。
- 真实权限、窗口生命周期、录制及执行结果从 [manual-qa](../../../../../docs/manual-qa.md) 验收；生产合约见 [PlatformBridge](../../../Sources/AppServices/PlatformBridge/platform-bridge.md)。
