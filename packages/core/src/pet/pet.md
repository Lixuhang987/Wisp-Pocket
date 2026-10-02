# pet

本目录拥有 [Conversation Runtime](../../CONTEXT.md) 的 Pet 配置边界；数据库由注入的 PetStorage 提供，界面不能直接改写配置文件。

## 直接子节点

- `Pet.ts`：Pet、角色快照、配置输入与存储端口。
- `PetRegistry.ts`：目录与受管图片校验、默认宠和配置操作。

## 配置合约

- Pet id 稳定且不由名称、图片或文件根推导；允许同名、同图和共用文件根。始终恰有一只默认宠。
- 文件根只在创建时指定为绝对目录并规范化为真实路径，创建后不可修改。角色编辑只影响新 Thread，名字与图片由界面消费当前配置。
- 更新必须提交 expectedRevision；冲突返回当前 revision，不覆盖他人修改。切换默认宠时，原默认宠也获得新 revision。
- 自定义图必须先由服务端解码校验并导入 Blob，再引用受管图片。桌宠资料输入的原文件路径不属于此图片导入链路。
- 管理走 `/api/thread`，校验与协议入口见 [agent-server](../../../../apps/agent-server/src/thread/thread.md)，SQLite 事务与 Thread 快照见 [thread-store](../../../thread-store/thread-store.md)。
