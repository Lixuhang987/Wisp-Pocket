# src

本目录拥有同一 SQLite 中的 Workspace 配置、Thread rollout 与派生视图。调用方通过公开 API 读写，不直接操作表。

## 直接子节点

- `ThreadStore.ts`：schema、Thread 生命周期、历史查询与派生恢复数据。
- `CurrentThread.ts`：单个 open Thread 的顺序追加与持久化确认。
- `types/`：rollout、元数据、审计和结果类型。
- `index.ts`：包导出。

## 持久化合约

- rollout 使用 session_meta、response_item、turn_context、event_msg；compacted 仍是预留类型。正常执行只追加本轮产物，避免覆盖执行期间新接收的输入。
- 第一次 persist 创建数据库 Thread，resume 从最大 sequence 后继续追加；同一 Thread 的写入在包内串行化。
- User response item 保存稳定输入 ID、结构化 Input Item；图片使用 Blob 引用，`file_reference` 只保存原路径元数据。图片副本生命周期属于 BlobStore，原文件生命周期由用户管理，数据库不复制原始 bytes。
- 以用户输入 ID 与 `turn.started.turnId` 区分已接收和已开始；未匹配开始事件的输入派生为 pendingInputs。没有开始事件的输入不能误报为重启丢失中的执行。
- 未闭合 Turn 的修复与可见失败说明由 [agent-server 持久化 adapter](../../../apps/agent-server/src/thread/thread.md)追加，恢复数据交给 [core Thread](../../core/src/thread/thread.md)处理。

- Workspace 与 Thread 同库；实际项目目录有唯一约束，Workspace 创建与 commandId 去重在同一事务内完成。前端 Pet 数据与图片不进入此数据库。
- Thread 元数据只保存固定 workspaceId，rootPath 从 Workspace 派生；普通角色提示随 UserInput 保存，不存在结构化伙伴身份或角色快照。
- 旧开发 schema 明确拒绝打开，不做自动迁移或数据清除；新数据库使用 Workspace 引用和 Thread 单归属 schema。

- 删除 Thread 时在同一 SQLite 事务内保存 threadId 墓碑并删除历史，墓碑不随级联删除清除。创建身份由稳定 commandId 派生，同身份重试在进程重建后仍返回 not_found；新的 commandId 可正常创建。
