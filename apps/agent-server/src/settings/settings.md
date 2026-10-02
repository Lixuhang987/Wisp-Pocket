# settings

本目录把全局 settings.json 转成运行依赖，不拥有 Pet、Thread 或 UI 配置副本。

## 直接文件

- `SettingsBackedLLMClient.ts`：按文件 stamp 读取模型设置；仅有效 client 配置变化时重建 Provider。
- `SettingsBackedToolRegistry.ts`：按 stamp 热刷新同一个 builtin registry；可配置 builtin 为 file.write。

stamp 使用 mtimeMs + size，按需检查，不创建额外 watcher。chat / summarizer 共用客户端适配，purpose 只改变模型，不改变服务端凭据和端点。

默认 file.read 与 Context History 不属于设置过滤表，不因旧 denylist 失效；它们从 [actions](../actions/actions.md) 注入默认工具集合。其余 builtin 每轮由 ThreadTools 根据热刷新的 registry 组合，配置不改变所属 Pet 的固定写入根。

模型设置字段变化须同步 client 配置比较；网络日志可由显式 NetworkLogger 注入，不能记录为业务历史。组合根是 server/startDefaultServer，Provider 实现见 [core adapters](../../../../packages/core/src/adapters/providers/providers.md)。
