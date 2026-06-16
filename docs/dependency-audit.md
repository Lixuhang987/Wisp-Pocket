## 依赖收敛审核报告

审核范围：`thread-window-web`、`electron-shell`、`agent-server`、`packages/core` 全部 TypeScript 源码。

审核目标：识别“已有依赖未使用”和“可以用现有 / 知名依赖替代的自造轮子”两类问题。

本轮处理原则：优先修复低风险、边界清晰、自动化测试可覆盖的收敛项；涉及 UI 交互、协议 SDK 大迁移、HTTP 静态服务替换或连接策略变化的项目，不混入本次补丁。

## 本轮已修复

| 审计项 | 处理结果 |
|------|------|
| `zod` 已在依赖中，多处仍手写 runtime 校验 | 已修复。`core/src/mcp/MCPConfig.ts`、`core/src/config/ModelSettings.ts`、`agent-server/src/server/server.ts`、`electron-shell/src/main/protocol/electronShellProtocol.ts` 改为 schema 校验；相关测试补齐缺 payload / 非法配置边界。 |
| `zustand` 的 `persist` 中间件未使用 | 已修复。`thread-window-web/src/store/threadWindowStore.ts` 使用 `zustand/middleware` 的 `persist + partialize` 持久化 `expandedWorkspaceIds`，并兼容旧版裸数组 localStorage 格式。 |
| `node:timers/promises` 内置未使用 | 已修复。`nodeAgentServerSupervisor` 改用 `setTimeout as sleep`。 |
| `AbortSignal.throwIfAborted()` 内置未使用 | 已修复。`LLMClient` 中断检查改用原生 `signal?.throwIfAborted()`，`MockLLMClient` 复用同一路径。 |
| `structuredClone()` 内置未使用 | 已修复。`MessageTranslator`、ThreadWindow `App`、`Composer` 和 store 的结构化输入 / op clone 改用 `structuredClone`；Immer draft 场景先通过 `current()` 取普通对象。 |
| `isNotFoundError` 多处重复 | 已修复。新增 `packages/core/src/utils/nodeErrors.ts`，agent-server settings 与 static server 复用。 |
| `toError` 多处重复 | 已修复。新增 `packages/core/src/utils/errors.ts`，LLM provider 分支复用。 |
| `stampsEqual` 多处重复 | 已修复。新增 `packages/core/src/utils/fileStamp.ts`，workspace / permission 文件戳比较复用。 |
| `parseToolDescription` / `parsePromptDescription` / `parseResourceDescription` 重复 | 已修复。新增 `packages/core/src/mcp/MCPDescriptions.ts`，stdio 与 Streamable HTTP MCP client 复用。 |
| supervisor 输出格式化重复 | 已修复。新增 `apps/electron-shell/src/main/serverSupervisor/output.ts`，Node fallback 与 utilityProcess supervisor 复用输出前缀和错误文案。 |
| 手写 async mutex | 已修复。`ThreadRuntimeOrchestrator` 使用 `async-mutex` 管理 thread 输入临界区。 |
| 手写 polling wait | 已修复。`interruptAndWait` 改为等待已有 idle waiter，并与 timeout race；不再 busy-wait polling。 |
| 手写 SSE 解析 | 已修复。`VercelAdapters` 与 `StreamableHttpMCPClient` 改用 `eventsource-parser`；保留 OpenAI-compatible 空 `data:` event 合并语义。 |
| 手写 stable stringify | 已修复。`FilePermissionPolicy` 改用 `fast-json-stable-stringify` 生成权限参数 hash。 |
| 手写 chunked Promise.all 并发 | 已修复。`TurnSummarizer` 改为固定并发 worker pool，避免批次尾部浪费并发槽。 |
| 手写 MIME 类型映射 | 已修复。agent-server 静态资源 Content-Type 和 `MessageTranslator` 图片扩展名 / MIME 推断改用 `mime-types`。 |
| `Math.random()` ID 生成 | 已修复。`ThreadCommandRouter` 与 `ThreadPersistence` 改用 `crypto.randomUUID()`。 |
| core 实际直接 import 的依赖未声明 | 已修复。`@handagent/core` 声明 `ai`、`@ai-sdk/openai`、`@ai-sdk/anthropic`、`zod`、`eventsource-parser`、`fast-json-stable-stringify` 为直接依赖。 |

