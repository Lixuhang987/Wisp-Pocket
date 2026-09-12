# Wisp Pocket 架构

统一术语从 [CONTEXT-MAP.md](/Users/mu9/proj/handAgent/CONTEXT-MAP.md) 进入；本文只记录跨上下文架构、所有权和不可从单个模块看出的合约。

## 分层架构

```mermaid
flowchart TD
  D[apps/desktop<br/>Swift Host] -->|command bridge| E[apps/electron-shell<br/>Electron UI Shell]
  E --> W[apps/thread-window-web<br/>ThreadWindow]
  E --> A[桌宠]
  E -->|supervise| S[apps/agent-server]
  D -->|/api/thread| S
  D -->|/api/dynamic-tools| S
  W -->|/api/thread| S
  A -->|/api/thread| S
  S --> C[packages/core<br/>Conversation Runtime]
  S --> T[packages/thread-store<br/>Thread rollout]
  D --> P[apps/builtin-plugins<br/>Host Automation]
```

## 所有权

| 层 | 唯一职责 |
| --- | --- |
| `apps/desktop` | macOS 生命周期、PromptPanel、Settings、AgentTrigger、宿主能力与 Electron 启停 |
| `apps/electron-shell` | 常驻 UI 容器、agent-server supervisor、ThreadWindow 预热、桌宠与原生窗口生命周期 |
| `apps/thread-window-web` | ThreadWindow 界面，以及供两种 React 界面复用的 Thread 协议、消息投影与连接 |
| `apps/agent-server` | WebSocket 路由、协议翻译、依赖组合与持久化适配 |
| `packages/core` | Conversation Runtime、协议 DTO、LLM/Tool/Workspace/Permission 抽象 |
| `packages/thread-store` | SQLite rollout 与 Thread 派生视图 |
| `apps/builtin-plugins` | 宿主原子能力、Context History 与 Automation |

## 跨层合约

- 初始上下文只来自用户主动提交的 Input Item。未主动交付的屏幕、剪贴板、文件和 App 状态由 Tool 按需读取。
- `/api/thread` 承载 `ThreadCommand`、`ThreadNotification`、`ServerRequest` 与 `ClientResponse`。ThreadWindow 和桌宠分别连接并共享后端 Thread；Swift 只创建 PromptPanel / AgentTrigger Thread 并提交首轮 `UserInput`。
- `/api/activity` 只发送 Agent Activity，不承载 Thread 消息或历史。
- `/api/dynamic-tools` 只连接 Dynamic Tool Provider。Swift Host 统一暴露原生与 enabled Plugin 的能力。
- Electron UI Shell 是 agent-server 的唯一 supervisor，也是 ThreadWindow 与桌宠的唯一宿主；关闭 UI 窗口不停止 agent-server。
- 拖入以 `UserInput.mode: "inspect"` 授权读取本次资料；执行建议须等后续明确用户消息。图片/PDF 先保存 Blob 副本，再读取；输入队列由 core Thread 持久化协调。
- 建议按钮发送普通 UserInput；Permission/Workspace 保持 ClientResponse。core 请求表只接受一次有效回执，`request.resolved` 同步清理两端展示。
- `thread.snapshot` 是既有 Thread 的状态入口。ThreadWindow 当前不做断线恢复；桌宠重连后重新列出 Thread，并恢复按创建时间选中的 Thread。

## 状态源

- Swift Host 持久化模型设置、主题偏好、AgentTrigger 与 Plugin enablement；React 只消费解析后的主题。
- 两种 React 界面各持 UI 投影，权威历史共用同一个 Thread。桌宠的当前 Thread、气泡隐藏和回复草稿是界面状态；Swift 与 Electron main 不 mirror 消息或历史。
- core ThreadRegistry / Thread 持有运行中的 Thread、历史、Turn、请求和工具状态；agent-server 仅持有订阅、连接和请求路由。
- Thread 历史主文件是 `~/.spotAgent/threads.sqlite`；其他本地配置和数据路径由 owning 模块文档说明。

## 阅读路由

1. 从 [CONTEXT-MAP.md](/Users/mu9/proj/handAgent/CONTEXT-MAP.md) 取得相关术语。
2. 应用入口见 [apps/apps.md](/Users/mu9/proj/handAgent/apps/apps.md)。
3. 跨平台核心见 [packages/packages.md](/Users/mu9/proj/handAgent/packages/packages.md)。
4. 协议字段以 [packages/core/src/protocol](/Users/mu9/proj/handAgent/packages/core/src/protocol/protocol.md) 和代码类型为真相。
