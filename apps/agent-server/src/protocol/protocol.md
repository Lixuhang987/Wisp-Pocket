# protocol

`protocol/` 是 agent-server 的翻译层。跨进程 DTO 的真相在 core；本目录只在 runtime、UI projection 和持久化表达之间转换。

## 直接文件

- `MessageTranslator.ts`：runtime event 到 ThreadNotification / ThreadAuditEvent、AgentMessage 到 ConversationMessage、Input Item 与 image STUB 的转换。

## 边界

- `AgentRuntimeEvent` 是执行视角；`ThreadNotification` 是 UI 协议视角；`ThreadAuditEvent` 是持久化审计视角。三者不可互换。
- assistant 与 Tool item ID 必须包含 Turn 身份；notification ID 还要在 active Turn 内唯一，避免流式片段被误去重。
- 图片先写 BlobStore，Thread 中保存可恢复 STUB；进入 LLM 前才展开为多模态内容。
- user message 同时保留扁平内容和结构化 Input Item，保证 live 与 snapshot round-trip。
- Permission / Workspace 的 ServerRequest 由 core Thread 的待答请求产生；workspace list 与 Dynamic Tool frame 不经过本目录。

## 修改约束

- 新 runtime event 必须判断 UI notification 与审计是否都需要映射。
- 新 Input Item 必须同时覆盖持久化、snapshot、live notification 与 LLM 输入转换。
- 本目录不创建 BlobStore、不读真实配置路径、不发送 WebSocket。

## 相关文档

- [core protocol](/Users/mu9/proj/handAgent/packages/core/src/protocol/protocol.md)
- [core runtime](/Users/mu9/proj/handAgent/packages/core/src/runtime/runtime.md)
- [thread persistence](/Users/mu9/proj/handAgent/apps/agent-server/src/thread/thread.md)
