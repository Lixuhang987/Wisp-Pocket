# core

`@handagent/core` 定义 [Conversation Runtime](/Users/mu9/proj/handAgent/packages/core/CONTEXT.md) 的跨平台类型与纯逻辑，不拥有 UI、WebSocket server、数据库或 macOS 能力。

## 直接子节点

- [CONTEXT.md](/Users/mu9/proj/handAgent/packages/core/CONTEXT.md)：Conversation Runtime glossary。
- [src/src.md](/Users/mu9/proj/handAgent/packages/core/src/src.md)：源码模块索引与依赖方向。
- [tests/tests.md](./tests/tests.md)：Runtime、LLM、Tool、协议、Workspace 与 Permission 用例测试。
- `package.json`：`@handagent/core` exports 与依赖声明。

## 边界

- core 可以依赖 Node 标准库和已声明的跨平台运行依赖，但不依赖 AppKit、Electron 或 DOM。
- core 定义 DTO 和端口；agent-server 负责连接、组合、持久化与平台 adapter。
- Dynamic Tool 只在 core 定义协议和 adapter，执行权属于外部 Provider。
- `@handagent/thread-store` 可以依赖 core；core 不反向依赖持久化包。
