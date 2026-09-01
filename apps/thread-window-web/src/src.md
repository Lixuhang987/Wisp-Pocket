# src

`thread-window-web/src` 拥有 ThreadWindow 的连接、UI 状态和组件。

## 直接子节点

- `App.tsx`：连接 socket、store 与当前展示 Thread 的根编排。
- `components/`：历史侧栏、消息、Composer 和请求面板。
- `native/`：读取 preload 注入的配置、主题与 fallback initial prompt。
- `protocol/`：core 协议的 Web encode 与类型守卫。
- `store/`：Thread 状态、消息 item 与显式 action。
- `thread/`：`/api/thread` socket client。
- `utils/`：分组、布局和纯函数工具。

## 状态所有权

- store 持有 `threadsById`、历史、请求、Workspace 列表、连接状态和窗口错误。
- 当前右侧展示的 `activeThreadId` 属于 `App` 本地状态，不进入 store，也不通知 server。
- socket client 只负责收发、队列和协议回调，不直接写组件状态。
- permission/workspace request 按 Thread 保存；回答、Turn 终态或 Thread error 都必须清理失效请求。
- Composer 按 Thread 保存结构化 Input Item。运行中输入进入 per-Thread 队列，一次只派发一条。

## UI 约束

- 只有消息区滚动；窗口错误、请求面板和 Composer 保持在固定布局槽位。
- 历史侧栏在窄窗口隐藏，其内部只有 Thread 列表区域滚动。
- 所有可见颜色、间距、圆角和字体来自生成的 design token；组件不内联一次性视觉常量。
- Radix popover/dialog 通过 portal 保持视口可见，并保留键盘、焦点与 Escape 语义。

## 协议约束

- 收到 notification 先按 ID 去重；streaming delta 必须追加到稳定 item identity。
- `thread.started` 只创建缓存；是否切换当前 Thread 由触发该动作的 UI 流决定。
- 打开历史先确保本地 state，再发送 resume 等待 snapshot。
- 组件通过 props、store action 或根 callback 发起行为，不直接操作 WebSocket。
