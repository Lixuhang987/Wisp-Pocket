# store

本目录组装 ThreadWindow 与桌宠的展示状态。两个 renderer 各自创建 store；正式历史、Turn、执行队列和待答请求的生命周期由后端 Thread 拥有。

## 直接子节点

- `threadWindowStore.ts`：公共 Zustand 入口、store factory 与完整 Thread 缓存的原子组装。
- `threadProjection.ts`：协议通知、请求到消息、状态、历史摘要及请求面板的投影。
- `inputHandoff.ts`：首轮创建关联与本地待确认摘要。
- `windowPreferences.ts`：搜索、Pet 展开操作及展开偏好的本地保存。
- `threadItems.ts`：可见消息的 UI 类型；跨进程 DTO 从 core 导入。

## 修改责任

| 状态 | 来源与修改入口 | 清理 / 保存范围 |
| --- | --- | --- |
| 消息、状态、历史摘要、错误 | `handleNotification` 交给投影模块；snapshot 替换历史显示，delta 追加到同一 item | 删除 Thread 时移除缓存；不持久化为运行事实 |
| 已保存输入的 pending | `user.message.recorded` 与 snapshot 投影后端待处理状态 | 对应 `turn.started` 按输入身份清除；其他输入的 pending 保留 |
| Permission 面板 | `handleRequest` 与 snapshot 投影到所属 Thread，按 requestId 避免重复 | `request.resolved`、终态和错误清理；显式 resolve action 只移除本地面板，后端判断回执有效性 |
| Pet 列表 | `pet.listed/created/updated` 或公共 `setPets` 替换 | 页面内缓存 |
| 连接状态 | socket 事件经 `setConnectionState` 写入 | 展示传输状态，重连策略归各界面控制器 |
| 搜索与分组展开 | 偏好模块的公共 action | 只有展开集合写入 localStorage；搜索随页面重建清空 |

历史摘要的运行状态随后端 Turn 开始 / 完成和状态通知同步，列表不能停留在创建时状态；状态更新只改投影，不改变当前选择。

组装层在同一 Immer 更新中准备完整缓存、交接首轮关联并更新投影；输入模块不写执行状态，投影模块不调度后端执行。后续输入由界面立即提交，store 不保留可移除或等待派发的 Composer 执行队列。

## 首轮交接

| 阶段 | 修改责任 | 结束条件 |
| --- | --- | --- |
| 等待创建返回 | [输入控制器](../thread/thread.md) 调用 `enqueueInitialPrompt`，按 `clientRequestId` 唯一登记 payload | started 移交到所属 Thread；同 commandId 的 error 删除登记 |
| 首轮待确认展示 | `pendingInitialPrompt` 保存关联；输入模块生成 `pending-` 摘要占位，snapshot 后由投影合成可见消息 | 正式 user record 移除本地摘要，保留其他已保存待处理输入；首轮关联仍在 `turn.completed` 清空 |

本地摘要不代表持久接收，真实输入以服务端通知为准。关联尚未清空时再次 snapshot 仍可能按原规则合成摘要；这不是输入重发或恢复保证。

ThreadWindow 草稿仍在 `ThreadPetPane` 内按 Thread 保存，切换保留、提交清空、页面重建丢失。桌宠的当前 Thread、隐藏状态与回复草稿由桌宠控制器按 petId/Thread 持久保存，窗口选择不迁入此 store。

## 协议边界

- 本次 renderer 存续期内按 notificationId 忽略重复通知，assistant delta 追加到稳定 item；这不提供断线重放或跨页面去重保证。
- live 与 snapshot 保留规范化 Input Item、图片/PDF Blob、建议和等待标记。用户输入记录或新 Turn 清理旧 assistant 等待展示。
- 协议与传输见 [thread](../thread/thread.md)，验证沿 [测试入口](../../tests/tests.md) 进入。
