# thread-store

`@handagent/thread-store` 持久化 [Conversation Runtime](/Users/mu9/proj/handAgent/packages/core/CONTEXT.md) 的 Thread rollout，并为 agent-server 派生历史视图。它不定义协议、驱动 Turn 或实现 UI。

## 直接子节点

- `src/types.ts`：rollout、元数据、审计和结果类型。
- `src/ThreadStore.ts`：SQLite schema、Thread 生命周期与派生视图。
- `src/CurrentThread.ts`：当前 open Thread 的顺序写入语义。
- `src/index.ts`：包导出。
- `tests/`：真实临时 SQLite 用例。

## 持久化边界

- 生产数据库由 agent-server 注入，当前是 `~/.spotAgent/threads.sqlite`。
- rollout 是 append-only 序列：`session_meta`、`response_item`、`turn_context`、`event_msg`；`compacted` 仅为预留类型。
- 第一次 persist 才创建数据库 Thread；resume 从最大 sequence 之后继续追加。
- 同一 Thread 的写入在包内串行化。调用方使用派生 API，不直接查询 SQLite 表。
- 跨进程 DTO 与 runtime message 来自 core；本包只定义持久化表达。
