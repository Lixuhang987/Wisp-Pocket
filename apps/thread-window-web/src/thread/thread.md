# thread

本目录连接 ThreadWindow 的输入编排与 `/api/thread` 传输。协议 DTO 由 core 拥有，Web 只消费协议编码和 guard。

## 直接子节点

- `threadSocketClient.ts`：socket 生命周期、收发、连接未就绪时的 FIFO 缓冲。
- `threadInputController.ts`：首轮创建关联与 Composer 派发编排，使用 store 公共入口和传输能力。

## 交接边界

- 初始 payload 只登记在 [store](../store/store.md)。控制器先读取创建关联，调用 store 通知处理和现有 UI 回调，再依次发送 `thread.resume` 与首轮 `op.submit`；socket 不再保存另一份首轮登记。
- Composer 运行中、前一条等待开始或已有排队项时继续入队；控制器在 App 原有 effect 时机逐 Thread 尝试派发，每个 Thread 一次只取一条。
- 输入控制器读取展示状态和输入交接状态，经 store action 修改队列与等待标记；Turn 状态仍只由通知投影更新，确认规则保持不变。
- permission/workspace 回答仍发送显式 ClientResponse，然后用 store resolve action 清理面板；窗口选择仍由 App 的原有回调处理。

## 两类等待

| 等待 | 保存内容 | 就绪与清理 |
| --- | --- | --- |
| Composer 队列 | 按 Thread 等待派发的结构化 Op | 连接就绪、Thread 非 running 且没有等待开始标记时取一条；开始或错误通知清理标记，允许用户移除等待项 |
| socket FIFO | 已编码的命令与回执 | open 时先报告 connected，再刷新原有 FIFO，随后发送 Workspace / Thread list；主动 disconnect 清空 FIFO |

连接意外关闭只上报 disconnected。当前不自动重连、恢复订阅、拉取 snapshot、重放通知或补发待答请求；显式打开历史仍走现有 resume 流程。
