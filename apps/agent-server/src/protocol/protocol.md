# protocol

本目录在 runtime、UI 与持久化表达之间转换。跨进程 DTO 的真相在 [core protocol](../../../../packages/core/src/protocol/protocol.md)。

## 直接子节点

- `MessageTranslator.ts`：内部事件到通知/审计、AgentMessage 到 ConversationMessage，以及 Input Item 保存与模型展开。

## 边界

- runtime event、ThreadNotification 和 ThreadAuditEvent 表达不同所有权；新事件分别判断是否映射 UI 与审计。
- assistant/Tool item ID 包含 Thread 与 Turn 身份；流式 notification 在 active Turn 内唯一。live 与 snapshot 保留稳定消息身份、建议回复和等待标记。
- 用户消息保留扁平预览与结构化 Input Item。图片先写 Blob，将上传 bytes 规范化为 blobId；进入模型时图片再展开为多模态内容。`file_reference` 原样保存元数据，模型只收到原路径文字，不在翻译层预读或创建副本，实际内容由模型调用 file.read 取得。预览摘要只含文件名；两端按结构化项渲染附件，不显示模型路径文字。
- 内部 system 保留在持久历史和 runtime 输入，转换 ConversationMessage 时排除，不生成普通气泡；这不等于丢弃系统版本。模型有效规则投影归 [Runtime](../../../../packages/core/src/runtime/runtime.md)，可见消息数归 [thread-store](../../../../packages/thread-store/src/src.md)。
- snapshot 只让最新且尚未被用户回答的 assistant 询问保持等待，只有有效建议而无正文的项同样参与最新助手选择；core 再按当前 active Turn 和输入队列修正投影。
- Permission 的 ServerRequest 来自 core 请求表，不由消息翻译生成；建议等待只映射为普通 assistant 内容。
- 本目录使用注入的 BlobStore，不创建存储、读取真实配置或发送 socket。
- snapshot 的原始消息转换保留纯工具调用的空 assistant；两端共用的 [UI 消息投影](../../../thread-window-web/src/store/store.md) 决定展示项，并使用 [messages](../../../thread-window-web/src/messages/messages.md) 的正文 / 建议判断。展示过滤不删除 SQLite 或模型上下文中的工具调用记录。

新 Input Item 必须同时覆盖持久保存、snapshot、live 和模型输入；调用与读取边界见 [thread](../thread/thread.md)。
