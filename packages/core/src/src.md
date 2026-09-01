# src

`packages/core/src` 实现 Conversation Runtime 的纯逻辑和端口。

## 直接子节点

- [protocol/protocol.md](/Users/mu9/proj/handAgent/packages/core/src/protocol/protocol.md)：跨进程 DTO 与消息族。
- [runtime/runtime.md](/Users/mu9/proj/handAgent/packages/core/src/runtime/runtime.md)：Turn、消息与 LLM/Tool 循环。
- [llm/llm.md](/Users/mu9/proj/handAgent/packages/core/src/llm/llm.md)：provider-neutral LLM 接口与适配。
- [tools/tools.md](/Users/mu9/proj/handAgent/packages/core/src/tools/tools.md)：Tool、registry、builtin 与 Dynamic Tool adapter。
- [workspace/workspace.md](/Users/mu9/proj/handAgent/packages/core/src/workspace/workspace.md)：Workspace registry 与文件边界。
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
- Tool 通过 Workspace 与 Permission 端口获得边界，不直接读取宿主状态。
- 具体组合、持久化和网络生命周期属于 apps/agent-server。
