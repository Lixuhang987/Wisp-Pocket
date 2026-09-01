# thread

`thread/` 把 ThreadCommand 路由到持久 Agent，并负责通知、持久化和中断收敛。

## 直接文件

- `ThreadCommandRouter.ts`：生命周期、查询和 Op 路由。
- `ThreadRuntimeOrchestrator.ts`：active Turn、generation 与中断。
- `ThreadPersistence.ts`：thread-store 适配、snapshot 与残缺 Turn 修复。
- `ThreadNotificationPublisher.ts`：连接订阅和定向发布。
- `ThreadInputQueue.ts`：输入队列与等待者。

## 命令边界

- `thread.start` 创建 Thread；`thread.resume` 返回 snapshot；`thread.list` / `thread.delete` 管理历史。
- `op.submit` 是唯一公开运行期输入；只接受 UserInput 或 Interrupt。
- `workspace.list` 是连接级查询，结果不带 `threadId`，只回发起连接。
- React 的 ClientResponse 由 app-server 包装成内部 Op，不通过公开 `op.submit` 进入。

## 状态与持久化

- 所有 `/api/thread` 连接默认收到新建 Thread，并自动订阅其普通通知；ServerRequest 还要求连接是交互式 owner。
- runtime 回调写入前检查 active generation；被中断旧 Turn 的晚到结果不得污染当前状态。
- user input 同时保存扁平模型内容和结构化 Input Item，确保 live notification 与 snapshot 一致。
- rollout 只追加 generated message、Turn 审计和已发布 notification，不覆盖运行期间已有输入。
- server 重启后首次 resume 会修复未闭合 Turn，并保留明确失败痕迹。

## 中断

- Interrupt 收敛为 `turn.completed(interrupted)` 和 `thread.status.changed(interrupted)`。
- 中断等待超时时关闭旧 Agent session；等待期间已持久化的新输入必须重放，不能丢失。
- Thread delete 若命中运行中 Agent，先中断并等待清理，再删除持久化记录。

## 修改约束

- 新 ThreadCommand 分支进入 router；runtime event 翻译进入 `protocol/`。
- 需要用户决定的能力进入 Agent request broker 与 ServerRequest/ClientResponse，不进入 Dynamic Tool 通道。
- socket、业务状态、持久化和消息翻译保持分离。
