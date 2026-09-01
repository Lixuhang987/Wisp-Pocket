# src

`apps/agent-server/src` 把 core 能力组合成本地服务。每个子目录只拥有一种适配职责。

## 直接子节点

- [server/server.md](/Users/mu9/proj/handAgent/apps/agent-server/src/server/server.md)：进程入口、HTTP/WebSocket 分派与组合根。
- [thread/thread.md](/Users/mu9/proj/handAgent/apps/agent-server/src/thread/thread.md)：Thread 命令、运行编排、持久化和通知分发。
- [agent/agent.md](/Users/mu9/proj/handAgent/apps/agent-server/src/agent/agent.md)：Agent mailbox、状态与 request broker。
- [protocol/protocol.md](/Users/mu9/proj/handAgent/apps/agent-server/src/protocol/protocol.md)：runtime、UI 与持久化表达之间的翻译。
- [actions/actions.md](/Users/mu9/proj/handAgent/apps/agent-server/src/actions/actions.md)：Thread-scoped Tool registry 与 MCP 激活。
- [bridges/bridges.md](/Users/mu9/proj/handAgent/apps/agent-server/src/bridges/bridges.md)：Dynamic Tool Provider bridge。
- [activity/activity.md](/Users/mu9/proj/handAgent/apps/agent-server/src/activity/activity.md)：Agent Activity 投影。
- [settings/settings.md](/Users/mu9/proj/handAgent/apps/agent-server/src/settings/settings.md)：设置驱动的 LLM 与 Tool 热加载。

## 依赖方向

```mermaid
flowchart LR
  S[server] --> T[thread]
  S --> A[actions]
  S --> B[bridges]
  S --> V[activity]
  T --> G[agent]
  T --> P[protocol]
  A --> B
```

- `server` 是唯一组合根；子模块不读取进程环境并自行创建全局依赖。
- `thread` 是唯一直接使用 thread-store 的业务目录；`protocol` 只翻译类型。
- `activity` 旁路观察 Thread 消息，不反向改变 Thread 行为。
- 跨进程 DTO 只从 core protocol 导入，不在本包复制定义。
