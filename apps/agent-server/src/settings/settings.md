# settings

本目录把后端配置转成运行依赖，并提供 Codex 可用状态；不拥有 Pet、Thread 或 UI 配置副本。

## 直接子节点

- `SettingsAPI.ts`：模型/MCP HTTP 管理、永久权限查询撤销和只读 Codex 可用性探测。
- `SettingsBackedLLMClient.ts`：按文件 stamp 读取模型设置，仅有效 client 配置变化时重建 Provider。

模型 stamp 使用 mtimeMs + size，按需检查，不创建额外 watcher。chat / summarizer 共用客户端，purpose 只改变模型，不改变凭据和端点。字段变化须同步 client 配置比较；网络日志不能成为业务历史。

已删除 SettingsBackedToolRegistry 与内置写入开关，主 Agent 工具目录由 [actions](../actions/actions.md) 组合。默认文件/历史读取和 Codex 委托不受旧 builtin allowlist / denylist 控制；委托仍经 Permission，Codex 内部使用用户 CLI 配置。

## HTTP 与状态边界

Electron 经 `/api/settings/model`、`tools`、`mcp`、`permissions` 操作；模型 PUT 是字段 patch，串行合并保留未展示字段。API Key 不进入错误详情，响应不缓存。`GET tools` 返回 `codex` 状态（ready / not_installed / not_logged_in / unavailable）、可处理说明与可选版本；重新检查只运行版本和登录探测，不启动任务、安装或登录，不提供 tools PUT。

MCP 保存原始配置与 headers，不刷新运行连接，也不复制到 Codex；环境变量插值只属于运行读取。配置与既有 client 实现保留，但主 Agent 不直接调用 Wisp MCP。保存 ACK 只确认持久化。

Swift 主题写独立 native-preferences.json，Append Prompt 与其他宿主配置保持原生所有权。双方不重写同一镜像；原生边界见 [AgentSettings](../../../desktop/Sources/AppServices/AgentSettings/agent-settings.md)，接口组合见 [server](../server/server.md)。
