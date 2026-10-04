# runtime

`runtime/` 实现单个 Turn 的 LLM/Tool 循环；Thread 在相邻 `thread/` 统一消费 Op、管理队列与持久历史。

## 直接子节点

- `AgentRuntime.ts`：模型与工具循环、Permission 和中断检查。
- `UserQuestion.ts`：按需追问的结构化 `user.ask`。
- `SystemPrompt.ts`：system section 变更版本与模型有效规则投影。
- `TimeContext.ts`：首轮及超过一小时的时间上下文、本地时间表达。
- `Stub.ts`、`TurnSummarizer.ts`：大内容引用与 Turn 后压缩。
- `types/`：运行配置、内部事件、AgentMessage 与 ToolCallEnvelope。

## 执行边界

- AgentRuntime 消费独立的消息副本；Thread 只接收本轮生成的 delta。runtime 不拥有 WebSocket、持久化或 UI projection。
- 普通 Tool 经 Permission policy 后调用；默认 file.read 与四个历史读取 Tool 免 Permission。`use_tools` 激活其余工具，默认工具始终保留。
- 所有 UserInput 采用同一规则，没有首轮读取阶段或后续回复阶段；是否追问由模型按任务判断。
- 项目 AGENTS.md 由 Thread 每轮读取并作为固定运行参数注入同轮模型请求，用户明确要求优先。角色提示仅是前端提交的普通输入历史，不具有单独 system section 或后端身份；文本不能改写工具权限与文件边界。
- 工具策略和项目规则按 section 保存内容变化，清除规则保存空版本；Runtime 通过 Thread 回调先持久化再请求模型。完整历史保留旧版本，模型只前置各 section 最新非空值，旧规则不再生效。工具循环和相同内容不重复保存。
- 时间上下文保留在消息顺序中：首个实际 Turn 请求模型前注入，本轮时刻固定；后续仅在距最近一次已保存注入严格超过 3600 秒时追加。整一小时不刷新，重启从 timeContext metadata 恢复基准；正文为本地带偏移时间与 IANA 时区，metadata 用绝对时刻。
- 内部 system 不构成 UserInput，不进入普通气泡、可见 messageCount、标题或 pending 输入；存储与可见投影分别见 [Thread](../thread/thread.md) 和 [翻译层](../../../../apps/agent-server/src/protocol/protocol.md)。图片 STUB 在模型边界展开为多模态内容，工具结果不能自行成为用户授权。
- 小时内的时间提示只是最近注入的基准；不增加相对时间解析、时钟工具、跨日/时区变化/回拨刷新或后台计时器。Context History 的证据时间和显式范围合约见 [历史读取](../../../../apps/agent-server/src/actions/actions.md)。
- Tool 调用上下文包含 Thread 派生的文件根与 AbortSignal，不从模型参数取得身份。Abort 后停止追加消息和事件；不能硬取消的 Tool 结果也不能写回已中断 Turn。

## 追问与事件

- `user.ask` 生成普通 assistant 消息、建议回复和等待标记并结束当前 Turn；等待不占用请求 broker，没有回复计时器，下一条普通 UserInput 接续。
- Permission 使用独立 ServerRequest / ClientResponse；合约见 [protocol](../protocol/protocol.md)。
- runtime event 由 [agent-server 翻译层](../../../../apps/agent-server/src/protocol/protocol.md)映射为通知与审计；新事件同时核对 live、snapshot 与审计中的稳定身份。
- BlobStore、TurnSummarizer、LLM 与 Permission 由组合根注入；runtime 不依赖 DOM、AppKit、具体 provider 或文件读取实现。
