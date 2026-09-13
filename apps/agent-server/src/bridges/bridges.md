# bridges

本目录桥接 agent-server 与 Dynamic Tool Provider；模型执行、Thread 业务和交互式请求由各 owning 模块负责。

## 直接子节点

- `WebSocketDynamicToolBridge.ts`：Provider 注册、在线能力快照、调用与回执路由。

## Provider 合约

- `provider_hello` 按 clientId 绑定新 token，并保存该 Provider 声明且 clientId 匹配的 Tool spec。相同 clientId 替换连接时，旧 token 下的 pending call 立即失败。
- 新 Thread 没有显式指定工具集时，组合根可从 `availableTools()` 获取当前在线能力；spec 随 Thread 保存，执行仍按 clientId 转发给在线 Provider。
- pending key 由 Provider token 与 provider-facing callId 组成。不同 Provider 的同名 callId 不互相唤醒；旧 socket 的晚到回执被 token 隔离。
- Provider 离线、替换或调用超时使对应 call 失败，由 runtime 展示 Tool 失败；断线只清理本桥拥有的 pending 状态。

## 修改边界

- 本桥只连接 `/api/dynamic-tools`；Permission/Workspace 通过 [core Thread](../../../../packages/core/src/thread/thread.md) 的 ServerRequest/ClientResponse 处理。
- socket 绑定见 [server](../server/server.md)，默认 Thread 能力选择见 [thread](../thread/thread.md)。
- 新增 Provider 路由必须保持 token 隔离，不能让旧连接回执影响新连接。
