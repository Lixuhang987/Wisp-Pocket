# 跨层架构与接口提案

本页为未来设计；标识和字段均为建议，不是已有 API。当前代码证据见[独立审计](../../research/2026-09-14-pet-codebase.md)，现有所有权遵守根 `handAgent.md` 与 ADR-0001。不为多桌宠重建另一套 Conversation Runtime。

## 状态所有权

| 状态 | 唯一修改与释放者 | 其他层怎样消费 |
| --- | --- | --- |
| 桌宠档案、角色提示版本、默认模型/Workspace、能力配置 | agent-server 组合的档案服务与持久 adapter | Swift 设置、React 编辑器都走同一命令接口；不各写一份 JSON |
| Thread 归属、提示快照、历史、输入队列、运行与待答请求 | core ThreadRegistry / Thread | UI 消费 list/snapshot/notification；不从角标反推运行 |
| Thread rollout、查询索引、档案版本记录 | thread-store 或由档案服务独占的持久 adapter | 业务事务由拥有者发起；UI 不读写数据库 |
| 活跃会话选择、草稿、阅读位置、历史过滤 | 每个桌宠的 UI 导航/草稿 owner | 固定面板、单槽/同屏共用；详情窗不改宠物的选择 |
| 席位、显示模式、窗口层级/位置、快捷键当前接收者 | Electron main 的桌面窗口集合 | 只存 ID 与界面意图，不镜像消息、请求和运行队列 |
| Workspace、全局 Permission、模型凭据 | 现有各共享服务 | 桌宠默认值只是引用；能力限制仍后端执行 |
| 系统热键、原生选择器、主动截图/选区、宿主功能 | Swift Host | 产出明确接收者的输入或受限窗口意图 |
| 对前台 App 的写操作租约与取消 | Host Automation / 宿主执行协调 | 各 Thread 申请共享宿主资源；UI 仅显示等待/占用 |

档案持久化优先与 Thread 元数据使用同一 SQLite 事务边界，避免 Thread 指向未保存的角色版本。若沿用独立配置文件，必须先可靠保存版本再创建 Thread，且 Thread 本身仍保存足够恢复的快照；服务端不能只引用可被删除的实时配置。

## 关键数据形状

```ts
// Proposed: 输入边界由 core 定义，持久 adapter 由 agent-server 组合。
type PetProfile = {
  id: string; name: string; appearanceId: string; revision: number;
  rolePrompt: string; defaultWorkspaceId: string | null;
  modelPresetId: string | null; allowedToolNames: string[] | null;
  archivedAt: string | null;
};
type ThreadIdentity = {
  petId: string; workspaceId: string | null;
  profileSnapshot: { revision: number; name: string; rolePrompt: string };
  source: { kind: 'pet' | 'prompt_panel' | 'agent_trigger' | 'handoff';
            sourceThreadId?: string; sourceMessageIds?: string[]; triggerId?: string };
};
type CapturedDelivery = {
  deliveryId: string; petId: string; workspaceId: string | null;
  destination: { kind: 'new' } | { kind: 'append'; threadId: string };
};
```

`allowedToolNames: null` 表示沿用已配置能力，空数组表示没有可用执行工具，不能混淆。人设快照可审计；工具能力上限在每次调用时应用**当前更严格的撤销**，不会因旧快照重新允许被关闭的工具。模型 ID 是引用，密钥不复制到 Thread。用户可明确选择本轮模型，实际使用版本随 Turn 记录。

## 命令及通知增量

