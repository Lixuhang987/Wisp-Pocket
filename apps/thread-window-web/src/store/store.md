# store

本目录组装 ThreadWindow 的可见状态。正式历史、Turn 和待答请求的生命周期由后端拥有；这里保存它们的展示投影与前端输入交接状态。

## 直接子节点

- `threadWindowStore.ts`：公共 Zustand 入口与完整 Thread 缓存的创建、删除、原子组装。
- `threadProjection.ts`：协议通知、请求到消息、状态、历史摘要及请求面板的投影。
- `inputHandoff.ts`：首轮关联、Composer 等待队列和等待开始标记。
- `windowPreferences.ts`：搜索、Workspace 展开操作及展开偏好的本地保存。
- `threadItems.ts`：可见消息的 UI 类型；跨进程 DTO 继续从 core 导入。

## 修改责任

| 状态 | 来源与修改入口 | 清理 / 保存范围 |
| --- | --- | --- |
| 消息、状态、历史摘要、错误 | `handleNotification` 交给投影模块；snapshot 替换历史显示，delta 追加到同一 item | Thread 删除移除缓存；不持久化为运行事实 |
| Permission / Workspace 面板 | `handleRequest` 投影到所属 Thread；显式 resolve action 只移除前端面板 | 回答、Turn 终态、非 running 状态通知及 Thread error 按原规则清理；后端决定答案是否有效 |
| Workspace 列表 | `workspace.listed` 或公共 `setWorkspaces` 替换 | 页面内缓存 |
| 连接状态 | socket 事件经 `setConnectionState` 写入 | 展示传输状态，不驱动自动恢复 |
| 搜索与分组展开 | 偏好模块的公共 action | 只有展开集合写入原有 localStorage key；搜索随页面重建清空 |

`ThreadState` 在公共入口仍保持原字段，内部由投影与输入状态组成。组装层先准备完整缓存，再在同一 Immer 更新中交接输入并更新投影；输入模块不写执行状态，投影模块不修改待派发队列。

## 输入交接

| 阶段 | 修改责任 | 结束条件 |
| --- | --- | --- |
| 等待创建返回 | [输入控制器](../thread/thread.md) 调用 `enqueueInitialPrompt`，store 按 `clientRequestId` 唯一登记 payload | started 移交到所属 Thread；带相同 commandId 的 error 删除登记 |
| 首轮待确认展示 | `pendingInitialPrompt` 保存原有关联；输入模块生成摘要占位，投影模块在 snapshot 后合成可见消息 | user record 移除全部 pending 展示；关联本身仍在 `turn.completed` 清空 |
| Composer 等待队列 | 输入模块接收结构化 Op，支持按下标移除；控制器在原有 React effect 时机取出 | 每 Thread 取一条并设置等待标记；删除 Thread 移除整体缓存 |
| Composer 已派发、等待开始 | 直接发送或取队列项时设置 `queuedInputDispatchPending` | `turn.started` 或 Thread error 清除；snapshot、普通状态和完成通知不代替开始确认 |

snapshot 保留原有占位规则，正式记录不使用输入 ID 精确确认；关联尚未清空时再次 snapshot 仍可能重新合成占位。这是当前行为边界，不是通知重放保障。

草稿仍在 `ThreadWorkspacePane` 内，切换 Thread 保留、提交后清空、页面重建丢失；组件展开状态与当前选中 Thread 也保持组件原有归属，不迁入持久化 store。

## 协议与维护边界

- 只有 `assistant.delta` 按既有 notification ID 去重，其余通知保留原有处理；不能将记录过 ID 描述为所有通知幂等。
- store 公共操作与字段供现有组件继续使用；内部模块只处理自身责任，不成为后端 Thread 的第二个修改入口。
- 传输 FIFO 与 Composer 等待队列的边界见 [thread](../thread/thread.md)；行为回归沿 [测试入口](../../tests/tests.md) 验证。
