# workspace

本目录定义 [Workspace](../../CONTEXT.md) 的数据与注册表端口。`file.read / file.write` 只能使用已注册的文件根；`workspace.list` 不向模型暴露根目录绝对路径，file tool 使用其返回的 ID。如果多个 Workspace 都可能匹配，应调用 `workspace.askUser`，由订阅该 Thread 且可接收交互请求的桌宠或 ThreadWindow 承接选择。

Thread 中保存的 `workspaceId` 当前用于元数据与历史分组，不把该 Thread 的文件访问限制为这一个 Workspace。实际边界由每次 file tool 调用的 `workspaceId` 及根内路径校验决定；默认位置与会话级访问限制不能混称。

## 直接子节点

| 子节点 | 职责 |
|------|------|
| `types/` | Workspace DTO、注册/更新输入与 WorkspaceRegistry 端口；文件根仅保留在完整 DTO，提供给模型的摘要不含 rootPath |
| `index.ts` | 桶导出 |

文件注册表实现位于 [adapters](../adapters/adapters.md) 的 filesystem 模块，不由本目录持久化。它首次使用时播种默认根 `~/.spotAgent/workspace/`，把注册信息保存到 `~/.spotAgent/workspaces.json`；注册要求绝对路径并建立目录。

## 设计原则

- **不要把 rootPath 给 LLM**：`workspace.list` tool 返回 `WorkspaceSummary`，没有 `rootPath`；LLM 只看到 id / name / description。
- **模糊时问用户**：`workspace.askUser({ prompt, candidateIds? })` 通过 Thread 的待答请求把 `WorkspaceSummary` 候选发给有资格的订阅连接。用户取消、请求超时或 Thread 中断/关闭会取消选择；没有 UI 回答时等待超时，不由窗口是否可见决定。请求与回执规则见 [thread](../thread/thread.md)。
- **删除不删盘**：`remove(id)` 仅从注册表移除条目，不递归删除磁盘内容，避免误伤用户文件。
- **沙箱化路径解析**：`file.read / file.write` 入参为 `{ workspaceId, relativePath }`，由 tool 内部 join + realpath 校验仍在 rootPath 内（详见 [tools/tools.md](/Users/mu9/proj/handAgent/packages/core/src/tools/tools.md)）。
- **写共享文件**：desktop 的 [WorkspaceSettingsView](/Users/mu9/proj/handAgent/apps/desktop/Sources/Settings/settings.md) 直接写 `workspaces.json`；agent-server 的 `FileWorkspaceRegistry` 不启 watcher，但每次 `list / get / getDefault / register / update / remove` 都会先比较文件 `mtimeMs + size`，文件变化后自动重读，避免写操作覆盖外部修改。

## 文件结构

```
~/.spotAgent/workspaces.json
```

```json
{
  "version": 1,
  "workspaces": [
    {
      "id": "default",
      "name": "default",
      "description": "默认工作区...",
      "rootPath": "/Users/mu9/.spotAgent/workspace",
      "createdAt": "2026-05-17T...",
      "isDefault": true
    }
  ]
}
```

## 编辑此目录的约束

- 不要在 `Workspace` 上加 LLM 不该看到的字段（如本地凭证、sourcetree 列表）；UI 自己的临时态请放别处。
- 新增 registry 实现（如内存版）必须与 `FileWorkspaceRegistry` 保持完全一致的契约（默认 workspace 自播种、`getDefault` 永不返回 null）。
- `description` 是 LLM 选择 workspace 的主要依据，UI 应限长 200 字以避免 prompt 膨胀。

## 相关文档

- 文件 tool 沙箱：[tools/tools.md](/Users/mu9/proj/handAgent/packages/core/src/tools/tools.md)
- 设置 UI：[apps/desktop/Sources/Settings/settings.md](/Users/mu9/proj/handAgent/apps/desktop/Sources/Settings/settings.md)
