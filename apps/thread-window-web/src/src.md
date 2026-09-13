# src

`thread-window-web/src` 拥有 ThreadWindow 界面，并向桌宠复用 Thread 连接、协议守卫、store factory 和附件 URL。

## 直接子节点

- `App.tsx`：连接 socket、store 与当前展示 Thread 的根编排。
- `components/`：历史侧栏、消息、Composer 和请求面板。
- `native/`：读取 preload 注入的配置、主题与 fallback initial prompt。
- `protocol/`：core 协议的 Web encode 与类型守卫。
- [store/store.md](./store/store.md)：事实投影、首轮关联、偏好与公共 store factory。
- `styles/`：Tailwind 入口与共享生成主题；普通 CSS 变量也供桌宠直接消费。
- [thread/thread.md](./thread/thread.md)：首轮输入控制器、`/api/thread` 传输缓冲与 Blob 附件 URL。
- `history/`：用户打开历史 Thread 的加载与选择顺序。
- `utils/`：分组、布局和纯函数工具。

## 状态所有权

- store factory 为每个界面创建独立 UI 投影，持有 `threadsById`、历史、请求、Workspace 列表、连接状态和窗口错误；后端 Thread 是权威真源。
- 当前右侧展示的 `activeThreadId` 属于 `App` 本地状态，不进入 store，也不通知 server。
- socket client 只负责收发、传输缓冲和协议回调；输入控制器统一首轮关联及 ThreadWindow Composer 提交，状态修改经 store 公共 action。
- Permission/Workspace request 按 Thread 保存；snapshot 恢复请求，`request.resolved`、Turn 终态或 Thread error 清理失效展示。两端回执只由服务端仲裁一次。
- Composer 草稿由 ThreadWorkspacePane 按 Thread 保存在内存，切换保留、提交清空、页面重建丢失；连接就绪时提交立即发给后端。`user.message.recorded` 才确认持久接收并显示 pending，对应 `turn.started` 清除该标记。

## UI 约束

- 只有消息区滚动；窗口错误、请求面板和 Composer 保持在固定布局槽位。
- 历史侧栏在窄窗口隐藏，其内部只有 Thread 列表区域滚动。
- 所有可见颜色、间距、圆角和字体来自生成的 design token；组件不内联一次性视觉常量。
- `styles/generated-theme.css` 由 `scripts/generate-theme-tokens.mjs` 从根 `design/tokens.json` 生成；修改生成器时同时核对 Tailwind 与桌宠的普通 CSS 变量消费，约束见 [DESIGN.md](../../../DESIGN.md)。
- Radix popover/dialog 通过 portal 保持视口可见，并保留键盘、焦点与 Escape 语义。

## 协议约束

- 本次 renderer 存续期内按 notificationId 忽略重复通知；assistant delta 追加到稳定 item identity。去重不提供断线通知重放保证。
- store 处理 `thread.started` 时更新缓存与输入关联；App 仍在原有通知回调中切换选中项，后台创建导致切换的既有问题见 [bugs](../../../docs/bugs.md)。
- 打开历史先确保本地 state，再发送 resume 等待 snapshot。
- 组件通过 props、store action 或根 callback 发起行为，不直接操作 WebSocket。
- 图片与 PDF 使用互斥的 base64/blobId Input Item；live 与 snapshot 都按规范化附件渲染。Blob 读取服务见 [agent-server server](../../agent-server/src/server/server.md)。
- 建议回复与自由输入共用 UserInput；用户回复或新 Turn 会清除旧 assistant 等待展示，不引入专用建议回执。
