# src

本目录拥有 SQLite Thread rollout 与派生视图。调用方通过公开 API 读写，不直接操作表。

## 直接子节点

- `ThreadStore.ts`：schema、Thread 生命周期、历史查询与派生恢复数据。
- `CurrentThread.ts`：单个 open Thread 的顺序追加与持久化确认。
- `types/`：rollout、元数据、审计和结果类型。
- `index.ts`：包导出。

## 持久化合约

- rollout 使用 session_meta、response_item、turn_context、event_msg；compacted 仍是预留类型。正常执行只追加本轮产物，避免覆盖执行期间新接收的输入。
- 第一次 persist 创建数据库 Thread，resume 从最大 sequence 后继续追加；同一 Thread 的写入在包内串行化。
- User response item 保存稳定输入 ID、结构化 Input Item 和输入模式；图片/PDF 使用 Blob 引用。附件文件生命周期属于 BlobStore，数据库不复制原始 bytes。
- 以用户输入 ID 与 `turn.started.turnId` 区分已接收和已开始；未匹配开始事件的输入派生为 pendingInputs。没有开始事件的输入不能误报为重启丢失中的执行。
- 未闭合 Turn 的修复与可见失败说明由 [agent-server 持久化 adapter](../../../apps/agent-server/src/thread/thread.md)追加，恢复数据交给 [core Thread](../../core/src/thread/thread.md)处理。
