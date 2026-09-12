# Issue #3 规格入口

[前后端状态所有权收敛与中间层削减 #3](https://github.com/Lixuhang987/Wisp-Pocket/issues/3) 是本次实施规格；前端职责拆分与后端保留核查已完成，最终检查与审核状态见下文。

## 阅读与基线

- 术语从 [Context Map](../CONTEXT-MAP.md) 路由；后端继续遵守 [ADR 0001](./adr/0001-backend-state-ownership.md) 的状态所有权与依赖边界。
- 本次从 `main` 的 `a919901` 新建 `codex/issue-3-state-ownership-main-20260913`，已确认包含 `ad9336d` 的 Issue #2 实现，且生产组合根将 `ThreadPersistence` 注入 core 的现有 `ThreadStorage` 端口。
- 本地不再维护平行的规格正文；后续修改规格时同步核对 Issue 与相关模块文档。

## 后端核查结论

- `ThreadCommandRouter` / `ThreadNotificationPublisher` 保留：承担连接订阅、定向 snapshot/list/delete/error 回复与回答资格检查；下沉到 Registry 会把连接身份引入 core。
- `ThreadPersistence` 保留：把结构化输入与 Blob 转为模型历史，按 base message count 追加运行增量，修复残缺 Turn，并管理 SQLite 顺序写入句柄；底层 ThreadStore 不能直接替代这些语义。
- `ThreadRegistry` / `Thread` 已分别拥有唯一加载/删除/关闭入口与历史、输入、Turn、请求生命周期。本次没有找到值得扩大职责边界实施的后端精简项，后端代码保持基线。

## 验证状态

- worktree 初始化、独立 CodeGraph 和分层基线完成；公开流程回归先于生产重构扩展。最终 `bash ./scripts/test.sh` 与真实 thread-store SQLite 回归通过。
- `bash ./scripts/swiftw test` 和 `bash ./scripts/swiftw build` 均通过。两个 AppCoordinatorTests 的原有失败已在 main 复现，本轮只校正提交后 PromptPanel 隐藏与 ThreadWindow ACK / close 的观察阶段，Swift 生产代码未变。
- Standards / Spec 双轴代码审核均为 0 findings，已覆盖 Swift 测试校正。独立文档审核已核对 Issue、修改代码与逐级指南，补齐三类前端状态的所有权、两类队列及后端适配边界；实施记录经 [计划目录](./medium-powers/plans/plans.md) 定位。
- [manual-qa](./manual-qa.md) 已列入草稿、页面重建、展开偏好、首轮、排队、历史、请求与连接回归；尚未做桌面实机验收。
- 已发现基线 `App` 收到任意 `thread.started` 都切换选中 Thread，作为既有选择缺陷记入 [bugs](./bugs.md)；按规格保留现有窗口选择规则，不在结构重构中修复。
