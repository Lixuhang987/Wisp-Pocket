# conversation

本目录定义 UI 与 snapshot 使用的 ConversationMessage。模型输入使用 runtime 的 AgentMessage，二者由 agent-server 翻译，供 ThreadWindow 与桌宠消费。

## 直接子节点

- `types/`：ConversationMessage、消息状态与 Tool 展示类型。

## 投影合约

- 用户消息同时保留可预览的扁平文本和结构化 Input Item；图片回显使用已保存的 Blob 引用，`file_reference` 回显使用原路径元数据的文件名卡片；模型的路径文字不作为附件正文。
- `pending` 表示已接收、未开始的用户输入，与 Tool/assistant 的 streaming 或 running 状态不同。
- assistant 的建议与等待状态属于普通消息投影，不属于 ServerRequest。新用户输入或新 Turn 开始后清除旧等待展示，历史仍保留建议文字。
- live 与 snapshot 使用稳定消息身份，避免恢复后重复显示。Tool 名称是展示字段，关联审计使用 toolCallId。
- 新字段需要同时检查 [protocol](../protocol/protocol.md)、[翻译层](../../../../apps/agent-server/src/protocol/protocol.md)和两种 React 界面。
