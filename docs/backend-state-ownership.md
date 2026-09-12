# 后端状态归属 DAG

本图只记录跨模块的唯一状态真源；未列出的派生值由唯一写入方持有。

```text
agent-server
└─ ThreadRegistry
   ├─ loaded Thread 实例
   │  └─ Thread
   │     ├─ history / input queue
   │     ├─ active Turn / cancellation
   │     ├─ ThreadTools activation
   │     └─ pending Permission / Workspace requests
   ├─ shared services
   │  ├─ LLM client and settings-backed builtin tools
   │  ├─ MCPServerRegistry clients
   │  ├─ Workspace registry
   │  ├─ PermissionPolicy persistent rules
   │  ├─ BlobStore
   │  └─ ThreadStore database
   └─ connection adapters
      ├─ ThreadNotificationPublisher subscriptions
      ├─ DynamicTool provider bridge
      └─ Activity projection
```

- `ThreadRegistry` 是已加载 Thread 的唯一生命周期入口；连接、通知和 Activity 只观察或投影 Thread。
- `Thread` 是运行历史、输入排队、Turn、交互请求和 Thread 工具组合的唯一真源；共享服务不随 Thread 释放。
- `ThreadPersistence` 只负责 ThreadStore 的顺序写入和恢复；成功持久化的历史是重启恢复真源。
- agent-server 关闭时先停止注册表操作，再有界等待 Thread 和共享服务清理；晚到外部结果不能写入已关闭或已删除 Thread。
