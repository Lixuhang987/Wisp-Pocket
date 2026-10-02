# providers

本目录实现 [LLMClient](../../llm/llm.md) 的具体 Provider 与消息适配。Runtime 不依赖 SDK，调用方传入设置、BlobStore 与 AbortSignal。

## 直接文件

- `LLMClientFactory.ts`：OpenAI-compatible / Anthropic 组合与能力约束。
- `VercelClient.ts`：OpenAI-compatible 的 Responses、Chat、Completion 调用与流适配。
- `VercelAdapters.ts`：消息、工具名、图片与 SSE 的协议转换。
- `OpenAIConfig.ts`：OpenAI-compatible 凭据与端点解析。
- `MockLLMClient.ts`：可控 QA 场景与归一化返回。

## 消息与图片

- user image 的 Blob 引用在模型调用前通过传入的 BlobStore 展开，持久化格式与 Provider 输入格式保持分离。
- 普通 Tool 的 JSON envelope 含 `success` 和 `contentItems`，Dynamic Tool 另含 `callId`；图片转换保留 envelope 元数据与文本说明，把 `inputImage` 变成模型真正可消费的图片，不能只发送 base64 JSON 文本。
- Responses / Anthropic 使用原生 Tool 图片内容。Chat 不支持相同形态，图片与工具名、toolCallId、原始说明放在本组全部 tool results 之后的 user 图片消息里，保持每个 assistant tool-call 与 tool-result 的配对顺序。
- 多模态检测同时检查 user 输入与 Tool 返回。Completion 不支持图片，应在 Provider 请求前明确失败；能力降级不得静默丢掉工具证据。
- 普通文本与 JSON Tool 结果保持原有表达。图片 URL 仅接受声明支持的 image data URL 或 HTTP(S)，错误必须可定位。
- 失败 Tool 的执行状态和可读证据由 [Dynamic Tool adapter](../../tools/tools.md) 保留；图片转换不把失败解释成成功。

## Provider 合约

- 内部 Tool 名使用点号；请求 SDK 时转换成允许的名称并保存反查，转换后冲突必须失败。响应恢复原 Tool 名，Runtime 无需了解 Provider 命名限制。
- Factory 对不支持图片的配置提前报错，对不支持 Tool calling 的配置传空 tools；当前 Completion 两者均不支持。
- OpenAI-compatible fetch 先处理 SSE，再交给 SDK：以 SSE 空行边界解析，合并被拆开的 event/空 data 元数据，拆分单个 data 中的多行 JSON。不能按普通换行切流。
- Provider 流错误直接抛出；流结束但没有文本或 Tool call 时也必须失败，不能保存空 assistant 成功结果。
- Anthropic 端点使用 settings 的 baseUrl；凭据优先 settings apiKey，未提供时可读 `ANTHROPIC_AUTH_TOKEN`。配置缓存与热加载归 agent-server。
- 网络日志通过显式 NetworkLogger 注入；日志与真实 API 集成产物可能含请求内容，路径与运行方式见 [API 集成测试](../../../../../docs/llm-api-integration.md)。

## 验证边界

- 图片用例保留普通 Tool / DynamicToolAdapter、Runtime、Provider client 与 SDK，使用已知 Tool 响应和可控首轮模型决策，捕获最终网络请求，检查成功/失败状态、多个工具关联及解码后的像素。真实宿主响应由 desktop 的业务用例与实机验收补齐，入口见 [LLM 测试](../../../tests/llm/llm.md)。
- `MockLLMClient` 的固定场景保存在 `mockLLMScenarios`，覆盖 UI/协议闭环；mock 回复不能证明真实模型服务接受图片。
- 真实 API 验证与实机 Tool 证据分别记录；协议请求构造通过不等于远端模型已完成推理。
