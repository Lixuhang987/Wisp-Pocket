# thread

`thread/` 拥有 [Conversation Runtime](../../CONTEXT.md) 的 Thread 生命周期。存储、模型和工具通过服务端口注入；外部只提交操作并消费投影。

## 直接子节点

- `Thread.ts`：单个 Thread 的历史、输入、Turn、中断、请求和关闭。
- `ThreadRegistry.ts`：加载、创建、删除和后端关闭的唯一入口。
- `ThreadRequests.ts`：Permission/Workspace 待答表、唯一回执和超时。
- `ThreadTools.ts`：Thread 工具组合和懒激活。
- `types/`：Thread 历史、服务端口和请求类型。
- `utils/`：生命周期辅助函数。

## 接收与执行

- UserInput 在接收时保存原始内容与附件引用，再发布 `user.message.recorded`。输入身份来自 `opId`；同一输入开始时以该身份作为 `turnId`，供 UI 和持久化区分已接收与已开始。
- Thread 持有唯一执行队列，每条输入各自形成 Turn。执行中的新输入照常持久化并显示待处理，不中断当前 Turn，也不混入当前模型输入副本。
- 当前 Turn 结束后依次处理队列。模型和工具等待不占用短操作队列，中断、回执和删除可及时进入。
- 重启恢复从持久历史重建未开始输入；resume 只恢复可见状态，下一条 UserInput 才唤起保留的队列。已开始但未结束的 Turn 标记为中断/失败，不自动重放。
- 存储失败暂停后续执行；恢复只基于已确认落盘历史，不把 renderer 内存当作输入真源。

## 拖入与请求

- `mode: "inspect"` 输入先经注入的 `prepareInput` 读取本次资料，再进入仅分析的 runtime。读取失败保留输入并生成面向用户的原因说明；读取实现归 [agent-server](../../../../apps/agent-server/src/thread/thread.md)。
- [runtime](../runtime/runtime.md) 的 `user.ask` 结束 Turn 并留下等待普通消息的 assistant 内容，因此后续回复可直接继续，不占用请求 broker。
- Permission/Workspace 仍由 `ThreadRequests` 持有。一次有效 ClientResponse 消耗一个请求，随后发布 `request.resolved`；两种界面同时回复也只产生一次决定。
- snapshot 包含当前待答请求；请求解决、取消或超时后同步清理。Permission/Workspace 的既有时限不用于建议等待。
- Thread 关闭、中断或删除后，旧执行的晚到结果不能修改历史；共享服务不随单个 Thread 释放。

协议合约见 [protocol](../protocol/protocol.md)，持久化恢复见 [thread-store](../../../thread-store/thread-store.md)。
