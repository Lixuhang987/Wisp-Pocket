# Bridge 测试

本目录使用真实 `WebSocketDynamicToolBridge`，只替换 Provider 的发送函数或定时器，验证调用方可见的传输关联和失败结果。

## 直接文件

- `WebSocketDynamicToolBridge.test.ts`：按 token/callId 回流、在线工具快照与刷新隔离、Provider 离线与替换、显式超时，以及同步发送失败后的相同 callId 重试。

## 边界

- 在线声明刷新须过滤 clientId，并验证旧 token 无法覆盖新 Provider；调用方读取快照后不能改写 bridge 保存的集合。
- 发送失败必须同时释放 pending 与 timer；验证重试真正再次发送并成功，而不只验证首次 Promise 被拒绝。
- 默认长操作、同连接声明刷新与真实 Thread 中断由 [主路径用例](../use-cases/use-cases.md) 验证。
- 生产失败语义见 [bridges](../../src/bridges/bridges.md)；本目录不执行真实 macOS 操作，也不提供实机通过证据。
