# Issue #3 状态所有权实施记录

本文保留 [Issue #3](https://github.com/Lixuhang987/Wisp-Pocket/issues/3) 的原实施决策与验证边界。后续合入 main 时，输入排队采用 Issue #1 已落地的后端持久队列；当前架构事实见 owning 模块指南，本次合并结果见 [合并计划](./2026-09-13-issue-4-main-merge.md)。

## 决策

- 分支从 `main` 的 `a919901` 创建，包含 #2 的 `ad9336d`；本轮评估基于实际 Thread 所有权实现。
- 保留 store 公共入口，分别归属事实投影、输入交接和界面偏好；首轮关联只登记一处，输入控制器承接首轮创建/加载/提交顺序。职责见 [store](../../../apps/thread-window-web/src/store/store.md) 与 [thread](../../../apps/thread-window-web/src/thread/thread.md)。
- 当前 Composer 立即提交，等待执行由后端持久队列承担，socket FIFO 仅处理连接就绪前的传输。草稿与组件状态维持既有保存范围；ThreadWindow 后台新建 Thread 改变选中的既有缺陷另记。
- 原 Issue #3 实施阶段后端不改代码：Router / Publisher 的连接隔离与 Persistence 的输入转换、增量、恢复和句柄管理均有实际职责；保留理由见 [规格入口](../../issue-3-design.md)。
- 提交前验证发现两项 Swift 测试混淆了 PromptPanel 隐藏与后续窗口回执的观察阶段；main 同样复现，仅校正测试断言，Swift 生产行为保持不变。

## 验证边界

- 通过公开 store action、真实输入控制器与 socket 的传输回调验证关联、派发顺序、消息和请求投影；后端继续使用现有协议生命周期与真实 SQLite 测试。
- 测试不依赖私有集合、类名或文件布局；架构审核另外核对状态来源、修改责任和清理条件。
- 自动验证与审核结果只在 [规格入口](../../issue-3-design.md) 记录；尚未执行的桌面实机回归见 [manual-qa](../../manual-qa.md)。
