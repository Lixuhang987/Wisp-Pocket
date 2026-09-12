# thread

`thread/` 拥有 Conversation Runtime 的 Thread 生命周期。

## 直接文件

- `Thread.ts`：单个 Thread 的历史、输入、Turn、中断、请求和关闭。
- `ThreadRegistry.ts`：加载、创建、删除和后端关闭的唯一入口。
- `ThreadRequests.ts`：Permission / Workspace 待答请求及超时。
- `ThreadTools.ts`：Thread 工具组合和懒激活。
- `types/`：Thread 历史、服务端口和请求类型。
- `utils/`：Thread 生命周期辅助函数。

## 边界

Thread 通过服务端口使用存储、模型和工具；外部不直接修改历史或运行状态。模型和工具等待不阻塞中断、回执或删除。
