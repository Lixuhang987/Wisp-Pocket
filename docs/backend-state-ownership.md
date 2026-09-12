# 后端状态归属 DAG

本图只记录跨模块的唯一状态真源；未列出的派生值由唯一写入方持有。

```text
agent-server 组合根
├─ core ThreadRegistry
│  └─ 已加载 Thread
│     ├─ 内存历史 / 输入队列
│     ├─ 当前 Turn / 取消信号
│     ├─ ThreadTools 激活状态
│     └─ 待答 Permission / Workspace 请求
├─ ThreadPersistence
│  └─ CurrentThread 顺序写入句柄缓存
├─ 共享服务
│  ├─ LLM / Tool 设置、MCP clients
│  ├─ Workspace、永久 Permission、BlobStore
│  └─ thread-store SQLite 数据库
└─ 连接适配
   ├─ ThreadNotificationPublisher 订阅与发送通道
   ├─ Dynamic Tool Provider bridge
   └─ Agent Activity 展示投影
```

- `ThreadRegistry` 是 core 提供、由 agent-server 组合根持有的已加载 Thread 唯一生命周期入口；连接、通知和 Activity 只观察或投影 Thread。
- `Thread` 是运行历史、输入排队、Turn、交互请求和 Thread 工具组合的唯一真源；共享服务不随 Thread 释放。
- `ThreadPersistence` 实现现有 `ThreadStorage` 端口，负责输入与 Blob 转换、历史增量、恢复和句柄管理；成功持久化的历史是重启恢复真源。
- agent-server 关闭时先停止注册表操作，再有界等待 Thread 和共享服务清理；晚到外部结果不能写入已关闭或已删除 Thread。

修改职责边界前阅读 [core Thread](../packages/core/src/thread/thread.md) 与 [agent-server 适配](../apps/agent-server/src/thread/thread.md)；持有共享服务引用不等于拥有其生命周期。
