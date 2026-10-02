# adapters

`adapters/` 保存依赖操作系统、文件系统、Provider 或 MCP transport 的实现。core Thread 只依赖端口，agent-server 负责组合这些适配器。

## 直接子节点

- `filesystem/`：Blob、Permission 与日志文件实现。
- [providers/providers.md](./providers/providers.md)：LLM Provider、图片/工具结果适配与 Mock 实现。
- `mcp/`：MCP transport client 实现。
