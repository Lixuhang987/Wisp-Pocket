# thread

`thread/` 拥有 Conversation Runtime 的 Thread 生命周期。

## 直接子节点

- `Thread.ts`：单个 Thread 的历史、输入、Turn、中断、请求和关闭。
- `ThreadRegistry.ts`：加载、创建、删除和后端关闭的唯一入口。
- `ThreadRequests.ts`：Permission / Workspace 待答请求及超时。
- `ThreadTools.ts`：Thread 工具组合和懒激活。
- `types/`：Thread 历史、服务端口和请求类型。
- `utils/`：Thread 生命周期辅助函数。

## 边界

Thread 通过服务端口使用存储、模型和工具；外部不直接修改历史或运行状态。模型和工具等待不阻塞中断、回执或删除。

- 正式历史、执行状态和待答请求生命周期只在 Thread 内修改；UI 保留这些事实的展示投影，不承担回答有效性与运行控制。
- Registry 统一创建、加载、恢复、删除和关闭。冷加载读取存储，运行中 snapshot 从 Thread 的内存历史派生。
- `ThreadStorage` 是实际存储需求的端口；[agent-server 持久化适配](../../../../apps/agent-server/src/thread/thread.md) 提供输入转换、增量写入和恢复，core 不直接依赖 SQLite 或连接身份。
- 输入保存后才确认并执行，最终结果保存后才发布成功；保存失败暂停后续执行，恢复以已保存历史为准。关闭或删除后的晚到结果不能重新写入 Thread。
