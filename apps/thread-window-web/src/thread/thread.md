# thread

本目录提供两种 React 界面复用的首轮输入编排、`/api/thread` 传输与附件 URL。协议 DTO 由 core 拥有；各 renderer 使用自己的 store 与输入控制器。

## 直接子节点

- `threadSocketClient.ts`：socket 生命周期、收发和连接未就绪时的 FIFO 缓冲。
- `threadInputController.ts`：首轮创建关联及 ThreadWindow Composer 提交，使用 store 公共入口和传输能力。
- `attachmentUrl.ts`：以同一服务地址构造图片/PDF Blob 读取 URL。

## 交接边界

- 首轮 payload 只登记在 [store](../store/store.md)。控制器读取创建关联，先调用 store 通知处理与 UI 回调，再依次发送 `thread.resume` 与首轮 `op.submit`；socket 不另存首轮登记。
- ThreadWindow Composer 在连接就绪时直接提交 UserInput，无论当前 Thread 正在执行还是等待普通回复。后端保存和排队，前端不根据 running 状态阻塞提交；桌宠的追加与普通回复沿相同后端语义发送。
- `user.message.recorded` / snapshot 投影已保存输入的 pending，匹配 `turn.started` 再解除。前端没有等待上一轮结束后派发或删除待处理输入的操作。
- Permission 回答发送显式 ClientResponse；ThreadWindow 可先清理本地面板，桌宠等待服务端通知，两端最终由 `request.resolved` 与 snapshot 收敛。建议按钮发送普通 UserInput。
- ThreadWindow 选择由 App 回调管理；桌宠只恢复本宠选择，由明确导航或自己发起的创建确认切换。控制器不统一两种选择规则。

## 传输与恢复

- socket FIFO 只保存连接未就绪时已编码的命令与回执；open 时先报告 connected，再刷新 FIFO，随后发送 Pet / Thread list（桌宠带 petId 筛选）。主动 disconnect 清空 FIFO。
- socket 意外关闭只上报 disconnected，本客户端不自行重连。ThreadWindow 保持无自动恢复；[桌宠控制器](../../../electron-shell/src/activity-window/activity-window.md)额外安排重连，重新列出 Thread 并 resume 当前选择。
- 显式 `thread.resume` 取得 snapshot 及当前待答请求。连接恢复不等于通知重放，也不会把已开始的输入重新执行。
- Blob URL 只携带服务端 Blob ID，不使用用户源文件路径；服务端读取边界见 [server](../../../agent-server/src/server/server.md)。

- InitialPrompt fallback 可缺省 petId；输入控制器等待 `pet.listed` 中唯一默认宠后创建，原始 Input Item 保持不变。显式身份不能被默认项覆盖。

- ThreadWindow 自动消费 `thread.list.nextCursor` 并按 ID 合并轻量摘要，保持全部历史可搜索/导航；桌宠按 petId 使用显式“更多对话”，分页不改变选择。
