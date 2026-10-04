# thread

本目录路由 Workspace/ThreadCommand，并适配持久化与通知。业务生命周期由 [core Thread](../../../../packages/core/src/thread/thread.md) 拥有，连接身份只留在 agent-server。

## 直接子节点

- `ThreadCommandRouter.ts`：Workspace 管理、Thread 命令、定向回复、分页、错误关联与回答资格检查。
- `ThreadPersistence.ts`：输入与 Blob 转换、历史增量、残缺 Turn 恢复和存储句柄管理。
- `ThreadNotificationPublisher.ts`：连接订阅、交互式接收资格、轻量观察与通知分发。

## 命令与连接

- Workspace 经 core 注册表解析真实目录，同一实际目录复用身份；创建只返回 Workspace 与 created，广播结果，错误仅回复发起连接。
- `thread.start` 必须指定 Workspace；commandId 的持久身份先查重并校验项目，重试返回原 Thread。删除墓碑阻止旧创建重试复活历史。
- 未指定 Dynamic Tool 集时使用当前在线 Provider 声明，显式空集合仍为空。Swift 创建时显式提交工具集；声明随 Thread 保存，后续 hello 不更新既有 metadata；Issue #10 后声明不再决定生产主 Agent 工具目录，保留通道不表示能力已迁入 Codex。
- 普通连接接收 `thread.started` 后建立订阅；snapshot、列表与命令错误只回发起连接。列表按 workspaceId 过滤，以 updatedAt / id 降序分页，分页游标绑定项目查询范围；列表不加载消息历史。
- `observeRequests=1` 连接只消费 Thread 身份、Permission 与 request.resolved / thread.deleted 结束事实，不订阅消息正文、不获得回答资格。每页 thread.list 后仅补发该页运行 owner 仍持有的有效请求，不 resume / load 历史。服务端入口与 Electron 消费方见 [server](../server/server.md)。
- 删除成功向全部连接广播 `thread.deleted`；目标不存在时只向发起连接回复 not_found。目标被删除后的输入重试明确失败，不改投其他 Thread。
- resume / submit 只有在持久层确认 Thread 不存在时返回 `thread.error.code=not_found`；存储故障不能伪装成删除，客户端据此保留仍待恢复的选择和草稿。
- 公开 op.submit 只接受 UserInput 或 Interrupt。ClientResponse 经交互连接资格与 Thread 订阅检查后交给所属 Thread，请求是否仍有效由 core 判断。
- socket 断开仅解除订阅，不停止 Thread。snapshot 恢复当前请求，request.resolved 同步清理交互界面；观察连接的请求补发由列表触发。


## 保存与读取

- ThreadPersistence 实现 ThreadStorage 端口，缓存顺序写入句柄，不拥有历史、输入队列或 Turn；SQLite 机制归 [thread-store](../../../../packages/thread-store/thread-store.md)。
- system 与用户/模型消息共用 response_item，完整保存 section 及时间 metadata；何时写入由 [core Thread](../../../../packages/core/src/thread/thread.md) 决定。内部历史恢复包含 system，用户可见投影排除 system；首轮标题只按用户输入判断，不因前置 system 失效。
- 每条输入在执行前落盘，持久接收后才确认。桌宠 `file_reference` 仅保存原路径元数据；图片 Item 先写 Blob，response item 与 live 通知返回同一结构化项。模型路径文字不作为 UI 附件正文。
- 所有入口共享默认工具和 Permission 规则，不预读或区分输入阶段。模型调用 file.read / 历史工具才产生真实读取，能力与失败语义见 [actions](../actions/actions.md)。
- Blob 的只读 HTTP 入口见 [server](../server/server.md)；Input Item 转换见 [protocol](../protocol/protocol.md)。

## 恢复与故障

- rollout 区分输入已保存与 turn.started；重启后未开始输入保持 pending，开始但未完成的 Turn 修复为失败/中断并留下可见说明，不自动重放。
- 后续新输入可唤起保留队列；重启后独立继续/放弃队列策略仍是 TODO，当前不提供相应协议。
- 结果按 base message count 追加生成增量、审计与通知，不覆盖并行接收的新输入；存储失败暂停执行，恢复以已落盘历史为准。
- Registry 冷加载或故障恢复调用重置与残缺 Turn 修复；中断、删除和关闭后的晚到结果由 core 隔离。Codex 不转发中断信号，Dynamic Tool 无远程 cancel，不能把投影中断称为外部操作撤销。Codex 会话登记独立于 rollout，见 [会话存储](../../../../packages/thread-store/src/src.md)。
