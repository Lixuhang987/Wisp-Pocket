# Context Map

Wisp Pocket 由三个领域上下文组成。术语只在一个上下文中定义；适配器文档引用这些术语，不重复解释。

## Contexts

- [Conversation Runtime](./packages/core/CONTEXT.md)：定义 Thread、Turn、输入、协议消息族、Tool、Workspace 与 Permission。
- [Desktop Experience](./apps/desktop/CONTEXT.md)：定义用户入口、常驻交互界面、附件、Append Prompt 与 AgentTrigger。
- [Host Automation](./apps/builtin-plugins/CONTEXT.md)：定义 Plugin、宿主原子能力、Context History 与可修复 Automation。

## Relationships

- **Desktop Experience → Conversation Runtime**：提交 `UserInput`，展示 Thread 状态，并承接需要用户决定的请求。
- **Desktop Experience → Host Automation**：安装、启停 Plugin，并把其能力注册为 Dynamic Tool。
- **Host Automation → Conversation Runtime**：通过 Dynamic Tool 提供宿主读取和操作能力，不直接拥有 Thread。

## Adapters

- `apps/agent-server` 组合 Conversation Runtime、持久化和跨进程连接。
- `apps/electron-shell` 承载 Desktop Experience 的常驻界面并监督 agent-server。
- `apps/thread-window-web` 呈现 Thread；`packages/thread-store` 持久化 Thread rollout。它们消费上述术语，不建立新的领域词表。
