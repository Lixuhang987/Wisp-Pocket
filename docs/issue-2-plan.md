# Issue #2 实施计划

规格以 [GitHub issue #2](https://github.com/Lixuhang987/Wisp-Pocket/issues/2) 为准，审查基点为 `cd51cc6`。

## 用例与契约

- `thread.start/resume` → core ThreadRegistry 唯一创建/加载入口 → 存储恢复 → Thread 持有历史、工具、runtime、请求；并发加载共享同一 Promise，空闲实例保留。
- `op.submit(user_input)` → Thread 短操作队列 → 输入和确认通知持久化 → 内存历史更新 → 启动执行。运行期间的新输入保持排队，在当前模型工具循环完成后消费。
- Thread 持有运行状态和取消信号；模型/工具等待在短操作队列之外。中断及 ClientResponse 可直接取消/唤醒当前等待。
- runtime 继续负责模型工具循环；Thread 将 runtime 输出转换为历史并保存，保存完成后发布成功完成。流式通知可提前输出。存储失败清空待执行队列并标记 failed；resume 重新载入已确认历史后恢复。
- 删除入口先关闭 Thread、取消待答请求、隔离晚到结果，等已开始写入完成后删除存储，再移出注册表。存储只恢复已存在记录；关闭后端有界等待并释放共享 MCP、Provider 和 SQLite。
- 权限 once 不记忆；always 文件格式 version 2，仅以完整 toolName 标识规则。Web 提交与 Swift 读取、撤销同步；旧 version 1 不提升授权。

## 核心数据与依赖

- core `thread/types` 定义 Thread 存储端口、加载数据、执行依赖和状态；具体 SQLite 实现归 thread-store，协议翻译继续由 agent-server 提供。
- ThreadRegistry 持有唯一 loaded/loading 集合；Thread 独占内存历史、Turn、输入、待答请求和工具组合。共享配置、MCP、Workspace、Permission、Blob 通过实际端口注入。
- 纯辅助函数归各 owning 模块的 utils；类型归 types。移除生产外第二套 Agent owner。

## TODO

- [x] 主 checkout 脚本建立 worktree、CodeGraph 初始化及 TypeScript/Web、Swift build 基线。
- [ ] 统一 Thread 生命周期、历史、故障恢复、请求和工具状态；精简 server 路由及装配。
- [ ] 同步永久权限协议、后端、Web 和 Swift。
- [ ] 复用并调整已有协议主路径、runtime、SQLite、权限和界面测试；补充连接断开继续执行、保存失败暂停、删除晚到隔离等关键公开行为。依用户指示不为纯移动或内部拆分另写测试。
- [ ] 完整 TypeScript/Web/server/core、Swift test/build 检查。
- [ ] 独立 Standards/Spec 代码审查；独立无上下文文档审核、DAG 与逐层文档更新。
- [ ] 更新 manual-qa，移除已完成 TODO，提交。
