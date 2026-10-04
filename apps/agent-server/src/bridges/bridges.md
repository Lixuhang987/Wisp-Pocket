# bridges

本目录桥接 agent-server 与 Dynamic Tool Provider；模型执行、Thread 业务和交互式请求由各 owning 模块负责。

## 直接子节点

- `WebSocketDynamicToolBridge.ts`：Provider 注册、在线能力快照、调用与回执路由。

## Provider 合约

- 首次 `provider_hello` 按 `clientId` 绑定 token，并保存该 Provider 声明且 `clientId` 匹配的 Tool spec。相同身份替换连接时，旧 token 下的 pending call 立即失败。
- 同一 socket、相同 `clientId` 的再次 hello 刷新在线声明，保留 token 和 pending call。刷新须校验当前 token；旧连接不能覆盖新连接的工具集合。
- 新 Thread 未显式指定工具集时，组合根从 `availableTools()` 读取当前在线声明；显式空集合仍表示空集合。spec 随 Thread 保存，后续 hello 不重写已有 Thread metadata；此 metadata 通道保留，但生产主 Agent 不再将声明适配成可见工具。显式 adapter 调用仍按 `clientId` 转发，未提供 Codex 能力出口。
- pending key 由 Provider token 与 provider-facing callId 组成。不同 Provider 的同名 callId 不互相唤醒；旧 socket 的晚到回执被 token 隔离。

## 失败与取消

- Provider 离线或替换使对应 call 失败，由 Runtime 展示 Tool 失败；断线只清理本桥拥有的传输关联。
- 默认等待 Provider 响应或真实连接失效；仅调用方显式传入 `timeoutMs` 时建立 deadline。正常长时间 Automation 不受传输层默认 15 秒限制。
- 发送函数同步抛错时，在拒绝调用前清理 pending 与 timer；相同 callId 后续可重新发送。
- Thread 中断停止旧 Turn 投影，不发送 Provider cancel；宿主 Automation 取消由禁用功能或退出应用触发。生命周期边界见 [core Thread](../../../../packages/core/src/thread/thread.md) 与 [Swift 平台桥](../../../desktop/Sources/AppServices/PlatformBridge/platform-bridge.md)。

## 修改边界

- 本桥只连接 `/api/dynamic-tools`。Permission 经 `/api/thread` 和 core Thread 的 ServerRequest/ClientResponse 处理，接入见 [thread](../thread/thread.md)。
- socket 身份与声明刷新见 [server](../server/server.md)；字段以 [core protocol](../../../../packages/core/src/protocol/protocol.md) 为准。
- 新增 Provider 路由必须保持 token 隔离；验证入口见 [bridge 测试](../../tests/bridges/bridges.md) 与 [主路径用例](../../tests/use-cases/use-cases.md)。
