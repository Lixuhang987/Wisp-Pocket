# Issue #3 状态所有权实施记录

规格以 [Issue #3](https://github.com/Lixuhang987/Wisp-Pocket/issues/3) 为准；本文保留实施决策与验证边界，当前架构事实放在 owning 模块指南。

## 决策

- 分支从 `main` 的 `a919901` 创建，包含 #2 的 `ad9336d`；本轮评估基于实际 Thread 所有权实现。
- 保留 store 公共入口，分别归属事实投影、输入交接和界面偏好；首轮关联只登记一处，输入控制器承接现有首轮顺序与 Composer 派发时机。职责见 [store](../../../apps/thread-window-web/src/store/store.md) 与 [thread](../../../apps/thread-window-web/src/thread/thread.md)。
- Composer 等待队列与 socket FIFO 服务不同阶段，草稿和组件状态维持既有保存范围。后台新建 Thread 改变选中的既有缺陷另记，不借结构调整修复。
- 后端不改代码：Router / Publisher 的连接隔离与 Persistence 的输入转换、增量、恢复和句柄管理均有实际职责；保留理由见 [规格入口](../../issue-3-design.md)。
- 提交前验证发现两项 Swift 测试混淆了 PromptPanel 隐藏与后续窗口回执的观察阶段；main 同样复现，仅校正测试断言，Swift 生产行为保持不变。

## 验证边界

- 通过公开 store action、真实输入控制器与 socket 的传输回调验证关联、派发顺序、消息和请求投影；后端继续使用现有协议生命周期与真实 SQLite 测试。
- 测试不依赖私有集合、类名或文件布局；架构审核另外核对状态来源、修改责任和清理条件。
- 自动验证与审核结果只在 [规格入口](../../issue-3-design.md) 记录；尚未执行的桌面实机回归见 [manual-qa](../../manual-qa.md)。
