# messages

本目录拥有 ThreadWindow 与[桌宠](../../../electron-shell/src/activity-window/activity-window.md)共用的 UI 消息类型和内容判断。各界面使用独立的 [store](../store/store.md) 实例；本目录不拥有协议 DTO、历史保存或界面选择。

## 直接子节点

- `threadItems.ts`：按 `type` 区分用户、助手、工具和错误的联合类型，以及助手正文 / 当前建议的共享判断。

## 共用合同

- 展示项不等同于模型消息：纯工具调用的 assistant 记录允许没有正文；共享投影不为它制造正文项，原始工具调用与结果仍由后端保存。恢复规则见 [store](../store/store.md)，原始历史转换见 [agent-server](../../../agent-server/src/protocol/protocol.md)。
- 正文的可见性忽略纯空白，但保留原文；流式前导空白须等待后续增量，不能提前裁掉 Markdown 缩进。
- 当前有效建议需要非空建议列表与等待标记同时成立；两者分片到达时共享投影先保留元数据，组合完成后再展示。没有正文但有当前有效建议的助手仍有可见内容。ThreadWindow 在助手项内展示建议，桌宠独立展示建议，不创建空正文气泡。
- 工具是否展示属于界面规则：ThreadWindow 展示，桌宠隐藏。附件 / pending 用户项不按助手正文规则过滤。
