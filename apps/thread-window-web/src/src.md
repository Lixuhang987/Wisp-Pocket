# src

`thread-window-web/src` 拥有 ThreadWindow 界面，并向桌宠复用 Thread 连接、协议守卫、store factory 和附件 URL。

## 直接子节点

- `App.tsx`：连接 socket、store 与当前展示 Thread 的根编排。
- `components/`：历史侧栏、消息、Composer 和请求面板。
- `native/`：读取 preload 注入的配置、主题与 fallback initial prompt。
- `protocol/`：core 协议的 Web encode 与类型守卫。
- `store/`：Thread 状态、消息 item 与显式 action。
- `styles/`：Tailwind 入口与共享生成主题；普通 CSS 变量也供桌宠直接消费。
- `thread/`：`/api/thread` socket client 与基于同一服务地址的 Blob 附件 URL。
- `utils/`：分组、布局和纯函数工具。

## 状态所有权

- store factory 为每个界面创建独立 UI 投影，持有 `threadsById`、历史、请求、Workspace 列表、连接状态和窗口错误；后端 Thread 是权威真源。
- 当前右侧展示的 `activeThreadId` 属于 `App` 本地状态，不进入 store，也不通知 server。
- socket client 只负责收发、队列和协议回调，不直接写组件状态。
- Permission/Workspace request 按 Thread 保存；snapshot 恢复请求，`request.resolved`、Turn 终态或 Thread error 清理失效展示。两端回执只由服务端仲裁一次。
- Composer 草稿按 Thread 保存；提交后立即发给后端。`user.message.recorded` 才确认持久接收并显示 pending，对应 `turn.started` 清除该标记。

## UI 约束

- 只有消息区滚动；窗口错误、请求面板和 Composer 保持在固定布局槽位。
- 历史侧栏在窄窗口隐藏，其内部只有 Thread 列表区域滚动。
- 所有可见颜色、间距、圆角和字体来自生成的 design token；组件不内联一次性视觉常量。
- `styles/generated-theme.css` 由 `scripts/generate-theme-tokens.mjs` 从根 `design/tokens.json` 生成；修改生成器时同时核对 Tailwind 与桌宠的普通 CSS 变量消费，约束见 [DESIGN.md](../../../DESIGN.md)。
- Radix popover/dialog 通过 portal 保持视口可见，并保留键盘、焦点与 Escape 语义。

## 协议约束

- 收到 notification 先按 ID 去重；streaming delta 必须追加到稳定 item identity。
- `thread.started` 只创建缓存；是否切换当前 Thread 由触发该动作的 UI 流决定。
- 打开历史先确保本地 state，再发送 resume 等待 snapshot。
- 组件通过 props、store action 或根 callback 发起行为，不直接操作 WebSocket。
- 图片与 PDF 使用互斥的 base64/blobId Input Item；live 与 snapshot 都按规范化附件渲染。Blob 读取服务见 [agent-server server](../../agent-server/src/server/server.md)。
- 建议回复与自由输入共用 UserInput；用户回复或新 Turn 会清除旧 assistant 等待展示，不引入专用建议回执。
