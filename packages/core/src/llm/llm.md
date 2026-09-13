# llm

本目录定义 Runtime 使用的 LLM 端口；Provider SDK、协议适配与网络实现位于 [adapters/providers](../adapters/providers/providers.md)。

## 直接文件

- `LLMClient.ts`：`LLMClient`、归一化流事件、完成结果，以及流/完成结果聚合 helper。

## 合约

- Runtime 主路径消费 `stream()` 的 `text_delta`、`tool_call` 和 `message_end`。接口层不依赖 OpenAI、Anthropic 或任何具体 SDK。
- 测试与旧调用方可通过 `complete()` 接口接入，helper 负责与流式路径互通；不要在 Runtime 内按 Provider 类型分支。
- 中断使用显式 `AbortSignal`；BlobStore 通过调用参数传入，由 Provider 适配层在需要图片 bytes 时读取。
- AgentMessage 保存 Runtime 表达；Input Item 负责用户输入协议的 round-trip，Provider 消费格式只在 adapter 中生成。
- 工具结果中的图片、错误与 callId 关联由 [Dynamic Tool adapter](../tools/tools.md) 和 Provider 适配共同保留，不应丢成纯 base64 文本。

## 相邻所有权

- [Runtime](../runtime/runtime.md)：LLM/Tool 循环与消息生命周期。
- [Provider adapters](../adapters/providers/providers.md)：模型能力差异、图片转换、工具名映射与流错误。
- [配置](../config/config.md)：模型设置结构；生产热加载归 [agent-server settings](../../../../apps/agent-server/src/settings/settings.md)。
