# runtime

`runtime/` 实现一个 Turn 内的 LLM/Tool 循环，以及持续消费 Op 的 Agent 运行壳。术语见 [Conversation Runtime](/Users/mu9/proj/handAgent/packages/core/CONTEXT.md)。

## 直接文件

- `AgentMessage.ts`：LLM 消息与多模态 user content。
- `AgentRuntime.ts`：单次 Turn 的 LLM/Tool 循环、Permission 和中断检查。
- `AgentRuntime.ts`：单次 Turn 的模型与工具循环；Thread 在 `thread/` 统一消费 Op。
- 运行配置和服务由 `thread/types` 端口定义。
- `SystemPrompt.ts`：按 section 组装临时 system message。
- `Stub.ts`、`TurnSummarizer.ts`：大内容引用与 Turn 后压缩。
- `ToolCallEnvelope.ts`：LLM Tool call 的归一化表达。
- Thread 生命周期由 `thread/Thread.ts` 和 `thread/ThreadRegistry.ts` 拥有。

## Turn 循环

1. 等待前一轮异步 summary，并把 system sections 临时前置到 LLM 输入。
2. 流式接收 assistant 内容和 Tool call，发出 runtime event。
3. 对普通 Tool 执行 Permission policy，再经 ToolRegistry 调用并回灌结果。
4. 无 Tool call 时结束 Turn；有 Tool call 时继续下一次 LLM 迭代，最多 `maxTimes`。
5. Abort 后停止追加消息和事件；无法硬取消的 Tool 返回也不能写回已中断 Turn。

## 边界

- runtime event 是内部执行事件，由 agent-server 翻译为 ThreadNotification 与审计。
- AgentRuntime 不处理 WebSocket、持久化、UI projection 或 provider 私有 stream。
- Tool 只能经 ToolRegistry 查找；Dynamic Tool 在外部先适配成普通 AgentTool。
- system message 不写入 Thread 历史；Input Item 结构只作 round-trip，模型消费归一化后的 content。
- `use_tools` 是激活完整 Tool 集的 meta-tool，跳过普通 Permission；其他 Tool 默认进入 policy。

## 修改约束

- 保持 runtime 不依赖 `node:fs`、AI SDK provider、AppKit 或 DOM。
- 新 runtime event 要同步检查 agent-server 的 UI 与审计翻译。
- 新 system rule 放入 section builder，不在主循环拼接策略文本。
- BlobStore、TurnSummarizer、LLM 和 Permission 都由组合根注入。
