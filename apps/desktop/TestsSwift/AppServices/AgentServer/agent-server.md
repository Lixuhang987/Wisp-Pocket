# AgentServer 测试

## 直接文件

- `AppServerConnectionTests.swift`：连接、Provider hello/调用，以及 Swift 首轮提交的工具 metadata。
- `AgentServerHealthTests.swift`：可用性与错误回调。
- `AgentServerRuntimeModeTests.swift`：生产/测试运行模式选择。

## 合约

- 连接测试只替换 WebSocket 传输；内置功能选择变化必须立即发送新 hello，保留原生工具并按实际启用状态声明业务工具。
- Swift 新建 Thread 使用当前 Provider 工具集合；既有 Thread metadata 不随 hello 更新。
- 服务端在途调用与身份替换的验证归 [server 用例](../../../../agent-server/tests/use-cases/use-cases.md)。本目录与 [生产连接](../../../Sources/AppServices/AgentServer/agent-server.md) 同步维护字段和生命周期约定。
