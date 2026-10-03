# src

`thread-window-web/src` 拥有 ThreadWindow / Electron 设置界面，并向桌宠复用 Thread 连接、协议守卫、store factory、附件 URL 和伙伴表单。

## 直接子节点

- `SettingsApp.tsx`：独立设置 renderer，显式模型 / MCP / Pet 保存与即时工具 / 权限操作。
- `App.tsx`：连接 socket、store 与当前展示 Thread 的根编排。
- `components/`：项目历史侧栏、消息、Composer、请求面板与两处界面共享的伙伴编辑表单。
- `native/`：读取 preload 配置和主题，接收 fallback initial prompt 与明确目标 Thread 的打开请求。
- `protocol/`：core 协议的 Web encode 与类型守卫。
- [store/store.md](./store/store.md)：事实投影、首轮关联、偏好与公共 store factory。
- `styles/`：Tailwind 入口与共享生成主题；普通 CSS 变量也供桌宠直接消费。
- [thread/thread.md](./thread/thread.md)：首轮输入控制器、`/api/thread` 传输缓冲与 Blob 附件 URL。
- `history/`：用户打开历史 Thread 的加载与选择顺序。
- `utils/`：分组、布局和纯函数工具。

## 状态所有权

- store factory 为每个界面创建独立 UI 投影，持有 `threadsById`、历史、请求、Workspace / Pet 列表、连接状态和窗口错误；后端 Thread 是权威真源。
- 当前右侧展示的 `activeThreadId` 与待确认选择记录由 `App` 拥有，不进入 store；选择记录按创建 commandId 关联，既有首轮 payload 仍只登记在 store。
- socket client 只负责收发、传输缓冲和协议回调；输入控制器统一首轮关联及 ThreadWindow Composer 提交，状态修改经 store 公共 action。
- Permission request 按 Thread 保存；snapshot 恢复请求，`request.resolved`、Turn 终态或 Thread error 清理失效展示。两端回执只由服务端仲裁一次。
- Composer 草稿由 ThreadPetPane 按 Thread 保存在内存，切换保留、提交清空、页面重建丢失；连接就绪时提交立即发给后端。`user.message.recorded` 才确认持久接收并显示 pending，对应 `turn.started` 清除该标记。

## UI 约束

- 只有消息区滚动；窗口错误、请求面板和 Composer 保持在固定布局槽位。
- 历史侧栏在窄窗口隐藏，其内部只有 Thread 列表区域滚动。
- 共享颜色、间距、圆角和字体以生成的 design token 为准；设置表单的 CSS 也消费这些变量，局部控件尺寸只服务固定布局，不另建主题。
- `styles/generated-theme.css` 由 `scripts/generate-theme-tokens.mjs` 从根 `design/tokens.json` 生成；修改生成器时同时核对 Tailwind 与桌宠的普通 CSS 变量消费，约束见 [DESIGN.md](../../../DESIGN.md)。
- Radix popover/dialog 通过 portal 保持视口可见，并保留键盘、焦点与 Escape 语义。

## 协议约束

- 本次 renderer 存续期内按 notificationId 忽略重复通知；assistant delta 追加到稳定 item identity。去重不提供断线通知重放保证。
- store 处理所有 `thread.started` 的事实投影和输入关联；App 只对本窗口主动新建或 fallback 首轮登记的 commandId 一次性选中目标。外部、缺失 commandId 或已消费的创建回执只更新投影；对应错误、发送失败或组件卸载清理待确认的选择。
- 点击历史与宿主明确打开目标共用 `openHistoryThread`：先确保本地 state、设置选中项，再发送 resume 等待 snapshot。两者不创建 Thread 或重发首轮输入。
- 宿主通过 [Electron preload](../../electron-shell/src/preload/preload.md) 的 `handAgentReceiveThreadOpen(threadId)` 交付目标；React 安装 receiver 时按序消费并清空早到请求，卸载只移除本次 receiver。该缓冲只跨 preload 与 React 初始化，不保存消息或执行队列。
- 组件通过 props、store action 或根 callback 发起行为，不直接操作 WebSocket。
- 图片使用互斥的 base64/blobId Input Item；文件引用 `file_reference` 只保存原路径，live、pending 与 snapshot 均显示文件名卡片，不加载原文件或渲染路径正文。Blob 读取服务见 [agent-server server](../../agent-server/src/server/server.md)。
- 建议回复与自由输入共用 UserInput；用户回复或新 Turn 会清除旧 assistant 等待展示，不引入专用建议回执。

## 设置与伙伴编辑

- AI、Agent、Pets 使用同一暖色 token；模型、MCP 和伙伴草稿留在各组件内，切页与输入变化不触发保存。失败保留字段与错误；重复打开的窗口由 Electron 聚焦，不重建 renderer。
- 设置 HTTP 地址从既有 Thread URL 的 origin 派生，前端只提交可编辑模型字段，后端合并保留未展示字段；API Key 使用密码输入。MCP 保存只表达配置已保存，连接在服务下次启动时读取。
- `components/PetManager.tsx` 由设置与桌宠消费，二者通过同一个后端 command / revision 合同编辑描述、角色、图片、默认项；项目位置编辑时只读。受控图片 / 目录 picker 和逐宠显示隐藏由 preload 提供，业务文件写入留给后端。
