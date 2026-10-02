# workspace

当前 Workspace 概念见 [Conversation Runtime](../../CONTEXT.md)。本目录定义注册表端口和命名文件根；文件工具只能在调用所选 Workspace 的根内操作，但 Thread.workspaceId 当前只是关联元数据，不限制该 Thread 选择其他已注册 Workspace。

## 直接子节点

- `types/`：Workspace、WorkspaceSummary、注册 / 更新输入与 WorkspaceRegistry 端口。
- `index.ts`：公开导出。

具体文件注册表归 [adapters](../adapters/adapters.md) 的 filesystem 实现，不在本目录；跨模块调用规则见 [tools](../tools/tools.md)。

## 当前合约

- `workspace.list` 给模型 WorkspaceSummary，含 id / name / description / isDefault，不含 rootPath；UI 的 workspace.listed 可显示实际路径。
- `workspace.askUser` 通过所属 Thread 的 ServerRequest 交给已订阅且声明接收请求的桌宠或 ThreadWindow；首个有效回执生效，候选外 id 不接受。取消、超时、Thread 中断 / 关闭时返回 cancelled；没有可见窗口不立即取消，仍按后端请求时限等待。
- `file.read` / `file.write` 使用 workspaceId 与相对路径，按所选根执行 realpath / 越界检查；不是依靠 Thread 关联字段或提示词校验。模型默认不接收 rootPath。
- `remove` 只移除注册项，不删除真实文件；默认 Workspace 不可移除，getDefault 必须返回已有默认项。
- 文件 registry 首次播种默认根，register 要求绝对路径并创建目录；更新只支持名称与描述。description 是模型选择的线索，设置 UI 应保持简短。

## 持久化与设置

当前配置为 `~/.spotAgent/workspaces.json`，文件 version 为 1，workspaces 保存 id / name / description / rootPath / createdAt / isDefault。默认目录是 `~/.spotAgent/workspace/`，没有文件或列表为空时自播种。

Swift [Workspace Settings](../../../../apps/desktop/Sources/Settings/settings.md) 直接写共享 JSON；registry 每次公开操作比较 mtimeMs + size，变化时重读，不启动 watcher。文件解析失败不应被描述成用户删除历史或真实目录。

## 修改边界

- 端口不依赖 UI、数据库或 macOS。LLM 摘要不加入绝对路径 / 凭据，UI 草稿与选择另由界面持有。
- 修改请求 / 回执同步 [protocol](../protocol/protocol.md)、[Thread 请求表](../thread/thread.md)、[agent-server](../../../../apps/agent-server/src/thread/thread.md) 和 Web / 桌宠展示，不能把 ClientResponse 改成普通 UserInput。
- Pet 直接替代 Workspace 是未来目标，本轮只修正当前文档漂移；实现范围从 [spec 索引](../../../../docs/medium-powers/specs/specs.md) 进入，尚不能将本文件描述为已经落地的 Pet 模型。
