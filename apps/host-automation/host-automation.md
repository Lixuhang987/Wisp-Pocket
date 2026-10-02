# host-automation

本目录实现 [Host Automation](./CONTEXT.md) 的业务模块。`HandAgentHostAutomation` 是链接进 Swift Host 的内部 Swift target；由宿主明确创建 Context History 与 Automation，业务复用依靠存储，不依赖独立常驻进程。

## 直接子节点

- [CONTEXT.md](./CONTEXT.md)：本上下文的规范术语。
- [Sources/sources.md](./Sources/sources.md)：业务模块、持久化和固定 macOS 边界。
- [Tests/tests.md](./Tests/tests.md)：真实业务存储、采样和流程执行用例。

## 边界

- Context History 拥有采集任务、采样状态与历史存取；Automation 拥有 Recording Session、Policy、Trace、Run 与修复数据。
- 历史目录保留为 `~/.spotAgent/context-history`，流程目录保留为 `~/.spotAgent/automation`。退出只停止任务；Automation 还可独立禁用，不删除现有历史和已保存流程。
- [Swift 平台桥](../desktop/Sources/AppServices/PlatformBridge/platform-bridge.md) 提供共享 macOS 能力及 Dynamic Tool 注册、分派；[宿主设置](../desktop/Sources/AppServices/AgentSettings/agent-settings.md) 持有 Automation 默认关闭的持久化开关；Context History 常驻采集，Node 读取历史不依赖此开关。
- 本目录不拥有 Thread 或 Turn；AgentTrigger 仍负责触发 `UserInput`，宿主历史由 Tool 按需读取。
- 修复接口接收明确提交的数据。失败只形成待处理 Repair Request，合入 Repair Patch 后仍需真实重跑，当前没有模型自主修复流程。

架构取舍见 [ADR 0003](../../docs/adr/0003-context-history-without-plugin-framework.md)；真实权限与桌面行为的验收从 [manual-qa](../../docs/manual-qa.md) 进入。
