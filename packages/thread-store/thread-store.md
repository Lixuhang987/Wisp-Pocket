# thread-store

`@handagent/thread-store` 持久化 [Conversation Runtime](../core/CONTEXT.md) 的 Thread rollout，并派生历史视图。它不定义协议、驱动 Turn 或实现 UI。

## 直接子节点

- [src/src.md](./src/src.md)：SQLite rollout、顺序写入与 pending 输入恢复。
- `tests/`：真实临时 SQLite 用例。
- `package.json`：包导出与依赖。

生产数据库由 agent-server 注入，当前为 `~/.spotAgent/threads.sqlite`；跨进程 DTO 与运行消息类型来自 core。
