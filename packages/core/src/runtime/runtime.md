# runtime

`runtime/` 实现单个 Turn 的 LLM/Tool 循环；Thread 在相邻 `thread/` 统一消费 Op、管理队列与持久历史。

## 直接子节点

- `AgentRuntime.ts`：模型与工具循环、Permission 和中断检查。
- `UserQuestion.ts`：按需追问的结构化 `user.ask`。
- `SystemPrompt.ts`：临时 system section 组合。
- `Stub.ts`、`TurnSummarizer.ts`：大内容引用与 Turn 后压缩。
- `types/`：运行配置、内部事件、AgentMessage 与 ToolCallEnvelope。

## 执行边界

- AgentRuntime 消费独立的消息副本；Thread 只接收本轮生成的 delta。runtime 不拥有 WebSocket、持久化或 UI projection。
- 普通 Tool 经 Permission policy 后调用；默认 file.read 与四个历史读取 Tool 免 Permission。`use_tools` 激活其余工具，默认工具始终保留。
- 所有 UserInput 采用同一规则，没有首轮读取阶段或后续回复阶段；是否追问由模型按任务判断。
- Pet 角色通过 Thread 保存的快照注入临时 system section；项目 AGENTS.md 由 Thread 每轮读取并作为固定运行参数注入同轮模型请求。优先级为用户明确要求、项目规则、角色习惯；文本不能改写工具权限与文件边界。
- system sections 不进入持久消息历史；图片 STUB 在模型边界展开为多模态内容。工具结果是资料，不能自行成为用户授权。
- Tool 调用上下文包含 Thread 派生的文件根与 AbortSignal，不从模型参数取得身份。Abort 后停止追加消息和事件；不能硬取消的 Tool 结果也不能写回已中断 Turn。

## 追问与事件

- `user.ask` 生成普通 assistant 消息、建议回复和等待标记并结束当前 Turn；等待不占用请求 broker，没有回复计时器，下一条普通 UserInput 接续。
- Permission 使用独立 ServerRequest / ClientResponse；合约见 [protocol](../protocol/protocol.md)。
- runtime event 由 [agent-server 翻译层](../../../../apps/agent-server/src/protocol/protocol.md)映射为通知与审计；新事件同时核对 live、snapshot 与审计中的稳定身份。
- BlobStore、TurnSummarizer、LLM 与 Permission 由组合根注入；runtime 不依赖 DOM、AppKit、具体 provider 或文件读取实现。
