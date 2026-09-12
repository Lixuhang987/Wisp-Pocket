# protocol

`protocol/` 定义 Conversation Runtime 的跨进程消息。概念定义见 [Conversation Runtime](/Users/mu9/proj/handAgent/packages/core/CONTEXT.md)，字段以本目录 TypeScript 类型为真相。

## 直接子节点

- `types/`：Thread 命令、通知、请求与回执、Op / Input Item、snapshot、Agent Activity 和 Dynamic Tool 的类型定义。

## 通道与消息族

| 通道 | 客户端到服务端 | 服务端到客户端 |
| --- | --- | --- |
| `/api/thread` | ThreadCommand、ClientResponse | ThreadNotification、ServerRequest |
| `/api/activity` | 无业务命令 | AgentActivityEvent |
| `/api/dynamic-tools` | Provider hello/response | Dynamic Tool call request |

## 合约

- `thread.start` 只创建 Thread；初始与后续输入都通过 `op.submit(UserInput)`。
- 公开 `op.submit` 只接受 UserInput 或 Interrupt。ClientResponse 独立传输，经 agent-server 检查连接资格后交给所属 Thread 的待答请求；内部 ClientResponse Op 类型不改变这一接入规则。
- 所有 Thread client 默认接收新建 Thread 并订阅普通通知；ServerRequest 只发给合格的交互式订阅连接。
- `thread.resume` 返回 snapshot，是打开历史 Thread 的入口，不表示 socket 恢复。
- `workspace.listed` 是连接级响应，不带 `threadId`；其他 Thread 消息按 `threadId` 路由。
- Agent Activity 是 Thread 状态的轻量投影，不暴露完整消息。
- Dynamic Tool frame 必须带 provider `clientId`；Tool call 还关联 Thread、Turn 与 call ID。

## Input Item 与附件

- Input Item 支持 text、image、skill 和 text_selection；其中 `skill` 是 Append Prompt 的协议表示。
- user live notification 与 snapshot 都保留可选 Input Item，保证结构化回显。
- image 的模型内容保存 Blob 引用，LLM 调用前再展开；结构化 image Input Item 仍保存 base64，供协议回显。

## 修改约束

- 协议字段保持强类型和平铺，避免不受约束的 JSON 黑洞。
- 新消息或字段必须检查 Swift codec、React guard、agent-server 翻译和 thread-store round-trip。
- ThreadNotification、ThreadAuditEvent 与 runtime event 是不同所有权，不共享一个万能事件类型。
