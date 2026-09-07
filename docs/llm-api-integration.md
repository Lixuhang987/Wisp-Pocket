# LLM 真实 API 集成测试

该测试验证 `VercelClient` 与真实 OpenAI-compatible 端点的适配，并保存脱敏后的 provider 交互与仓内 `LLMCompletion`。它需要显式启用，不进入日常默认测试。

## 运行

前提是 `~/.spotAgent/settings.json` 已配置有效模型、API key、base URL 与 API 类型：

```bash
pnpm run test:llm:integration
```

等价底层命令：

```bash
HANDAGENT_LLM_INTEGRATION=1 \
pnpm exec vitest run packages/core/tests/llm/vercel-client.integration.test.ts
```

临时覆盖设置时使用 `HANDAGENT_LLM_MODEL`、`HANDAGENT_LLM_API`、`HANDAGENT_LLM_BASE_URL` 和 `HANDAGENT_LLM_API_KEY`。单次请求超时由 `HANDAGENT_LLM_REQUEST_TIMEOUT_MS` 控制。

测试最多请求三轮：普通 assistant 回复、返回 `file.write` Tool call、带 Tool result 的最终回复。

## 产物

默认目录是 `.cache/llm-api-integration/latest/`；`HANDAGENT_LLM_ARTIFACT_DIR` 可覆盖。

- `artifact.json`：场景、配置摘要、Turn 文件和脱敏网络日志索引；失败摘要写入 `error`。
- `network.jsonl`：provider request/response body；不记录 header，密钥和 token 字段必须脱敏。
- `turn-*-*.input.json`：仓内 `AgentMessage[]` 与相关 Tool 定义。
- `turn-*-*.completion.json`：归一化 `LLMCompletion`，分别覆盖文本、Tool call 和最终回复。

端点超时或报错时仍写出已取得的产物，但测试返回失败。

## Mock 数据边界

`MockLLMClient` 的唯一真相是 `packages/core/src/llm/MockLLMClient.ts` 中的 `mockLLMScenarios`，不维护第二套 fixture。

- 新场景参考 `turn-*.completion.json` 的 `LLMCompletion`，不要绑定 provider 原始 response。
- provider 原始数据只用于 adapter 排障；AI SDK 私有字段不是稳定契约。
- Tool call mock 保留 `id`、`name`、`arguments`；后续回复使用空 `toolCalls` 和 assistant 文本。

日常桌面 QA 使用 mock package，不调用真实端点：

```bash
bash ./scripts/package-app.sh --mock-llm
open "dist/Wisp Pocket.app"
```

## 默认测试

`bash ./scripts/test.sh` 会跳过真实网络测试，但覆盖 artifact 写入和脱敏：

```bash
pnpm exec vitest run packages/core/tests/llm/llm-integration-artifacts.test.ts
```

该测试必须证明产物可写、密钥字段已脱敏，并保持 `LLMCompletion` 结构。
