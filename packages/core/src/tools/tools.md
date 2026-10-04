# tools

本目录定义 AgentTool、通用注册与调用边界。Thread 固定保存 Workspace 归属，工具从后端上下文取得执行目录；模型不能通过参数重绑定身份。

## 直接子节点

- `types/`：Tool 入参与调用上下文；后端注入 threadId、turnId、toolCallId、rootPath 和 AbortSignal。
- `defineTool.ts`：同一 Zod schema 派生 JSON Schema 并校验输入；身份敏感输入使用 strict object。
- `ToolRegistry.ts`：工具名称注册与替换。
- `builtins/`：默认文件读取端口和路径解析；已删除内置 file.write。
- `DynamicToolAdapter.ts`：保留外部 Provider 的动态工具适配。
- [web/web.md](./web/web.md)：默认 Web 查询与抓取。

## 文件与授权边界

`file.read` 接受 `{ path }`，绝对路径可任意读取，相对路径从上下文 rootPath 解析；默认开放、免 Permission，没有 builtin 设置开关。实际文本/PDF/图片解码由 [agent-server actions](../../../../apps/agent-server/src/actions/actions.md) 注入，每次读原文件当前内容，结果保存为 Thread 历史。

Workspace.rootPath 与 Thread.workspaceId 创建后固定，Thread 不保存文件根快照。主 Agent 的全部文件创建和修改交给 codex.execute，Workspace 是 Codex 工作目录，不能据此推断原内置写入路径限制、原子替换、文件锁或沙箱。Codex 权限与执行合约由 actions 拥有；项目与 Thread 归属见 [Workspace](../workspace/workspace.md) 和 [Thread](../thread/thread.md)。

## 默认目录

生产组合首轮公开 file.read、四个 context_history 读取工具、Web 与 codex.execute；Runtime 统一补入按需 user.ask。不存在 use_tools、运行时激活或旧历史激活恢复；ThreadTools 每 Turn 解析后端提供的目录。全局 MCP、Dynamic/macOS/Automation 实现与配置保留，但不直接进入主 Agent 目录，也未迁入 Codex。

`requiresPermission=false` 只用于明确默认开放的读取工具；Codex 委托遵循既有 Permission，角色提示不改变授权。读取不查询其旧永久授权规则。

普通与 Dynamic Tool 均可返回 `{ success, contentItems }` 图片结果；inputText 保存说明，inputImage 保存真实 data URL。普通工具不伪造 Dynamic callId；Provider 差异由 [适配层](../adapters/providers/providers.md) 处理，不将图片包在文本 STUB 中。

## 保留的 Dynamic adapter

Context History 已保存记录由 Node 普通 Tool 读取，采集归 Swift。Dynamic adapter 用 threadId / turnId / toolCallId 形成 Provider 唯一调用标识，返回时保留 Runtime 原 toolCallId。失败保留 success=false、文本与图片证据，不得丢失关联。保留 adapter 测试不表示生产主 Agent 可调用宿主工具；中断也不证明远程执行停止。

大段普通工具输出可使用显式 cached 与 Blob/Stub 机制；需要模型消费的默认文件/历史图片不使用文本 STUB。工具名称使用 `category.action`，描述必须说明场景和边界。