| 拟议接口 | 必须表达的语义 |
| --- | --- |
| `pet.list/create/update/archive` | 稳定 ID；update 带 expectedRevision，冲突返回当前版本；归档不级联删除 Thread |
| `thread.start` 增加 petId、source | 服务端校验档案可用、解析版本快照后原子创建；仍不直接运行首轮 |
| `thread.list` 增加 petId/workspaceId/query/cursor | 分页返回归属、标题、轻量状态/待决定摘要和下一 cursor；不依赖加载全部 Thread |
| `thread.started/listed/snapshot` 补齐 identity | 三种入口必须同一归属；renderer 不能通过创建时间猜接收宠 |
| `thread.metadata.update`、归档/恢复命令 | 标题与展示性元数据单独更新；乐观并发；不偷偷换 petId |
| `thread.search` / 历史分页 | 查询已存资料；结果带 Thread、消息锚点与来源，不把全文塞进通知 |
| `thread.summary.changed` | 提供历史行需要的状态、等待数与更新时间；纯后端事实投影，不取代详细流 |
| `op.submit` | 沿用 threadId 与 opId；所属宠物从 Thread 读取，不能用提交时的 UI petId 改写 |
| `ClientResponse` / `request.resolved` | 沿用唯一请求身份与一次有效回执；补充明确的过期展示，不另造“宠物批准” |
| 窗口意图 `pet.open_thread/show/switch` | 只包含定位 ID 和激活原因；同屏映射到对应窗口，单槽映射到席位 |

关键事件需要 commandId/opId/deliveryId 可关联，失败分别标识创建失败、尚未保存、已保存读取失败、执行失败。重连后查询已接受 opId 的状态或用稳定 opId 去重；不能因不知道 ACK 是否收到而换一个 ID 重发。

所有协议修改须贯穿 core DTO → server guard/router → Thread → persistence/SQLite → 通知投影 → Web guard/store → Swift codec。字段只加在 renderer 会破坏恢复；只加在数据库会让实时路由仍出错。`/api/activity` 继续不装完整对话，`/api/dynamic-tools` 继续不承载 UI 历史。

## 窗口与连接

默认候选为“每个可见宠物一个小窗口 + 按需展开的会话表面”，单位置模式复用一个席位窗口。每宠窗口持有稳定 petId 绑定；当前 IPC 只校验唯一 webContents，必须改成受 main 管理的 sender→实例映射。renderer 不能传任意 windowId 操作别人的窗口。

比较过一个全屏透明大窗口：统一布局容易，但透明空白的命中、Spaces、跨屏和异常恢复成本高。暂不采用全屏覆盖作为默认。一个小窗口内放一组相邻宠物仍可作为性能备选；实际选择以三宠原生试验与能耗对比决定，不把“一宠一 runtime/进程”当必要条件。

消息投影与 native window 生命周期分开：主显示 renderer 重建时从后端恢复 Thread，从轻量本地偏好恢复导航；不依赖另一个宠窗口把完整历史复制过来。只订阅所需详细 Thread，轻量摘要独立更新。所有 UI 关闭不停止后台任务，后端退出则按现有生命周期收尾。

草稿按 `(petId, threadId | newDraftId)` 保存；持久草稿仅在本机、使用与应用数据一致的保护规则，不当成已提交历史。重建后能明确区分“未发送”和“已接收待处理”；删除 Thread 时一起清理对应本地草稿，其他宠不受影响。

## 解除 ThreadWindow 的真实依赖

当前 Swift availability 同时依赖服务健康与 hidden ThreadWindow prepared，提交后也聚焦 ThreadWindow；该窗口崩溃会断开部分宿主连接。只改成看不见并不能完成主入口迁移。

目标分开 serviceReady、petSurfaceReady、optionalDetailReady：服务和可用桌宠决定普通提交可用性，ThreadWindow 按需创建。其加载失败或崩溃只影响可选详情出口；桌宠、Provider 和服务保持健康时继续工作。宠物 renderer 崩溃单独恢复并提示状态，不误报整个任务失败。

PromptPanel 保留原生选区/截图优势，变成可选采集器：打开时明确并冻结目标宠；用户可显式切换；提交成功后回到目标宠的同一 Thread。AgentTrigger Instance 保存目标 petId 与“新对话/指定长期对话”策略，默认新建；后台结果只增加所属宠的状态。失效目标与提交失败可见，不静默吞错或转给当前宠。

不为当前未上线工程建设旧协议兼容层。更新 schema、测试夹具和所有客户端时保持一次性一致；这不等于可以静默丢弃本地历史。历史处置与数据备份应作为实施时的显式数据操作，原型不触碰真实数据库。
