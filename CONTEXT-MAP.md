# Context Map

Wisp Pocket 由三个领域上下文组成。术语只在一个上下文中定义；适配器文档引用这些术语，不重复解释。

## Contexts

- [Conversation Runtime](./packages/core/CONTEXT.md)：定义 Thread、Turn、输入、协议消息族、Tool、Workspace、角色提示快照与 Permission。
- [Desktop Experience](./apps/desktop/CONTEXT.md)：定义 Pet、用户入口、常驻交互界面、附件、Append Prompt 与 AgentTrigger。

Pet / Thread 的词表已按 [ADR 0007](./docs/adr/0007-frontend-pet-workspace-threads.md) 记录确认中的目标模型，尚未实现；当前代码仍采用 [ADR 0006](./docs/adr/0006-workspace-pet-separation.md) 的后端 Pet 模型。
- [Host Automation](./apps/host-automation/CONTEXT.md)：定义宿主能力、Context History、Automation 及其证据与修复数据。

## Relationships

- **Desktop Experience → Conversation Runtime**：提交 `UserInput`，展示 Thread 状态，并承接需要用户决定的请求。
- **Desktop Experience → Host Automation**：直接组合两个内置业务模块，保存启用选择，提供共享 macOS 能力，并注册 Dynamic Tool。
- **Host Automation → Conversation Runtime**：Swift 通过 Dynamic Tool 提供实时宿主和 Automation 能力，agent-server 普通工具读取已保存的 Context History；Host Automation 不拥有 Thread。

## Adapters

- `apps/agent-server` 组合 Conversation Runtime、持久化和跨进程连接。
- `apps/electron-shell` 承载 Desktop Experience 的常驻界面并监督 agent-server。
- `apps/thread-window-web` 呈现 Thread；`packages/thread-store` 持久化 Thread rollout。它们消费上述术语，不建立新的领域词表。
