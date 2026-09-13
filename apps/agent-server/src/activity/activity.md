# activity

本目录从 Thread 通知与待答请求派生轻量 `/api/activity` 状态，不拥有 Thread 业务或界面选择。

## 直接子节点

- `AgentActivityPublisher.ts`：当前 Activity snapshot、状态派生和 subscriber 广播。

## 边界

- socket 绑定在 [server](../server/server.md)。订阅后先收到 activity.snapshot，后续变化收到 activity.changed。
- 只发布 AgentActivityEvent，不发送 ThreadCommand 或消费 ClientResponse，也不回写 Thread 状态。
- latestSummary 只用于短状态文案与输入预览，不承载 assistant 正文、工具结果或完整请求。
- ThreadWindow 与桌宠的消息、历史、待答请求均通过 `/api/thread`；桌宠按创建时间选择 Thread，不使用 Activity 当前项决定展示。
- 单个 subscriber 发送失败只隔离该订阅者，不影响其他订阅者或 Thread 通知。
- 新增状态先更新 core `protocol/types/AgentActivity.ts`，再同步本模块派生与 `tests/activity/`；不能借 Activity 扩展出另一套会话状态。
