# workspace

本目录拥有 [Conversation Runtime](../../CONTEXT.md) 的项目身份与注册端口。SQLite 的实现由 [thread-store](../../../thread-store/src/src.md) 注入；界面不直接创建数据库身份。

## 直接子节点

- `Workspace.ts`：项目配置、完整创建结果和存储端口。
- `WorkspaceRegistry.ts`：创建目录、解析实际路径、注册与查询。

## 不变量

- 项目 ID 由后端生成，真实绝对目录唯一；别名规范化后复用已有身份。项目显示名由目录名派生，目录创建后不可修改。
- 项目创建只返回 Workspace 与是否新建；前端伙伴库存、图片与关联不属于此注册表。目录唯一约束与创建 commandId 同库提交。
- 创建重投先按已保存 commandId 查找结果，不重新检查或创建目录；同 commandId 的在途操作复用一个完整创建 Promise。创建后的目录不可用不妨碍重放身份回执。
- AGENTS.md 不保存为项目数据库文本。实际 Turn 开始才从项目根读取一次，由 [Thread](../thread/thread.md) 固定本轮指令；目录访问失败不删除项目或 Thread。
- 固定 Workspace 引用由 [Thread](../thread/thread.md) 持久保存；公开接口与通知见 [protocol](../protocol/protocol.md)。
