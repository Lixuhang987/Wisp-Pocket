# Conversation Runtime

Conversation Runtime 描述用户与 Agent 的持久交互，以及一次输入如何形成有边界的执行过程。

Thread 与 Workspace 归属按 [ADR 0007](../../docs/adr/0007-frontend-pet-workspace-threads.md) 实现；Pet 与角色提示的术语归 [Desktop Experience](../../apps/desktop/CONTEXT.md)。

## Interaction

**Thread**:
归属一个 Workspace 的可持久化用户交互，包含输入、Turn 和历史，其归属不随前端伙伴的工作区选择改变。
_Avoid_: Session、Conversation、Chat（指代持久交互单元时）

**Turn**:
Thread 内由一次 `UserInput` 触发的处理周期，最终完成、中断或失败。
_Avoid_: Response、Run（指代 Thread 内处理周期时）

**UserInput**:
用户一次主动提交的结构化输入，由一个或多个 Input Item 组成。
_Avoid_: Prompt（指代完整结构化提交时）

**Input Item**:
`UserInput` 中一个有类型的内容单元，例如文本、图片、PDF、Append Prompt 或文本选区。
_Avoid_: Attachment（泛指所有 Input Item 时）

**Op**:
投递给 Agent 的操作，可携带 `UserInput`、中断或内部请求回执。
_Avoid_: ThreadCommand

## Capabilities

**Tool**:
提供给模型调用的一项具名能力，具有明确的输入、输出和错误语义。
_Avoid_: Action、Plugin

**Dynamic Tool**:
在运行时由外部 Dynamic Tool Provider 注册并执行的 Tool。
_Avoid_: Host Tool、Plugin Tool（指代通用机制时）

**Dynamic Tool Provider**:
拥有一组 Dynamic Tool 执行权的连接端；它不同于提供模型服务的 LLM provider。
_Avoid_: LLM Provider、Tool Registry

**Workspace**:
具有独立身份、固定项目目录和项目指令的工作上下文；同一实际目录复用同一个 Workspace，项目指令来自根目录 AGENTS.md。
_Avoid_: Pet、Profile（指代项目上下文时）

**Permission**:
对 Tool 调用的允许或拒绝决定，可仅用于本次调用，或按 Tool 名称持久记忆；持久决定不区分调用参数。
_Avoid_: Confirmation、Approval（指代协议概念时）

## Protocol

**ThreadCommand**:
客户端发起的 Thread 生命周期、查询或 Op 提交请求。
_Avoid_: Op、Notification

**ThreadNotification**:
服务端发布的 Thread 结果或状态变化，不要求客户端回执。
_Avoid_: Event（指代跨进程消息族时）

**ServerRequest**:
服务端提出且必须等待交互界面决定的问题。
_Avoid_: ThreadNotification

**ClientResponse**:
交互界面对某个 `ServerRequest` 的匹配回执。
_Avoid_: Op（指代跨进程消息时）

**Agent Activity**:
由 Thread 状态派生的轻量展示投影，不包含完整消息历史。
_Avoid_: Thread State、ThreadNotification
