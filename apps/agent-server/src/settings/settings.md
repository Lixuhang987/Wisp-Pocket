# settings

本目录把全局 settings.json 转成运行依赖，不拥有 Pet、Thread 或 UI 配置副本。

## 直接文件

- `SettingsAPI.ts`：后端设置 HTTP 读写；模型与工具共享文件串行合并，MCP 原始配置保存不刷新运行连接，永久权限沿同一 policy 撤销。
- `SettingsBackedLLMClient.ts`：按文件 stamp 读取模型设置；仅有效 client 配置变化时重建 Provider。
- `SettingsBackedToolRegistry.ts`：按 stamp 热刷新同一个 builtin registry；可配置 builtin 为 file.write。

stamp 使用 mtimeMs + size，按需检查，不创建额外 watcher。chat / summarizer 共用客户端适配，purpose 只改变模型，不改变服务端凭据和端点。

默认 file.read 与 Context History 不属于设置过滤表，不因旧 denylist 失效；它们从 [actions](../actions/actions.md) 注入默认工具集合。其余 builtin 每轮由 ThreadTools 根据热刷新的 registry 组合，配置不改变所属 Workspace 的固定写入根。

模型设置字段变化须同步 client 配置比较；网络日志可由显式 NetworkLogger 注入，不能记录为业务历史。组合根是 server/startDefaultServer，Provider 实现见 [core adapters](../../../../packages/core/src/adapters/providers/providers.md)。

## 设置接口与写入边界

Electron 经 `/api/settings/model`、`tools`、`mcp`、`permissions` 查询和修改，不直接写配置文件。模型 PUT 是可编辑字段 patch，合并保留未展示字段（含 summarizerModel）；工具 PUT 即时更新同文件，按同一串行队列读改写。API Key 仅配置返回/保存，不进入错误详情，响应不缓存。MCP 校验和保存原始 headers，环境变量插值只属于运行读取，不把展开后的凭据回写。保存 ACK 只确认配置持久化。

Swift 主题偏好写独立 native-preferences.json，Append Prompt 与其他宿主配置保持原生所有权；双方不重写同一镜像。接口由 [server](../server/server.md) 组合，原生边界见 [AgentSettings](../../../desktop/Sources/AppServices/AgentSettings/agent-settings.md)。
