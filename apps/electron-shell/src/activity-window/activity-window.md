# activity-window

本目录是[桌宠](../../../desktop/CONTEXT.md)的 React renderer，复用 ThreadWindow 的协议、store factory、输入控制器、socket 和附件 URL，各自创建独立 store 与控制器。后端 Thread 是历史、输入队列与请求的唯一真源。

## 直接子节点

- `App.tsx`：两处拖入区域、对话显隐、悬停、主动聚焦、回复及窗口桥接。
- `PetConversation.tsx`：常态最新消息与建议、悬停统一浏览、持久附件与 Permission/Workspace 请求。
- `PetReply.tsx`：固定在统一浏览区外的普通回复框。
- `PetSizeControl.tsx`：角色大小的本地偏好、右键滑杆与恢复默认。
- `petThreadController.ts`：Thread 连接、创建时间选择、隐藏状态和提交入口。
- `readDroppedItems.ts`：同步捕获浏览器拖入数据，异步读取用户交付文件。
- `PetSprite.tsx`：原始图集取帧、角色缩放及 reduced-motion 行为。
- [assets/assets.md](./assets/assets.md)：角色图集来源与播放合约。
- `styles.css`：共享主题 token、紧凑气泡、右侧对话列与受限滚动布局。
- `main.tsx`、`index.html`：renderer 入口。

## Thread 与输入边界

- endpoint 由 [preload](../preload/preload.md) 注入，使用 `/api/thread?acceptServerRequests=1`；完整历史不经过 Activity 通道。
- 首轮创建只登记在桌宠自己的 store，由输入控制器先更新 store/界面通知，再加载 Thread 并提交首轮；传输缓冲和共享交接规则见 [Web thread](../../../thread-window-web/src/thread/thread.md)。
- 没有当前 Thread 时也能打开空回复框；仅首次发送才创建 Thread，纯文字沿用普通 UserInput。首轮接收期间只接受一次发送，匹配的持久用户消息确认后才清除未继续编辑的草稿；创建返回不等于输入已接收。失败保留可编辑草稿并走既有错误展示，已创建但尚无持久用户消息的 Thread 重试仍等待接收确认。
- 判断首轮是否已有持久记录时，复用共享 `pendingInitialMessage` 的精确身份排除本地摘要；snapshot 合成的 `user_message` 不代表接收成功，已持久化但仍 pending 的用户记录也不能被排除。
- 当前展示只按 `createdAt` 选择最新 Thread。旧 Thread 的消息和结果不抢占当前展示，仍可从 ThreadWindow 历史找回。
- 启动先列出历史并恢复选中 Thread，但保持只显示角色；后续新建 Thread 接管展示。桌宠重连会重新列出、resume 当前选择；ThreadWindow 的连接语义见[其模块文档](../../../thread-window-web/thread-window-web.md)。
- 当前 Thread 被删除时选择剩余历史中最新创建的一项；列表为空则清空选择。重连后的列表也要确认旧 ID 仍存在，不能继续 resume 离线期间已被删除的 Thread。
- 最终 drop 在角色上新建 Thread，在气泡或展开历史上追加。松手时由 App 恢复显示并捕获目标 Thread 与 DataTransfer，再异步读文件；controller 的提交入口只创建或追加，不再次恢复显示。读取期间的新隐藏意图必须保留，读取完成、提交或创建通知都不能解除；dragenter/dragover 只高亮和提示，不提交。
- 拖入支持文本、链接、PNG/JPEG/WebP、PDF，提交 `UserInput.mode: "inspect"`。原始 bytes 由服务端保存为 Blob，成功通知与历史使用同一持久引用。
- 文件读取失败或服务端拒绝保存必须显示具体错误；Thread 级与连接级 `thread.error` 都能呈现，但仍遵守主动隐藏。已保存后的内容读取失败由 Thread 消息说明，不能混为未提交。
- 建议按钮和自由回复发送同一种普通 UserInput；执行中也立即提交，由 Thread 保存并排队。接收确认展示“待处理”，`turn.started` 解除对应输入的标记。
- Permission/Workspace 使用原 ClientResponse；两界面竞争回执由 core 仲裁，收到 `request.resolved` 后同步清理。建议等待不使用这些请求的计时器。

## 展示与原生边界

- 角色位于左下方，右侧对话列以底部回复框为固定锚点；常态向上排列全部当前建议与最新非空 assistant 气泡。无建议不占位，正文随内容适高、只显示开头最多三行，超出直接裁剪。
- 仅对话区 hover 触发展开，移出即回常态；回复节点、焦点和草稿保持。最新正文与历史共用消息组件，展开后完整消息、当前建议及 Permission/Workspace 请求进入同一个滚动容器，回复框在容器外；工具调用不进入历史，各气泡间保留透明间隙。
- 当前建议只来自仍等待回复的 assistant，常态即可操作，不设置独立滚动区。两种展示均按上方容器裁剪溢出；每次进入 hover 或切换 Thread 回到底部，同次展开只在用户仍处于底部时跟随新内容。
- 角色单击切换整套对话显隐，唤出时聚焦回复框；拖动结束不触发切换。主动隐藏保留草稿，后台消息、结果、错误和新 Thread 不解除隐藏，主动点击或拖入恢复；hover 和后台更新不主动聚焦。
- 角色锚点、对话列尺寸与回复框高度来自 [src 共享布局](../src.md)，角色缩放不改变对话列。renderer 上报布局及常态所需内容高度；[原生窗口](../main/windows/windows.md)限制窗口高度，上方空间不足时裁剪浏览区并保留回复框和角色锚点。
- 命中矩形只包含实际角色、可见气泡、建议、回复和大小控件；上方内容统一按浏览视口裁剪。缩放、滚动、内容与尺寸变化后经 [preload](../preload/preload.md) 重新上报，透明容器保留穿透。
- 点击通过可聚焦的原生窗口进入 renderer，回复框聚焦由 renderer 完成；输入、滚动和 drop 不转换为 ThreadWindow 聚焦请求。
- 主题消费 Swift 解析的 resolved 值，不持久化主题偏好；气泡和控件的视觉形态与共享 token 遵守 [DESIGN.md](../../../../DESIGN.md)。
- `styles.css` 直接导入 ThreadWindow 的生成主题，使用普通 CSS 的 `--ha-*` 变量；图集尺寸来自播放合约，不依赖 Tailwind 处理桌宠样式。

## 角色大小

- 默认显示为原始单帧尺寸的三分之二；右键角色打开大小滑杆，50%–150% 相对该新默认计算，恢复默认回到 100%。图集仍按原尺寸取帧，显示与命中围绕角色右下角一起缩放。
- 大小由 renderer localStorage 保存，独立于 Thread、主题和原生位置文件；无效或不可读取的偏好回退默认，写入失败仍保留本次调整。大小调整不重建回复节点或清除草稿。
- 大小控件可在只显示角色时打开，此时请求能容纳控件的 `compact` 窗口；这不恢复隐藏对话。缩放只改角色表面，对话字号、宽度及输入控件不随之缩放。

## 验证入口

[renderer 测试](../../tests/activity-window/activity-window.md)覆盖轻量交互；[agent-server 用例](../../../agent-server/tests/tests.md)覆盖真实 Thread、SQLite 与 Blob；原生窗口合约见 Electron `pet-window` 用例。跨应用拖入、焦点、位置与透明命中必须另做[实机验收](../../../../docs/manual-qa.md)。
