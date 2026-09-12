# src

`thread-window-web/src` 拥有 ThreadWindow 的连接、UI 状态和组件。

## 直接子节点

- `App.tsx`：连接 socket、store 与当前展示 Thread 的根编排。
- `components/`：历史侧栏、消息、Composer 和请求面板。
- `native/`：读取 preload 注入的配置、主题与 fallback initial prompt。
- `protocol/`：core 协议的 Web encode 与类型守卫。
- [store/store.md](./store/store.md)：事实投影、输入交接、偏好与公共 store 组装。
- [thread/thread.md](./thread/thread.md)：输入编排与 `/api/thread` 传输缓冲。
- `history/`：用户打开历史 Thread 的加载与选择顺序。
- `utils/`：分组、布局和纯函数工具。

## 状态所有权

- store 组装后端事实的展示投影、前端输入交接和界面偏好；正式历史、Turn 与待答请求的生命周期仍属于后端。
- 当前右侧展示的 `activeThreadId` 属于 `App` 本地状态，不进入 store，也不通知 server。
- socket client 只负责收发、传输缓冲和协议回调；输入控制器统一首轮关联与 Composer 派发，状态修改经 store 公共 action。
- permission/workspace request 按 Thread 保存；回答、Turn 终态或 Thread error 都必须清理失效请求。
- 草稿由 ThreadWorkspacePane 按 Thread 保存在内存，切换保留、提交清空、页面重建丢失；运行中提交进入 store 的等待队列，一次只派发一条。

## UI 约束

- 只有消息区滚动；窗口错误、请求面板和 Composer 保持在固定布局槽位。
- 历史侧栏在窄窗口隐藏，其内部只有 Thread 列表区域滚动。
- 所有可见颜色、间距、圆角和字体来自生成的 design token；组件不内联一次性视觉常量。
- Radix popover/dialog 通过 portal 保持视口可见，并保留键盘、焦点与 Escape 语义。

## 协议约束

- 只有 assistant delta 按现有 notification ID 去重，并追加到稳定 item identity；不保证所有通知可重放。
- store 处理 `thread.started` 时更新缓存与输入关联；App 仍在原有通知回调中切换选中项，后台创建导致切换的既有问题见 [bugs](../../../docs/bugs.md)。
- 打开历史先确保本地 state，再发送 resume 等待 snapshot。
- 组件通过 props、store action 或根 callback 发起行为，不直接操作 WebSocket。
