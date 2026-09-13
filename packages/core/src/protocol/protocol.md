# protocol

本目录定义 Conversation Runtime 的跨进程 DTO。概念见 [Conversation Runtime](../../CONTEXT.md)，字段以 `types/` 中的 TypeScript 定义为真相。

## 直接子节点

- `types/`：Op/Input Item、ThreadCommand、ThreadNotification、ServerRequest/ClientResponse、snapshot/list、Agent Activity 与 Dynamic Tool DTO。

## 通道与消息族

| 通道 | 客户端到服务端 | 服务端到客户端 |
| --- | --- | --- |
| `/api/thread` | ThreadCommand、ClientResponse | ThreadNotification、ServerRequest |
| `/api/activity` | 无业务命令 | AgentActivityEvent |
| `/api/dynamic-tools` | Provider hello/response | Dynamic Tool call request |

## Thread 合约

- `thread.start` 只创建 Thread，初始与后续输入均经 `op.submit(UserInput)`；公开 Op 只接受 UserInput 或 Interrupt。
- 新建 Thread 会通知所有已连接客户端并建立普通通知订阅。声明 `acceptServerRequests=1` 的订阅者才能接收并回答交互请求；桌宠和 ThreadWindow 可同时呈现同一请求。
- ClientResponse 独立传输，由 agent-server 检查连接与订阅资格后交给所属 Thread 的待答表；core 只消费一次有效回执，并发布 `request.resolved`。内部 Op 类型不改变此接入规则；snapshot 的 `pendingRequests` 恢复当前待答表。
- `thread.resume` 返回 snapshot；恢复历史与断线后的重新订阅由各客户端明确发起。
- `thread.started.payload.createdAt` 与历史列表创建时间用于选择最新 Thread，不能用最后消息时间替代。
- `user.message.recorded.pending` 表示输入已接收但尚未开始。输入的 `messageId` 与其 `turn.started.turnId` 对应，开始后清除 pending。
- `workspace.listed` 与 `thread.listed` 是不带 `threadId` 的连接级响应；带 `threadId` 的消息按订阅路由。
- `thread.deleted` 携带目标 ID：删除成功广播全部连接，`not_found` 只回发起连接。客户端收到成功结果或重连后的权威列表时清理被删 Thread。

## 输入与附件

- Input Item 支持 text、image、pdf、skill、text_selection；`skill` 是 Append Prompt 的协议表示，链接沿 text 保存。
- 图片/PDF 的输入源在 `base64` 上传与 `blobId` 引用之间互斥。持久化层先保存副本，live 与 snapshot 返回同一规范化 Input Item；原文件路径不进入恢复合约。
- `UserInput.mode: "inspect"` 表示只授权读取主动交付资料。模型消费图片内容及读取到的网页/PDF 正文，不能仅凭文件名或 URL 声称已读。
- assistant 的建议回复与等待标记在 live、snapshot 和持久消息间保持一致。建议按钮发送普通 UserInput；Permission/Workspace 仍发送 ClientResponse。
- Blob HTTP 读取边界见 [agent-server server](../../../../apps/agent-server/src/server/server.md)，两端附件 URL 共用 [Web 客户端](../../../../apps/thread-window-web/src/src.md)。

## 修改约束

- 协议保持强类型；新字段须核对 agent-server 输入校验、React guard、翻译和 thread-store round-trip。Swift 首轮输入子集由其 codec 独立校验。
- ThreadNotification、ThreadAuditEvent 与 runtime event 各有所有权，不能共享一个万能事件类型。
- Agent Activity 只投影状态，不承载 Thread 内容；Dynamic Tool frame 按 provider 身份与 Thread/Turn/call ID 路由。
