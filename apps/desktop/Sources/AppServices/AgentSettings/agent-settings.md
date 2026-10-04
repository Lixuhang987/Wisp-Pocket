# AgentSettings 模块

此目录只持久化 Swift 原生偏好、PromptPanel 工作区选择与宿主内置功能开关。模型、Codex 可用状态、MCP、永久 Permission、Workspace 归后端，Pet 归 Electron 前端；原生不保存这些业务配置的镜像。

## 直接文件

- `AgentSettingsStore.swift`：Observation/MainActor 的原生偏好 Store，默认 `~/.spotAgent/native-preferences.json`，500ms 比较 raw Data 轮询外部修改。
- `BuiltinFeatureSettingsStore.swift`：独立 `~/.spotAgent/builtin-features.json`，只拥有默认关闭的 Automation 开关及 IO 错误。

## 跨模块合约

- 原生偏好包含 `appearance.themePreference` 与可选 `promptWorkspaceId`；后者只记忆 PromptPanel 选择，不镜像 Workspace 注册表。独立文件边界防止 Swift 的旧镜像覆盖后端 `settings.json` 模型配置；不存在兼容迁移或双写路径。
- 偏好更新以 JSONEncoder prettyPrinted/sortedKeys 原子写入，成功后才更新内存与 lastLoadedData；失败保留有效偏好并显示错误。主题解析和 Electron 下发由 [Appearance](../Appearance/appearance.md) 拥有。
- Automation 仅在成功原子写入后通知 [BuiltinFeatures](../PlatformBridge/platform-bridge.md)，不随设置窗口关闭而停止。Context History 常驻，没有可持久化的启用开关。
- `HANDAGENT_HOST_DATA_HOME` 只隔离内置功能配置及业务存储，不重定向原生外观、模型、Thread 或 AgentTrigger，见 [开发说明](../../../../../docs/dev.md)。
- [Settings](../../Settings/settings.md) 通过 ViewModel 调用 Store；不要在 Store 引入模型请求或工具运行状态。

## 验证

`AgentSettingsStoreTests` 使用临时 home 验证外观保存、读取与后台模型配置交错写入后的独立性。内置功能公开主路径在 PlatformBridge 用例验证。
