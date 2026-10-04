# 桌宠回复完成红点

## 需求与实施合同

用户要求删除“1 条待处理”一栏，改为 pet 右上角的红点，并且只在模型完成回复后亮起。

- 删除对话中独立的接收 / 发送 / 排队 / 运行状态气泡；错误继续展示，历史用户消息的 pending 标记、停止按钮与后端排队语义保留。
- 当前 Thread 的模型回复收到成功 `turn.completed` 后，且本轮具有正文或有效建议，才点亮角色右上角小红点。输入持久 ACK、流式 delta、Permission、失败和中断不触发完成提示。
- 红点表示完成回复等待查看；角色点击打开对话、指针进入对话区、聚焦回复框或继续回复清除。后台完成不解除主动隐藏、不抢焦点。
- renderer 在逐宠 UI 偏好中按 Thread 保存未查看标记，重建可恢复已观察到的完成；不从普通历史 snapshot 推断新回复，不新增后端协议或跨前端已读同步。
- 新一轮执行清除上轮提示，换 Thread 不携带其他 Thread 的红点。角色缩放、右键、hover、输入与几何锚点沿用原合约。

## 现有链路与数据

`/api/thread` → `ThreadSocketClient` → `ThreadInputController` → store 投影 → `PetThreadController.receive` → `PetSnapshot` → `App` / `PetConversation`。

控制器持有本轮接收到的 assistant item 身份及 turnId，以共享 `hasAssistantContent` 判定最终有可见回复。完成通知只读取该轮 item，避免旧回复使纯工具轮点亮。`PetSnapshot.replyUnread` 是前端呈现事实；`Preferences.unreadReplies` 只存已观察到的未查看结果，正式 Thread 消息与队列仍随后端。

## 测试与任务

- 扩展既有 `pet-interaction.test.tsx` 的“隐藏后后台结果仍隐藏”流程：生成期间无红点、成功完成后亮、其他 Thread 不影响当前红点、重建保留、点击打开清除，并保留原 Permission / 草稿断言。
- 扩展既有“建议按钮和自由输入”流程：可见对话成功完成后亮，hover / 聚焦查看清除，继续保留执行中输入、IME、Interrupt、pending 和历史状态断言。
- 必要时新增一个连贯回复生命周期用例覆盖建议分片 / 纯工具 / 失败 / 中断；累计新增测试预算最多 1 项。
- 先运行更新测试观察失败，再修改控制器、角色标记、状态气泡与 CSS；复跑专项、全仓 TypeScript/Web、Swift test/build 和 Electron build。
- docs-hygiene 同步 owning 文档和 surface；独立无上下文 agent 做文档审核，完成 TODO 迁入 manual QA 后提交。

## 验证记录

- 独立 worktree 初始化与 CodeGraph status 成功；修改前 `bash ./scripts/test.sh` success。
- CSS 使用现有 error 状态色和共享 spacing，红点在角色按钮内部、不扩大透明命中范围。
- Pet 交互专项 23 项通过，累计扩展既有用例 2 项、新增 1 项；最终 `bash ./scripts/test.sh`、`bash ./scripts/swiftw test`、`bash ./scripts/swiftw build` 与 Electron build 全部成功。
- 独立 Electron BrowserWindow 使用真实 dist renderer / CSS，确认流式时无红点、成功完成后 8×8px 红点位于角色按钮内部，完成前后角色与 composer 坐标不变，无 `pet-status` 元素，隐藏后新回复完成仍隐藏且亮红点。证据位于 `.cache/pet-dot-completed.png`、`pet-dot-hidden.png`、`pet-dot-geometry.json` 及对应 visual 驱动 / 日志；socket 与伙伴桥为 fixture，不代表完整宿主、真实模型或系统穿透通过。

## 独立文档审核

- 独立无继承上下文 agent 已读取本合同、代码差异及修改目录的逐级文档链至 `handAgent.md`，核对需求、实现与现状说明。
- 已同步 renderer owning 文档、测试目录指南、桌宠 surface 和 `docs/manual-qa.md`；现状明确红点只保存本宠已观察到的成功完成 / 未查看状态，不从 snapshot 推断断线完成、不宣称跨前端已读同步，独立状态气泡移除不改变历史 pending、Permission 或错误。
- 未发现需要阻止提交的需求或文档不一致；完整宿主、真实模型、亮暗主题 / 缩放 / 透明命中等待验项已进入 manual QA。本审核不修改实现或提交，TODO 任务块由主 agent 在确认最终检查后迁出。
