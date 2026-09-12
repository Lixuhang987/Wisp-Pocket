# Host Automation 测试

此 Swift target 使用真实 Store、采样调度、录制和 Policy runtime，临时数据目录彼此隔离。`HostAutomationCapabilities` 与用户事件源只替换不可控系统边界。

## 直接文件

- `ContextHistoryTests.swift`：既有业务数据格式、图像验证、重复启动/重叠 tick 和磁盘失败。
- `AutomationRuntimeTests.swift`：条件分支、步骤/断言、录制转 Policy、执行历史、修复数据应用与非法输入。

## 验证入口

- 模块检查：`bash ./scripts/swiftw test --filter HandAgentHostAutomationTests`。
- Dynamic Tool 注册、分派与模块重建的完整用例归 [desktop PlatformBridge 测试](../../desktop/TestsSwift/AppServices/PlatformBridge/platform-bridge.md)。
- 真实用户事件、权限与桌面结果必须进入 [manual-qa](../../../docs/manual-qa.md)，本目录通过不作为实机结论。
