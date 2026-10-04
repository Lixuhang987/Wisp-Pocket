# core tests

本目录验证跨平台业务与协议。主要用例使用真实 Runtime、Tool 与状态 owner，只在系统、模型网络或 Provider 传输边界使用可控替身；测试通过与实机可用分别记录。

## 直接子节点

- [llm/llm.md](./llm/llm.md)：模型适配、图片消费、能力检查与真实 API 集成。
- `runtime/`：Turn、工具循环与中断用例。
- `tools/`：通用 Tool 注册、Dynamic adapter、Web 和默认文件读取边界。
- `protocol/`：消息族与字段边界。
- `permission/`：权限规则与跨 Thread 决定。
- `blob/`、`logging/`：持久化与日志适配。
- `config/`、`selection/`：设置与选区归一化。
- `mcp/`：MCP 配置与传输。

Runtime 的既有用例验证 system section 保留在结果且重复请求不重复追加；持久恢复、小时阈值、项目规则替换/清除与中断写入由 [server 组合主路径](../../../apps/agent-server/tests/use-cases/use-cases.md) 验证，不在本目录重复建立 Thread/SQLite 状态。

跨目录回归通过 `bash ./scripts/test.sh`；模型真实端点的运行要求见 [API 集成测试](../../../docs/llm-api-integration.md)。
