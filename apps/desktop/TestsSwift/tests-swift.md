# TestsSwift

Swift 测试与生产模块所有权对齐。入口使用 `bash ./scripts/swiftw test`，业务持久化放临时目录；窗口、进程、权限与用户事件仅在系统边界替换。

## 直接子节点

- [AppServices/app-services.md](./AppServices/app-services.md)：配置、宿主能力与跨进程接入。
- `Coordinator/`：模块协调、窗口回执与退出语义。
- `PromptPanel/`：主动输入、附件和焦点交接。
- `Settings/`：设置代理与界面约束。
- `Theme/`：主题值与生成 token 的映射。
- `TestSupport/`：临时目录和提交用例辅助。
- `HandAgentAppTests.swift`：真实 AppKit 子进程退出、取消落盘前的延迟退出、重复请求只清理和答复一次。

## 边界

- 内置功能以 Dynamic Tool Provider 为主要用例入口，复用真实业务模块和存储；系统替身通过不能证明真实 AX、截图或事件 tap 可用。
- Automation 退出用例复用 PlatformBridge 的真实 Provider、业务模块与临时存储，挂起系统动作后发起 termination；动作返回前不得答复 AppKit，返回后核对同一 Run 的取消状态、进度和失败位置，并从新建 Store 读回。此用例的系统动作、录制监听与 AppKit 答复使用可控边界，只证明清理与落盘顺序。
- AppKit 退出用例在隔离 XCTest 子进程运行真实 `NSApplication`，将 Electron 可执行程序替换为短命 shell，并为 AgentTrigger runtime 注入空 registry 与临时 Store；复用真实 Process 回调、server、Coordinator、生产 `terminateApplication` 与 delegate/reply，核对从 Task 发出请求、清理完成和进程正常退出，超时回收测试子进程。空 registry 只隔离无关的触发器来源；该用例不替代打包 Electron、agent-server、窗口与在途 Automation 的实机验收。
- 窗口与激活策略测试用 `AppServices.testing(...)` 替换相应系统边界；AgentTrigger 的 home 隔离另见 [AppServices 测试](./AppServices/app-services.md)。实机结果在 [manual-qa](../../../docs/manual-qa.md) 单独维护。
- AgentTrigger 表单用例使用真实 SwiftUI 按钮与不显示的窗口，临时开启测试进程的 AX 并在结束时恢复；Store 与文件夹快照使用临时 home，不启动 runtime，也不查询用户的 Chrome 安装状态。该用例证明按钮到 ViewModel、界面错误和持久化边界，不替代真实窗口的视觉验收。

Settings 的裸输入控件、通用按钮与硬编码颜色由仓库 `scripts/test.sh` 中的 SwiftLint 检查；XCTest 保留真实设置操作与状态回归。文档措辞、源码中的控件名称和仅构造 hosting view 不作为产品行为验证。
