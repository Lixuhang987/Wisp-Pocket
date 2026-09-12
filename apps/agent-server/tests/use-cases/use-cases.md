# use-cases

本目录从调用方入口验证 server 与 core 的组合边界，使用真实业务 owner 和持久化，不在测试中平行重建 Thread 状态。

## 直接文件

- `thread-lifecycle.test.ts`：socket 分派、通知、请求回流、Activity 与 Dynamic Tool 声明刷新。
- `thread-ownership.test.ts`：Thread 状态所有权、持久化、断连、删除、运行隔离及真实 Thread/Bridge 的中断与晚到结果。

## 验证边界

- Dynamic Tool 用例使用真实 `WebSocketDynamicToolBridge` 与 `DynamicToolAdapter`，以 socket 传输替身输入 hello/request/response。相同连接的声明刷新必须保留在途调用；默认长操作等待实际结果，真正关闭连接后才 offline。显式超时另由 bridge 边界测试覆盖。
- Thread 中断用例保留真实 ThreadTools、DynamicToolAdapter、Runtime 与 Bridge；中断返回后晚到的 Provider 响应不得改写已保存历史、恢复旧 Turn 或触发下一次模型调用。它不证明宿主任务被远程取消。
- 修改 Provider 身份语义时同时核对 [server](../../src/server/server.md) 和 Swift 的连接用例；传输测试不替代 Context History / Automation 的业务用例或 macOS 实机验收。
