# thread-store

`@handagent/thread-store` 持久化 [Conversation Runtime](/Users/mu9/proj/handAgent/packages/core/CONTEXT.md) 的 Thread rollout，并为 agent-server 派生历史视图。它不定义协议、驱动 Turn 或实现 UI。

## 直接子节点

- `src/`：rollout 类型、SQLite schema、派生视图、顺序写入句柄与包导出。
- `tests/`：真实临时 SQLite 用例。

## 持久化边界

- 生产数据库由 agent-server 注入，当前是 `~/.spotAgent/threads.sqlite`。
- rollout 是 append-only 序列：`session_meta`、`response_item`、`turn_context`、`event_msg`；`compacted` 仅为预留类型。
- 第一次 persist 才创建数据库 Thread；resume 从最大 sequence 之后继续追加。
- 同一 Thread 的写入在包内串行化。调用方使用派生 API，不直接查询 SQLite 表。
- 跨进程 DTO 与 runtime message 来自 core；本包只定义持久化表达。
- [agent-server 持久化适配](../../apps/agent-server/src/thread/thread.md) 承担输入转换、运行增量与残缺 Turn 恢复，并实现 core 的 `ThreadStorage` 端口；底层 ThreadStore 不可直接替代这些语义。
