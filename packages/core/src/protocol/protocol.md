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

- `thread.start({workspaceId})` 只创建归属该 Workspace 的 Thread；稳定 commandId 关联重试，对应 Thread 已删除时返回 not_found，不重新创建。初始与后续输入均经 `op.submit(UserInput)`；公开 Op 只接受 UserInput 或 Interrupt。
- 新建 Thread 会通知所有已连接客户端并建立普通通知订阅。声明 `acceptServerRequests=1` 的订阅者才能接收并回答交互请求；桌宠和 ThreadWindow 可同时呈现同一请求。
- ClientResponse 独立传输，由 agent-server 检查连接与订阅资格后交给所属 Thread 的待答表；core 只消费一次有效回执，并发布 `request.resolved`。内部 Op 类型不改变此接入规则；snapshot 的 `pendingRequests` 恢复当前待答表。
- `thread.resume` 返回 snapshot；恢复历史与断线后的重新订阅由各客户端明确发起。
- `thread.list` 支持 workspaceId 查询，以更新时间和 id 稳定分页，游标绑定范围。Workspace 与派生 rootPath 在列表、started、snapshot 中一致；前端各自选择与接续 Thread。后台 started 不决定当前选择。
- `user.message.recorded.pending` 表示输入已接收但尚未开始。输入的 `messageId` 与其 `turn.started.turnId` 对应，开始后清除 pending。
- `workspace.listed` 与 `thread.listed` 是不带 `threadId` 的连接级响应；带 `threadId` 的消息按订阅路由。
- `thread.deleted` 携带目标 ID：删除成功广播全部连接，`not_found` 只回发起连接。客户端收到成功结果或重连后的权威列表时清理被删 Thread。

## Workspace 与轻量观察

- workspace.list 返回全部项目；workspace.create 创建或复用实际目录，只返回 `{workspace,created}`，创建结果广播。Pet 资料、图片和 Thread 关联由前端拥有，不进入本协议。
- `observeRequests=1` 连接观察通用 Thread 身份、Permission 与 `request.resolved` / `thread.deleted` 结束事实；`thread.list` 每页后补发该页有效待答请求，不加载 Thread 历史或订阅正文。观察者没有回答资格，正常交互连接使用 `acceptServerRequests=1`。双端约定见 [server](../../../../apps/agent-server/src/server/server.md)。

## 输入与附件

- Input Item 支持 text、image、file_reference、skill、text_selection；`skill` 是普通追加提示的协议表示，包括 Append Prompt 与前端首轮角色提示，链接沿 text 保存。
- PromptPanel 等图片 Input Item 在 `base64` 上传与 `blobId` 引用之间互斥；持久化层保存副本，live 与 snapshot 返回同一规范化项。桌宠 PDF、图片等原文件使用 `file_reference`，仅保存绝对原路径、文件名和可选媒体类型，不读取或上传文件内容；无 bytes/Blob 字段。两端显示文件名，模型转换边界见 [agent-server protocol](../../../../apps/agent-server/src/protocol/protocol.md)。
- UserInput 没有 mode；后端不自动预读或强制追问。模型首轮即可调用默认文件/历史读取工具，其余工具继续既有 Permission。
- assistant 的建议回复与等待标记在 live、snapshot 和持久消息间保持一致。建议按钮发送普通 UserInput；Permission 仍发送 ClientResponse。
- Blob HTTP 读取边界见 [agent-server server](../../../../apps/agent-server/src/server/server.md)，两端附件 URL 共用 [Web 客户端](../../../../apps/thread-window-web/src/src.md)。

## 修改约束

- 协议保持强类型；新字段须核对 agent-server 输入校验、React guard、翻译和 thread-store round-trip。Swift 首轮输入子集由其 codec 独立校验。
- ThreadNotification、ThreadAuditEvent 与 runtime event 各有所有权，不能共享一个万能事件类型。
- Agent Activity 只投影状态，不承载 Thread 内容；Dynamic Tool frame 按 provider 身份与 Thread/Turn/call ID 路由。
