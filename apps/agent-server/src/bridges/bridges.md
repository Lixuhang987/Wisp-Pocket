# bridges

## 目录职责

`bridges/` 只保留 agent-server 与 Dynamic Tool Provider socket 之间的桥接。这里不执行 LLM、Tool、Thread 请求回执或 UI 业务逻辑。

Permission 与 Workspace 的待答请求由 core Thread 拥有，经 `/api/thread` 发布 ServerRequest；React 回传的 ClientResponse 由 agent-server 检查连接资格后交给所属 Thread。此链路见 [Thread 接入](../thread/thread.md)。

## 文件

| 文件 | 职责 |
|------|------|
| `WebSocketDynamicToolBridge.ts` | 实现 core `DynamicToolBridge`；按 `clientId` 向 provider 发送 `tool_call_request`，按 provider token + provider-facing `callId` 等待 `tool_call_response` |

## Provider token

新的 `/api/dynamic-tools` socket 发送 `provider_hello` 后会按 `clientId` 替换旧 provider 绑定，并让旧 token 下的 pending request 以 offline 失败。pending key 使用 provider token + provider-facing `callId`，因此不同 provider 同时返回相同 `callId` 不会互相唤醒；旧 socket 晚到的 response 因 token 不匹配会被忽略。`WebSocketDynamicToolBridge` 不挂载在 `/api/thread`，也不与 ThreadWindow UI 共享 WebSocket；它只转发 dynamic tool 请求，不实现 macOS 能力。

## 失败语义

- provider 不可用：`bridge.call` reject，由 `DynamicToolAdapter` / runtime 变成 tool 失败。
- dynamic tool request 超时：`bridge.call` reject 超时错误，由 runtime 变成 tool 失败。

## 编辑约束

- 新增桥时必须定义 token/fencing 策略，避免旧 socket 响应影响新 socket。
- Permission / Workspace 交互经 `/api/thread` 和 core Thread 的待答请求处理；本目录只持有 Provider 身份与外部 Tool 调用的传输关联。
- socket close 清理由对应 server handler 调用；dynamic tool bridge 只清理自己的 pending 状态。

## 下一步阅读

- socket 分派：[server/server.md](/Users/mu9/proj/handAgent/apps/agent-server/src/server/server.md)
- Thread 请求生命周期：[core Thread](../../../../packages/core/src/thread/thread.md)
- Dynamic tool 协议：[packages/core/src/protocol/protocol.md](/Users/mu9/proj/handAgent/packages/core/src/protocol/protocol.md)
