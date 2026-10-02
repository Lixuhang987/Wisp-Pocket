# tools

本目录定义 AgentTool、注册与激活边界。Thread / Pet 拥有身份和执行上下文；工具不能通过模型参数改变所属 Pet。

## 直接子节点

- `types/`：Tool 入参与调用上下文；后端注入 threadId、turnId、toolCallId、rootPath 和 AbortSignal。
- `defineTool.ts`：同一 Zod schema 派生 JSON Schema、校验输入；身份敏感输入使用 strict object，不能忽略多余归属字段。
- `ToolRegistry.ts`、`registerBuiltins.ts`、`registerTools.ts`：注册与设置过滤；可配置 builtin 只包含 file.write。
- `builtins/`：文件读取端口、固定 Pet 根写入及路径验证。
- `MetaToolUseTool.ts`：懒激活 use_tools；激活完整集合后从目录移除，晚到调用幂等。
- `DynamicToolAdapter.ts`：外部 Provider 的动态工具适配。
- [web/web.md](./web/web.md)：默认 Web 查询与抓取。

## 文件边界

| Tool | 输入与执行边界 |
| --- | --- |
| file.read | `{ path }`；绝对路径可任意读取，相对路径从后端上下文 rootPath 解析；默认开放、免 Permission，不受 builtin 设置控制 |
| file.write | `{ relativePath, content }`；只写当前 Thread 所属 Pet 的固定目录；继续经过 Permission 与 builtin 设置过滤 |

Pet 创建后 rootPath 不可修改，Thread 不保存文件根快照。Tool 上下文由 Thread owner 根据 petId 取得，不能接受 workspaceId、petId 或 rootPath 参数重绑定。角色快照不承担文件边界。

file.read 的具体文本/PDF/图片解码由 [agent-server actions](../../../../apps/agent-server/src/actions/actions.md) 实现并注入端口；每次读原文件当前内容，不用缓存替代真实读取。读取结果仍保存为 Thread 历史。

写入拒绝绝对路径、`..`、越界符号链接及目标符号链接；解析最近存在的祖先，避免未创建子目录掩盖越界链接。大小限制为 10 MiB，采用临时文件原子替换。同进程所有工具实例按规范化真实目标路径共享锁，不能按 petId 分锁；进入锁和替换前检查中断。完成的磁盘写入不承诺回滚，也不提供外部进程版本合并。

## 默认目录与授权

agent-server 注入 file.read、四个 context_history 读取工具与 Web 工具，Runtime 统一公开按需 user.ask。ThreadTools 激活其他 builtin/MCP/Dynamic Tool 后仍保留默认工具且不重复。具体组合与持久事实见 [Thread](../thread/thread.md)。

`requiresPermission=false` 只用于明确默认开放的读取与 meta 工具；其他工具继续既有 Permission 策略。读取不查询其旧永久授权规则，角色提示不改变授权。

普通与 Dynamic Tool 均可返回 `{ success, contentItems }` 图片结果；inputText 保存说明，inputImage 保存真实 data URL。普通工具不需要伪造 Dynamic callId。Provider 差异由 [适配层](../adapters/providers/providers.md) 处理，不将图片包在文本 STUB 中。

## Dynamic Tool

实时 macOS、Automation、MCP 等保留原激活边界。Context History 已保存记录由 Node 普通 Tool 读取，不再动态转发给 Swift。

Dynamic adapter 用 threadId / turnId / toolCallId 形成 Provider 唯一调用标识，返回时保留 Runtime 原 toolCallId。失败保留 success=false、文本与图片证据；不能把失败转成成功或丢失原始关联。中断与远程宿主取消不是同一事实。

大段普通工具输出可使用显式 cached 与 Blob/Stub 机制；需要模型实际消费的默认文件/历史图片不使用文本 STUB。工具名称使用 `category.action`，描述必须说明场景和边界。
