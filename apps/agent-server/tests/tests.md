# tests

## 目录职责

`apps/agent-server/tests` 是 agent-server 的 Vitest 测试集合。当前以 `use-cases/` 里的主路径测试为入口，配合少量按模块保留的边界测试，验证 `/api/thread`、`/api/activity`、`/api/dynamic-tools`、settings 热加载、thread 级 tool 激活、MCP 注册和 dynamic tool bridge。

## 直接子节点索引

| 子节点 | 职责 |
|------|------|
| [use-cases/use-cases.md](./use-cases/use-cases.md) | Thread 生命周期/所有权、桌宠读取与持久化、跨界面请求及 Dynamic Tool 身份主路径 |
| `activity/` | `AgentActivityPublisher` 的 snapshot、状态派生和 subscriber 广播边界 |
| `thread/` | Thread 生命周期、持久化、请求、工具激活和所有权主路径 |
| `protocol/` | `MessageTranslator` 的通知、审计、结构化附件与 STUB 翻译 |
| `settings/` | `SettingsBackedLLMClient` 与 `SettingsBackedToolRegistry` 的 stamp 缓存和热加载 |
| `actions/` | `MCPServerRegistry` |
| [bridges/bridges.md](./bridges/bridges.md) | Dynamic Tool 的 token fencing、发送失败清理、显式超时和断线语义 |
| [fixtures/fixtures.md](./fixtures/fixtures.md) | Swift实际保存格式共享夹具 |
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
pnpm exec vitest run apps/agent-server/tests/use-cases/pet-conversation.test.ts
pnpm exec vitest run apps/agent-server/tests/bridges
```

## 新增测试约束

- 新增会跨越 socket、runtime、persistence、request-response 的行为时，优先扩展 `use-cases/` 主路径测试。
- 只有当行为是明确的合约边界、外部依赖适配或失败语义时，才新增模块级边界测试。
- 不把 `.test.ts` 放进 `src/`。
- `use-cases/` 相关测试应覆盖 `thread.snapshot` 恢复、单连接多 thread 通知路由、运行中删除或中断、`ClientResponse -> client_response Op` 回流，以及 `/api/activity` / `/api/dynamic-tools` 的主路径语义。
- `pet-conversation` 复用真实 Thread/Runtime/SQLite/Blob 和桌宠 controller，覆盖首次文字与原路径持久接收、两处松手区域的创建/追加、建议与普通回复、执行中排队、重启恢复、晚到结果不抢占及失败后继续。
- 跨界面删除分别覆盖桌宠在线收到广播、离线后重连读取列表；确认清理失效关联，显式选择工作区仍存在的 Thread 后可继续回复，被删历史不再展示。
- 建议等待无回复计时器；Permission 用例覆盖超时、唯一回执、snapshot 恢复与两端清理。socket 关闭只解除订阅，不能清理仍执行的 Thread。
- system、时间基准与规则版本恢复归 `use-cases/thread-ownership`；`thread/ThreadPersistence.test.ts` 补充前置 system 下首个用户标题与可见消息数边界。脚本模型证明实际请求投影，不证明真实 provider 的时间理解。
- 默认读取沿真实文件/历史夹具、Tool 与 Runtime 验证；PromptPanel 既有图片 Item 另保留 Blob 与模型适配测试，桌宠文件引用复用真实持久化与重建用例验证路径元数据而非副本。
- 原生跨应用拖放、窗口命中与模型对真实材料的理解仍需 manual QA；脚本模型只能证明编排、身份与权限边界。
- 涉及目录移动时，先跑 `bash ./scripts/test.sh`，再跑 Swift 验证，确保 desktop 启动路径仍能定位 agent-server 入口。
