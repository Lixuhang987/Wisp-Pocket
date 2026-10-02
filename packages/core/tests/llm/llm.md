# LLM 测试

本目录从 LLM 端口与实际 SDK 请求边界验证 Provider 适配，不把模型服务的替身响应当成真实推理结论。

## 直接子节点

- `dynamic-tool-images.test.ts`：Dynamic/普通 Tool → Runtime → SDK 的成功图片消费及 Dynamic 失败证据，Responses / Anthropic 原生 Tool 图片与 Chat 配对顺序。
- `vercel-client.test.ts`：消息与用户图片适配、工具名、SSE 和流错误。
- `llm-client-factory.test.ts`、`openai-config.test.ts`：配置、凭据、能力限制与工厂边界。
- `mock-llm-client.test.ts`：日常 QA 固定场景。
- `vercel-client.integration.test.ts`、`llm-integration-artifacts.test.ts`：真实 API 请求与集成产物保存。
- `support/`：集成产物辅助。

## 证据边界

- 成功用例在同一批 Tool 调用中覆盖 Dynamic 与普通工具，失败用例保留 Dynamic 状态证据；图片用例只替换宿主响应、首轮模型决策与模型网络，保留真实工具分派、Runtime、Provider client 和 SDK；检查实际请求里的 callId、状态、元数据与解码像素，也验证原始 Runtime 消息未被重写。
- Swift Provider 采集/持久化由 desktop 与 host-automation 用例覆盖。完整实机需从真实桌面获得工具结果；真实远端接受与推理须另有 API 证据。
- Runtime 最终 assistant 消息的 `id` 必须与对应 `assistant_message_end.messageId` 一致；图片转换检查同时保留消息身份、工具响应和原始内容断言。
- 所有协议共享 [Provider adapters](../../src/adapters/providers/providers.md) 的转换规则；修改图片返回后同时检查失败、多个工具结果和 Completion 能力拒绝路径。
