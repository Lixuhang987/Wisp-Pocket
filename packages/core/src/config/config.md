# config

本目录解析 `~/.spotAgent/settings.json` 中主 Agent 的模型配置。Codex 使用用户自己的 CLI 配置与登录，不映射主 Agent 模型、凭据或权限。

## 直接子节点

- `ModelSettings.ts`：模型设置 schema、默认值与文件路径。

## 配置与生效边界

`llm` 保存 provider、model、summarizerModel、apiKey、baseUrl 与 api；字段真相以类型定义为准。顶层 JSON 解析失败明确报错，缺失或未识别字段按 schema 默认值归一化。已删除 ToolSettings 与 builtin allowlist / denylist 的执行过滤，不提供旧开发配置迁移。

[agent-server 设置接口](../../../../apps/agent-server/src/settings/settings.md) 校验并合并模型 patch，保留未展示字段。[SettingsBackedLLMClient](../../../../apps/agent-server/src/settings/SettingsBackedLLMClient.ts) 按实例缓存 mtimeMs + size，配置改变后下次模型请求生效；只有有效 Provider 配置变化才重建 client。chat / summarizer 共用服务端凭据与端点，purpose 只改变模型。

Swift 原生主题使用独立偏好文件，不写后端镜像；Codex 可用状态是只读探测，不保存为模型或 Tool 开关。

## 修改约束

- 不在模块作用域缓存设置；缓存归调用方实例，保持改完下次请求生效。
- 新配置组有独立 schema 与 loader，不混入 ModelSettings。
- 文件路径函数保留 homeDir 注入，避免测试触碰用户配置。
- 配置字段变化须同步 Provider client 配置比较；默认设置 api 为 responses，直接构造 VercelClient 的默认 api 为 chat，生产路径必须显式透传。

Provider 适配见 [adapters](../adapters/adapters.md)，模型端口见 [llm](../llm/llm.md)。
