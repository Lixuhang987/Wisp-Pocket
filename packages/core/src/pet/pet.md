# pet

本目录拥有 [Conversation Runtime](../../CONTEXT.md) 的 Pet 配置边界；数据库由注入的 PetStorage 提供，界面不能直接改写配置文件。

## 直接子节点

- `Pet.ts`：Pet、角色快照、配置输入与存储端口。
- `PetRegistry.ts`：目录与受管图片校验、默认宠和配置操作。

## 配置合约

- Pet id 稳定且不由名称、图片或文件根推导；允许同名、同图和共用 Workspace。始终恰有一只默认宠。
- 创建 Pet 的目录先经 [Workspace 注册](../workspace/workspace.md)，产生或复用项目；新项目额外生成基础 Pet，用户表单始终独立保存。Pet.workspaceId 创建后不可改，DTO 的 rootPath 从项目派生，不属于 Pet 的权威配置。
- 已保存的创建 commandId 必须先重放原 Pet，再考虑目录；同请求在途重投复用创建结果，不因新路径或原目录访问失败播种其他项目。
- 角色编辑只影响新 Thread，名字与图片由界面消费当前配置；角色快照不保存项目根。
- 更新必须提交 expectedRevision；冲突返回当前 revision，不覆盖他人修改。切换默认宠时，原默认宠也获得新 revision。
- 自定义图必须先由服务端解码校验并导入 Blob，再引用受管图片。桌宠资料输入的原文件路径不属于此图片导入链路。
- 管理走 `/api/thread`，校验与协议入口见 [agent-server](../../../../apps/agent-server/src/thread/thread.md)，SQLite 事务与 Thread 快照见 [thread-store](../../../thread-store/thread-store.md)。
