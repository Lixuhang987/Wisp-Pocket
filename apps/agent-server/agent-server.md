# agent-server

`apps/agent-server` 是 Conversation Runtime 的本地服务组合根。它拥有连接、协议翻译、依赖组合和 Thread 持久化适配，不拥有 Thread 业务生命周期、产品 UI 或 macOS 能力。

## 直接子节点

- [src/src.md](/Users/mu9/proj/handAgent/apps/agent-server/src/src.md)：生产源码索引与依赖方向。
- [tests/tests.md](/Users/mu9/proj/handAgent/apps/agent-server/tests/tests.md)：server、Thread、Tool 与 bridge 测试。
- `package.json`：workspace scripts 与依赖。

## 通道

| 路径 | 消费方 | 内容 |
| --- | --- | --- |
| `/api/thread` | ThreadWindow、桌宠、Swift 窄口径 client | ThreadCommand、ThreadNotification、ServerRequest、ClientResponse |
| `/api/activity` | 轻量状态订阅者 | Agent Activity |
| `/api/dynamic-tools` | Swift Host / Provider | Dynamic Tool 注册与调用 |

三条通道语义隔离；不要用 Dynamic Tool 通道承载 UI 请求，也不要在 Activity 中复制 Thread 内容。

## 组合边界

- `startDefaultServer` 创建设置、LLM、Workspace、Permission、Blob、MCP、Tool registry、ThreadStore、ThreadRegistry 和三条 socket 通道。
- ThreadRegistry / Thread 是运行中及空闲 Thread 的唯一 owner；公开输入经 `op.submit`，UI 回执经连接资格检查后交给所属 Thread 的待答请求。
- 本包注入协议翻译与持久化适配，由 core Thread 决定何时翻译、保存和发布运行结果；UI 不直接看到 runtime event。
- Dynamic Tool spec 可随 Thread 持久化，实际调用按 `clientId` 转发给在线 Provider。
- 主动拖入先保存 Input Item 与 Blob 副本，再经读取 adapter 取得正文；建议等待与执行阶段由 core 区分，接口与恢复边界见 `src/`。

## 本地数据

- `~/.spotAgent/settings.json`：模型与 Tool 设置。
- `~/.spotAgent/threads.sqlite`：Thread rollout。
- `~/.spotAgent/mcp.json`：全局 MCP 配置。
- Workspace、Permission、Blob 与日志路径由对应 src 子模块文档说明。

## 验证

```bash
pnpm exec vitest run apps/agent-server/tests
bash ./scripts/test.sh
```
