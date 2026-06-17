# thread-store

## 目录职责

`packages/thread-store` 是 `@handagent/thread-store` workspace 包，负责 Node 侧 thread 持久化。它提供具体 `ThreadStore` class、`CurrentThread` writer 语义、SQLite schema 和 rollout item 类型。

本包不定义 WebSocket 协议，不驱动 runtime，也不实现 UI。跨进程 DTO 仍来自 `@handagent/core/protocol/*`，runtime 消息类型仍来自 `@handagent/core/runtime/*`。

## 文件

| 文件 | 职责 |
|------|------|
| `src/types.ts` | `ThreadStoreResult`、`RolloutItem`、`SessionMeta`、`PersistedThread`、`ThreadSummary`、`ThreadAuditEvent` 等类型 |
| `src/ThreadStore.ts` | SQLite schema、lazy create、append/persist/load/resume/shutdown/discard/list/delete、兼容派生视图 |
| `src/CurrentThread.ts` | 当前 open thread 的语义层，封装 create/resume、append、persist、shutdown、discard |
| `src/index.ts` | 包导出入口 |
| `tests/` | `thread-store-use-cases.test.ts` 使用真实 SQLite 临时库覆盖 create/append/persist/resume/shutdown/discard、CurrentThread 并发 append、package exports 和派生视图 |

## 持久化模型

生产数据库路径由 agent-server 组合根传入，当前为 `~/.spotAgent/threads.sqlite`。

`createThread()` 只打开 live writer，不立即写入 SQLite。第一次 `persistThread()` 在事务内插入 `threads` 行、sequence `0` 的 `session_meta` item，以及此前排队的 rollout items。`resumeThread()` 只允许打开已存在的持久 thread，并从 `MAX(sequence) + 1` 继续追加。

当前 rollout item：

- `session_meta`：thread 元数据，包含 `threadSource`、originator、workspaceId 等。
- `response_item`：当前项目的 `AgentMessage`，用于派生 UI 消息和 runtime 历史。
- `turn_context`：turn 状态与 `ThreadAuditEvent[]`，用于保留 tool/error/permission 审计。
- `event_msg`：已经推送给 ThreadWindow 的 `ThreadNotification`，用于保留运行时通知序列。
- `compacted`：预留占位，本轮只保存类型。

## 边界规则

- `ThreadStore` 是具体 class，不在 core 中定义同名 interface。
- public 方法返回 `ThreadStoreResult<T>`；`createThread()`、`shutdownThread()`、`discardThread()` 等无 payload 成功值使用 `ThreadStoreResult<void>`。
- 同一 thread 的写操作通过包内 per-thread queue 串行化。
- `flushThread()` 暂保留 public 方法并返回 `not_implemented`。
- agent-server 如需 UI 兼容视图，应使用 `getPersistedThread()`、`listThreads()` 或 `loadHistory()` 派生，不直接读取 SQLite 表。
