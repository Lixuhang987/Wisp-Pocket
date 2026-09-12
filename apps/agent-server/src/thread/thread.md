# thread

`thread/` 适配 ThreadCommand、连接订阅和持久化。业务生命周期由 [core ThreadRegistry / Thread](../../../../packages/core/src/thread/thread.md) 拥有，连接身份只留在 agent-server。

## 直接文件

- `ThreadCommandRouter.ts`：命令路由、定向回复、错误关联与回答资格检查。
- `ThreadPersistence.ts`：输入与 Blob 转换、历史增量、残缺 Turn 恢复和存储句柄管理。
- `ThreadNotificationPublisher.ts`：连接订阅和定向发布。

## 命令边界

- 创建、加载、查询和删除经同一 Registry；输入排队、中断、持久化确认和关闭规则在 Thread 内协调。
- `thread.started` 向全部已连接客户端发布并建立订阅；snapshot、列表、删除结果和命令错误定向回发起连接。`workspace.list` 是不带 `threadId` 的连接级查询。
- 公开 `op.submit` 只接受 UserInput 或 Interrupt。ClientResponse 经交互连接资格与 Thread 订阅检查后交给 `Thread.requests.answer`；请求是否仍有效由 core 判断。
- socket 断开只移除连接及订阅；ServerRequest 只发送给合格订阅者，不取消 Thread，也不在新连接加入时补发请求。

## 状态与持久化

- `ThreadPersistence` 实现 core 已有的 `ThreadStorage` 端口。它缓存顺序写入句柄，不拥有运行历史、输入队列或 Turn；SQLite 机制归 [thread-store](../../../../packages/thread-store/thread-store.md)。
- Input Item 同时保存模型内容和结构化输入；图片转换依赖 Blob 服务及 [协议翻译](../protocol/protocol.md)，保持 live notification 与 snapshot 的输入表达。
- 运行结果按 base message count 追加生成增量、审计和通知；不能用覆盖整段历史替代该路径，避免抹去已经接收的输入。
- Registry 在冷加载或保存失败恢复时调用重置及残缺 Turn 修复；运行中 snapshot 从 Thread 内存派生。已保存历史是重启恢复真源，重启不自动续跑。

## 修改约束

- Router / Publisher 的连接隔离与 Persistence 的转换、增量和恢复是实际职责；减少调用跳转不能把它们下沉到 Registry 或直接绕过存储端口。
- 新 ThreadCommand 分支进入 router；runtime event 翻译进入 `protocol/`，业务状态修改与晚到结果隔离仍归 core Thread。
- 用户决定经 Thread 的待答请求及 ServerRequest / ClientResponse 交接；Dynamic Tool 通道只承接外部 Tool 调用。
