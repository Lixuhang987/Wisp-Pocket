# thread

`thread/` 拥有 [Conversation Runtime](../../CONTEXT.md) 的 Thread 生命周期。存储、模型和工具通过服务端口注入；外部只提交操作并消费投影。

## 直接子节点

- `Thread.ts`：单个 Thread 的历史、输入、Turn、中断、请求和关闭。
- `ThreadRegistry.ts`：加载、创建、删除和后端关闭的唯一入口。
- `ThreadRequests.ts`：Permission 待答表、唯一回执和超时。
- `ThreadTools.ts`：Thread 工具组合和懒激活。
- `types/`：Thread 历史、服务端口和请求类型。
- `utils/`：生命周期辅助函数。

## 接收与执行

- UserInput 在接收时保存原始内容与附件引用，再发布 `user.message.recorded`。输入身份来自 `opId`；相同身份重试只补接收通知，不重复执行；同一输入开始时以该身份作为 `turnId`，供 UI 和持久化区分已接收与已开始。
- Thread 持有唯一执行队列，每条输入各自形成 Turn。执行中的新输入照常持久化并显示待处理，不中断当前 Turn，也不混入当前模型输入副本。
- 当前 Turn 结束后依次处理队列。模型和工具等待不占用短操作队列，中断、回执和删除可及时进入。
- 重启恢复从持久历史重建未开始输入；resume 只恢复可见状态，下一条 UserInput 才唤起保留的队列。已开始但未结束的 Turn 标记为中断/失败，不自动重放。
- 输入保存后才确认并执行，最终结果保存后才发布成功；存储失败暂停后续执行，恢复只基于已确认落盘历史。
- [Runtime](../runtime/runtime.md) 解析的 system 更新经 Thread storage 先确认落盘，再请求模型；模型失败或写入中断不撤销已保存上下文。生成增量排除已单独保存的 system，接续或恢复沿已有版本和时间基准判断，不能重复追加。
- `ThreadStorage` 表达实际存储需求；[agent-server 持久化适配](../../../../apps/agent-server/src/thread/thread.md)承担输入转换、历史增量与恢复，core 不依赖 SQLite 或连接身份。

## 拖入与请求

- 每段 Thread 固定归属 Workspace，执行根从 Workspace 取得，不存文件根快照。前端角色提示通过首轮普通 skill Input Item 保存；恢复只接续历史，不重新注入提示。
- 实际 Turn 开始只读取根 AGENTS.md 一次，同轮模型调用保持内容固定，下一轮重新读取；排队期间不提前固定规则。文件缺失视为空，项目目录不可用或其他读取失败使 Turn 明确失败。用户明确要求优先于项目规则；文本不能改变后端工具与 Permission。
- 输入仅持久接收，不自动读取资料。模型通过默认工具取得文件和历史，所有入口共享同一执行规则。
- [runtime](../runtime/runtime.md) 的 `user.ask` 结束 Turn 并留下等待普通消息的 assistant 内容，因此后续回复可直接继续，不占用请求 broker。
- Permission 仍由 `ThreadRequests` 持有。一次有效 ClientResponse 消耗一个请求，随后发布 `request.resolved`；两种界面同时回复也只产生一次决定。
- snapshot 包含当前待答请求；请求解决、取消或超时后同步清理。Permission 的既有时限不用于建议等待。
- Thread 关闭、中断或删除后，旧执行的晚到结果不能修改历史；共享服务不随单个 Thread 释放。
- 中断有独立完成等待上限（默认 3 秒），随后停止旧 Turn 投影，不无限等待外部 Tool Promise。现有 Dynamic Tool 协议没有远程 cancel；Automation 宿主取消由禁用功能或退出应用触发，见 [Swift 平台桥](../../../../apps/desktop/Sources/AppServices/PlatformBridge/platform-bridge.md)。

协议合约见 [protocol](../protocol/protocol.md)，持久化恢复见 [thread-store](../../../thread-store/thread-store.md)。
