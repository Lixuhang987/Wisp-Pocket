# agent-server

`apps/agent-server` 是 Conversation Runtime 的本地服务组合根。它拥有连接、Agent 生命周期、协议翻译、Tool 组合和 Thread 持久化适配，不拥有产品 UI 或 macOS 能力。

## 直接子节点

- [src/src.md](/Users/mu9/proj/handAgent/apps/agent-server/src/src.md)：生产源码索引与依赖方向。
- [tests/tests.md](/Users/mu9/proj/handAgent/apps/agent-server/tests/tests.md)：server、Thread、Tool 与 bridge 测试。
- `package.json`：workspace scripts 与依赖。

## 通道

| 路径 | 消费方 | 内容 |
| --- | --- | --- |
| `/api/thread` | React、Swift 窄口径 client | ThreadCommand、ThreadNotification、ServerRequest、ClientResponse |
| `/api/activity` | StatusBubble | Agent Activity |
| `/api/dynamic-tools` | Swift Host / Provider | Dynamic Tool 注册与调用 |

三条通道语义隔离；不要用 Dynamic Tool 通道承载 UI 请求，也不要在 Activity 中复制 Thread 内容。

## 组合边界

- `startDefaultServer` 创建设置、LLM、Workspace、Permission、Blob、MCP、Tool registry、ThreadStore、Agent manager 和三条 socket 通道。
- Agent 是运行中 Thread 的持久 owner；外部输入统一经 `op.submit`，UI 回执在 server 内包装为内部 Op。
- core runtime event 先在本包翻译成协议通知和审计，再发布或落盘；UI 不直接看到 runtime event。
- Dynamic Tool spec 可随 Thread 持久化，实际调用按 `clientId` 转发给在线 Provider。

## 本地数据

- `~/.spotAgent/settings.json`：模型与 Tool 设置。
- `~/.spotAgent/threads.sqlite`：Thread rollout。
- `~/.spotAgent/mcp.json`：全局 MCP 配置。
- Workspace、Permission、Blob 与日志路径由对应 src 子模块文档说明。

## 验证

```bash
pnpm --filter handagent-agent-server test
bash ./scripts/test.sh
```
