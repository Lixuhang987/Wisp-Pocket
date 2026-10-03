# src

`packages/core/src` 实现 Conversation Runtime 的纯逻辑和端口。

## 直接子节点

- [thread/thread.md](/Users/mu9/proj/handAgent/packages/core/src/thread/thread.md)：Thread 注册表与生命周期。
- [adapters/adapters.md](/Users/mu9/proj/handAgent/packages/core/src/adapters/adapters.md)：文件系统、Provider 与 MCP 适配。
- [protocol/protocol.md](/Users/mu9/proj/handAgent/packages/core/src/protocol/protocol.md)：跨进程 DTO 与消息族。
- [runtime/runtime.md](/Users/mu9/proj/handAgent/packages/core/src/runtime/runtime.md)：Turn、消息与 LLM/Tool 循环。
- [llm/llm.md](/Users/mu9/proj/handAgent/packages/core/src/llm/llm.md)：provider-neutral LLM 接口与适配。
- [tools/tools.md](/Users/mu9/proj/handAgent/packages/core/src/tools/tools.md)：Tool、registry、builtin 与 Dynamic Tool adapter。
- [workspace/workspace.md](./workspace/workspace.md)：稳定项目身份、实际目录唯一性与基础 Pet 创建端口。
- [pet/pet.md](./pet/pet.md)：Pet 身份、角色配置与固定 Workspace 引用。
- [permission/permission.md](/Users/mu9/proj/handAgent/packages/core/src/permission/permission.md)：Permission policy 与记忆。
- [conversation/conversation.md](/Users/mu9/proj/handAgent/packages/core/src/conversation/conversation.md)：UI conversation projection。
- [blob/blob.md](/Users/mu9/proj/handAgent/packages/core/src/blob/blob.md)：大内容存储端口。
- [config/config.md](/Users/mu9/proj/handAgent/packages/core/src/config/config.md)：模型设置解析。
- [logging/logging.md](/Users/mu9/proj/handAgent/packages/core/src/logging/logging.md)：网络日志端口与实现。
- [mcp/mcp.md](/Users/mu9/proj/handAgent/packages/core/src/mcp/mcp.md)：MCP client 与 Tool adapter。
- [selection/selection.md](/Users/mu9/proj/handAgent/packages/core/src/selection/selection.md)：文本选区归一化。

## 依赖规则

- runtime 可依赖 LLM、Tool、Permission 和 Blob 端口；这些基础模块不反向依赖 runtime 编排。
- protocol 只定义 DTO，不引用 UI、socket、数据库或 provider 实现。
- Tool 通过后端调用上下文取得所属 Workspace 文件根，写入边界与 Permission 分别校验；模型不能传身份参数重绑定。
- 具体组合、持久化和网络生命周期属于 apps/agent-server。
