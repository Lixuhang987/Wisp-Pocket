# tests

## 目录职责

`apps/agent-server/tests` 是 agent-server 的 Vitest 测试集合。当前以 `use-cases/` 里的主路径测试为入口，配合少量按模块保留的边界测试，验证 `/api/thread`、`/api/activity`、`/api/dynamic-tools`、settings 热加载、thread 级 tool 激活、MCP 注册和 dynamic tool bridge。

## 直接子节点索引

| 子节点 | 职责 |
|------|------|
| `use-cases/` | 主路径用例测试；当前 `thread-lifecycle.test.ts` 从 socket handler 入口覆盖 `/api/thread`、`/api/activity`、request/response 回流和 server-level MCP/LLM mode 选择 |
| `activity/` | `AgentActivityPublisher` 的 snapshot、状态派生和 subscriber 广播边界 |
| `agent/` | `AgentRequestBroker` 的等待队列、thread cancel 和 `client_response` 唤醒边界 |
| `thread/` | `ThreadCommandRouter`、`ThreadRuntimeOrchestrator`、`ThreadPersistence`、thread 级工具激活状态等边界语义 |
| `protocol/` | `MessageTranslator` 的 `ThreadNotification`、审计事件、用户附件和 image STUB 翻译 |
| `settings/` | `SettingsBackedLLMClient` 与 `SettingsBackedToolRegistry` 的 stamp 缓存和热加载 |
| `actions/` | `MCPServerRegistry`、`ThreadScopedToolRegistry` |
| `bridges/` | dynamic tool bridge 的 token fencing、超时和断线语义 |
| `support/` | 测试辅助实现，目前包含内存 BlobStore |
| `path-alias.test.ts` | 扫描测试目录内跨包 import，验证 `@handagent/core/*` path alias 能覆盖测试引用 |

## 运行方式

全量：

```bash
pnpm exec vitest run apps/agent-server/tests
bash ./scripts/test.sh
```

单目录或单文件：

```bash
pnpm exec vitest run apps/agent-server/tests/use-cases/thread-lifecycle.test.ts
pnpm exec vitest run apps/agent-server/tests/bridges
```

## 新增测试约束

- 新增会跨越 socket、runtime、persistence、request-response 的行为时，优先扩展 `use-cases/` 主路径测试。
- 只有当行为是明确的合约边界、外部依赖适配或失败语义时，才新增模块级边界测试。
- 不把 `.test.ts` 放进 `src/`。
- `use-cases/` 相关测试应覆盖 `thread.snapshot` 恢复、单连接多 thread 通知路由、运行中删除或中断、`ClientResponse -> client_response Op` 回流，以及 `/api/activity` / `/api/dynamic-tools` 的主路径语义。
- 涉及 request-response 的边界测试应覆盖 broker timeout、socket close 后的 thread 清理和 response op 唤醒 pending request。
- 涉及目录移动时，先跑 `bash ./scripts/test.sh`，再跑 Swift 验证，确保 desktop 启动路径仍能定位 agent-server 入口。
