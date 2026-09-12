# TestsSwift

Swift 测试与生产模块所有权对齐。入口使用 `bash ./scripts/swiftw test`，业务持久化放临时目录；窗口、进程、权限与用户事件仅在系统边界替换。

## 直接子节点

- [AppServices/app-services.md](./AppServices/app-services.md)：配置、宿主能力与跨进程接入。
- `Coordinator/`：模块协调、窗口回执与退出语义。
- `PromptPanel/`：主动输入、附件和焦点交接。
- `Settings/`：设置代理与界面约束。
- `Common/`、`Theme/`：共享组件与主题。
- `TestSupport/`：临时目录和提交用例辅助。
- `HandAgentAppTests.swift`：应用入口与 termination 接入。

## 边界

- 内置功能以 Dynamic Tool Provider 为主要用例入口，复用真实业务模块和存储；系统替身通过不能证明真实 AX、截图或事件 tap 可用。
- 窗口与激活策略测试用 `AppServices.testing(...)` 隔离系统副作用；实机结果在 [manual-qa](../../../docs/manual-qa.md) 单独维护。
