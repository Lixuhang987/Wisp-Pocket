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

- `startDefaultServer` 创建设置、LLM、PetRegistry、Permission、Blob、MCP、Tool registry、ThreadStore、ThreadRegistry 和三条 socket 通道。
- ThreadRegistry / Thread 是运行中及空闲 Thread 的唯一 owner；公开输入经 `op.submit`，UI 回执经连接资格检查后交给所属 Thread 的待答请求。
- 本包注入协议翻译与持久化适配，由 core Thread 决定何时翻译、保存和发布运行结果；UI 不直接看到 runtime event。
- Dynamic Tool spec 可随 Thread 持久化，实际调用按 `clientId` 转发给在线 Provider。
- 所有入口提交普通 UserInput；桌宠文件通过 `file_reference` 交付原路径元数据，由翻译层转换为模型路径文字；两端附件显示文件名，模型按需调用默认 file.read。PromptPanel 图片仍使用 Blob 副本与多模态链路。

## 本地数据

- `~/.spotAgent/settings.json`：模型与 Tool 设置。
- `~/.spotAgent/threads.sqlite`：Pet 配置、受管图片引用与 Thread rollout。
- `~/.spotAgent/mcp.json`：全局 MCP 配置。
- Pet 文件根、Permission、Blob 与日志路径由对应 src 子模块文档说明。

## 验证

```bash
pnpm exec vitest run apps/agent-server/tests
bash ./scripts/test.sh
```
