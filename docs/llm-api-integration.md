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

测试最多请求三轮：普通 assistant 回复、返回测试专用 `file.write` Tool call、带 Tool result 的最终回复。此工具只是 Provider 协议夹具，不执行内置写入，也不代表主 Agent 的生产目录。

## 产物

默认目录是 `.cache/llm-api-integration/latest/`；`HANDAGENT_LLM_ARTIFACT_DIR` 可覆盖。

- `artifact.json`：场景、配置摘要、Turn 文件和脱敏网络日志索引；失败摘要写入 `error`。
- `network.jsonl`：provider request/response body；不记录 header，密钥和 token 字段必须脱敏。
- `turn-*-*.input.json`：仓内 `AgentMessage[]` 与相关 Tool 定义。
- `turn-*-*.completion.json`：归一化 `LLMCompletion`，分别覆盖文本、Tool call 和最终回复。

端点超时或报错时仍写出已取得的产物，但测试返回失败。

## Mock 数据边界

`MockLLMClient` 的唯一真相是 `packages/core/src/adapters/providers/MockLLMClient.ts` 中的 `mockLLMScenarios`，不维护第二套 fixture。

- 新场景参考 `turn-*.completion.json` 的 `LLMCompletion`，不要绑定 provider 原始 response。
- provider 原始数据只用于 adapter 排障；AI SDK 私有字段不是稳定契约。
- Tool call mock 保留 `id`、`name`、`arguments`；后续回复使用空 `toolCalls` 和 assistant 文本。

日常桌面 QA 使用 mock package 替换主 Agent 模型端点：

```bash
bash ./scripts/package-app.sh --mock-llm
open "dist/Wisp Pocket.app"
```

mock 只替换主 Agent 模型：`[mock:assistant-ok]`、`[mock:history-index]`、`[mock:file-read]` 与 `[mock:user-ask]` 可走当前默认入口；`[mock:codex-write]` 和 `[mock:permission-write]` 会调用实际 Codex CLI、产生文件修改并遵守 Wisp Permission，仍要求安装/登录，不属于离线执行替身。旧 file-write 触发词已替换。宿主/MCP 触发词仅保留供专项 adapter 夹具使用，生产目录不公开对应工具，不能继续按旧步骤验收。固定最终 mock 文本不能证明 Codex success 或文件内容，须核对工具结果与实际磁盘。

## 默认测试

`bash ./scripts/test.sh` 会跳过真实网络测试，但覆盖 artifact 写入和脱敏：

```bash
pnpm exec vitest run packages/core/tests/llm/llm-integration-artifacts.test.ts
```

该测试必须证明产物可写、密钥字段已脱敏，并保持 `LLMCompletion` 结构。
