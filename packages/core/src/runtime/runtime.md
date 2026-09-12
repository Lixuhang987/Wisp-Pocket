# runtime

`runtime/` 实现单个 Turn 的 LLM/Tool 循环；Thread 在相邻 `thread/` 统一消费 Op、管理队列与持久历史。

## 直接子节点

- `AgentRuntime.ts`：模型与工具循环、Permission 和中断检查。
- `UserQuestion.ts`：桌宠读取/回复阶段规则与结构化 `user.ask`。
- `SystemPrompt.ts`：临时 system section 组合。
- `Stub.ts`、`TurnSummarizer.ts`：大内容引用与 Turn 后压缩。
- `types/`：运行配置、内部事件、AgentMessage 与 ToolCallEnvelope。

## 执行边界

- AgentRuntime 消费独立的消息副本；Thread 只接收本轮生成的 delta。runtime 不拥有 WebSocket、持久化或 UI projection。
- 普通 Tool 经 Permission policy 后通过 ToolRegistry 调用；`use_tools` 用于激活完整工具集，Dynamic Tool 在外部适配为 AgentTool。
- system sections 临时前置，不进入持久历史。图片 STUB 在模型边界展开为实际多模态内容；读取适配器提交的网页/PDF 正文是资料，不是执行授权。
- Abort 后停止追加消息和事件；不能硬取消的 Tool 结果也不能写回已中断 Turn。

## 读取与等待

- `interactionMode: "inspect"` 只向模型暴露 `user.ask`，运行时也拒绝其他工具调用。已有永久 Permission 不能越过读取阶段执行建议。
- `user.ask` 生成普通 assistant 消息、建议回复和等待标记，并结束当前 Turn。等待不占用请求 broker、没有回复计时器；下一条普通 UserInput 接续处理。
- 桌宠 Thread 的后续回复使用 `reply` 阶段：明确用户选择后进入既有 Tool/Permission 路径，信息不足时继续追问。建议正文不能自行构成用户授权。
- `user.ask` 与 Permission/Workspace ServerRequest 属于不同协议路径；字段与回执规则见 [protocol](../protocol/protocol.md)。

## 修改约束

- runtime event 是内部执行事件，由 [agent-server 翻译层](../../../../apps/agent-server/src/protocol/protocol.md)映射为通知与审计。
- 新事件必须同时核对 live、snapshot 和审计表达；用户可见的消息身份要在这些表达中稳定。
- BlobStore、TurnSummarizer、LLM 与 Permission 均由组合根注入；runtime 不依赖 DOM、AppKit、具体 provider 或文件读取实现。