## 本轮确认无需修改

| 审计项 | 结论 |
|------|------|
| `clsx` + `tailwind-merge` | `thread-window-web/src/utils/cn.ts` 已按标准组合使用，无需改动。 |

## 保留为后续独立迁移

| 审计项 | 保留原因 |
|------|------|
| `@radix-ui/react-popover` / `@radix-ui/react-alert-dialog` 替换手写 slash 菜单和删除确认对话框 | 属于 UI 行为迁移，会影响 focus、portal、键盘导航和视觉细节；需要独立设计 / QA，不应混入依赖收敛补丁。 |
| `@modelcontextprotocol/sdk` 替换手写 MCP JSON-RPC client | 属于协议栈迁移，影响 stdio lifecycle、Streamable HTTP session、elicitation 和测试 mock server；需要单独计划和兼容性验证。 |
| `reconnecting-websocket` 替换 ActivityWindow 手写连接逻辑 | 当前产品明确约束 ThreadWindow 不做断线恢复；ActivityWindow 的重连策略涉及状态展示和 heartbeat，需要独立确认。 |
| `sirv` / `serve-static` 替换手写静态资源服务 | 会改变 cache headers、range、ETag、fallback 与错误语义；本轮只收敛 MIME 推断，静态服务整体替换需单独验证。 |
| `ws` path 选项替换手写 upgrade path routing | 当前一个 HTTP server 同时承载三条 WebSocket 和静态资源；改成多 `WebSocketServer` path 配置会触及启动 / 测试结构，收益低于风险。 |
| `lucide-react` 替换 inline SVG 图标 | 属于视觉资产和 bundle 迁移，需要按组件逐项替换并做视觉回归。 |
| `fallbackTheme`、`HostTheme`、`isPromiseLike`、NDJSON 解析、supervisor 大块生命周期逻辑继续 DRY | 这些重复横跨 renderer/preload/main 或两个 supervisor 生命周期，直接抽象容易扩大 blast radius；本轮只收敛无行为风险的 supervisor 输出 helper。 |
| `id()` / `newId()`、`now()` 小型重复 | 代码量小且调用点少，抽工具会增加间接层；本轮不处理。 |

## 本轮新增 / 调整依赖

| workspace | 依赖 |
|------|------|
| `@handagent/core` | `@ai-sdk/anthropic`、`@ai-sdk/openai`、`ai`、`eventsource-parser`、`fast-json-stable-stringify`、`zod` |
| `handagent-agent-server` | `async-mutex`、`mime-types`、`@types/mime-types` |
| `handagent-electron-shell` | `zod` |

## 验证记录

本轮局部验证覆盖：

- `packages/core/tests/llm/vercel-client.test.ts`
- `packages/core/tests/mcp/streamable-http-mcp-client.test.ts`
- `packages/core/tests/mcp/mcp-config.test.ts`
- `packages/core/tests/config/model-settings.test.ts`
- `packages/core/tests/permission/file-permission-policy.test.ts`
- `packages/core/tests/workspace/workspace-registry.test.ts`
- `packages/core/tests/runtime/turn-summarizer.test.ts`
- `apps/agent-server/tests/server/server.test.ts`
- `apps/agent-server/tests/protocol/MessageTranslator.test.ts`
- `apps/agent-server/tests/thread/ThreadRuntimeOrchestrator.test.ts`
- `apps/thread-window-web/tests/threadWindowStore.test.ts`
- `apps/thread-window-web/tests/threadWindowStorePersistence.test.ts`
- `apps/thread-window-web/tests/composerInputItems.test.ts`
- `apps/electron-shell/tests/protocol/electronShellProtocol.test.ts`
- `apps/electron-shell/tests/serverSupervisor/nodeAgentServerSupervisor.test.ts`
- `apps/electron-shell/tests/serverSupervisor/utilityProcessAgentServerSupervisor.test.ts`

提交前仍必须执行仓库级检查：

- `bash ./scripts/test.sh`
- `bash ./scripts/swiftw test`
- `bash ./scripts/swiftw build`
