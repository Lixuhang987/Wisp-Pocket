# activity-window

本目录是[桌宠](../../../desktop/CONTEXT.md)的 React renderer，复用 ThreadWindow 的协议、store factory、输入控制器、socket 和附件 URL，各自创建独立 store 与控制器。后端 Thread 是历史、输入队列与请求的唯一真源。

## 直接子节点

- `App.tsx`：两处拖入区域、气泡显隐、悬停/焦点、回复及窗口桥接。
- `PetConversation.tsx`：较早消息、持久附件与 Permission/Workspace 请求。
- `PetReply.tsx`：常驻当前建议和普通回复。
- `PetSizeControl.tsx`：角色大小的本地偏好、右键滑杆与恢复默认。
- `petThreadController.ts`：Thread 连接、创建时间选择、隐藏状态和提交入口。
- `readDroppedItems.ts`：同步捕获浏览器拖入数据，异步读取用户交付文件。
- `PetSprite.tsx`：原始图集取帧、角色缩放及 reduced-motion 行为。
- [assets/assets.md](./assets/assets.md)：角色图集来源与播放合约。
- [prototypes/prototypes.md](./prototypes/prototypes.md)：多桌宠对话的一次性 UI、状态模型和隔离原生实验；不接入生产运行链路。
- `styles.css`：共享主题 token、紧凑气泡、右侧对话列与受限滚动布局。
- `main.tsx`、`index.html`：renderer 入口。

## Thread 与输入边界

- endpoint 由 [preload](../preload/preload.md) 注入，使用 `/api/thread?acceptServerRequests=1`；完整历史不经过 Activity 通道。
- 首轮创建只登记在桌宠自己的 store，由输入控制器先更新 store/界面通知，再加载 Thread 并提交首轮；传输缓冲和共享交接规则见 [Web thread](../../../thread-window-web/src/thread/thread.md)。
- 当前展示只按 `createdAt` 选择最新 Thread。旧 Thread 的消息和结果不抢占当前展示，仍可从 ThreadWindow 历史找回。
- 启动先列出历史并恢复选中 Thread，但保持只显示角色；后续新建 Thread 接管展示。桌宠重连会重新列出、resume 当前选择；ThreadWindow 的连接语义见[其模块文档](../../../thread-window-web/thread-window-web.md)。
- 当前 Thread 被删除时选择剩余历史中最新创建的一项；列表为空则清空选择。重连后的列表也要确认旧 ID 仍存在，不能继续 resume 离线期间已被删除的 Thread。
- 最终 drop 在角色上新建 Thread，在气泡或展开历史上追加。drop 时先捕获目标 Thread 与 DataTransfer，再异步读文件；dragenter/dragover 只高亮和提示，不提交。
- 拖入支持文本、链接、PNG/JPEG/WebP、PDF，提交 `UserInput.mode: "inspect"`。原始 bytes 由服务端保存为 Blob，成功通知与历史使用同一持久引用。
- 文件读取失败或服务端拒绝保存必须显示具体错误；Thread 级与连接级 `thread.error` 都能呈现，但仍遵守主动隐藏。已保存后的内容读取失败由 Thread 消息说明，不能混为未提交。
- 建议按钮和自由回复发送同一种普通 UserInput；执行中也立即提交，由 Thread 保存并排队。接收确认展示“待处理”，`turn.started` 解除对应输入的标记。
- Permission/Workspace 使用原 ClientResponse；两界面竞争回执由 core 仲裁，收到 `request.resolved` 后同步清理。建议等待不使用这些请求的计时器。

## 展示与原生边界

- 角色位于左下方，右侧对话列常驻最新非空 assistant 气泡、当前建议和回复框。最新气泡与历史共用紧凑样式，随内容适高、常态最多约四行；展开后长正文在原气泡内滚动读全。工具调用不进入历史。
- 悬停或对话控件焦点只决定上方历史是否展示，主气泡与回复节点保持不变；鼠标离开且失焦后只收起历史。历史排除当前正文与建议，各气泡间保留透明间隙；查看旧消息时新消息不强制跳回底部。
- 建议只展示当前 assistant 仍等待回复时提供的选项，位于最新气泡和回复框之间；选项过多时单独滚动，回复框始终可用。
- 主动隐藏只改 UI。后台更新不会解除隐藏；点击角色或再次拖入恢复。启动无首次纯文字输入框，首次文字仍由 PromptPanel 承接。
- 角色锚点与右侧对话列位置来自 [src 共享布局](../src.md)，角色缩放不改变对话列。renderer 只上报布局、命中矩形和移动意图；[原生窗口](../main/windows/windows.md)负责系统光标、位置文件、屏幕限制，并在上方空间不足时缩短历史窗口。
- 命中矩形只包含实际角色、各气泡、回复和大小控件；历史与建议各自按最近的滚动视口裁剪。缩放、滚动和尺寸变化后重新上报，透明容器保留穿透。
- 角色点击只恢复气泡；首次文字与完整历史继续通过现有 PromptPanel/ThreadWindow 入口访问。输入、滚动或 drop 不转换为窗口聚焦请求。
- 主题消费 Swift 解析的 resolved 值，不持久化主题偏好；气泡和控件的视觉形态与共享 token 遵守 [DESIGN.md](../../../../DESIGN.md)。
- `styles.css` 直接导入 ThreadWindow 的生成主题，使用普通 CSS 的 `--ha-*` 变量；图集尺寸来自播放合约，不依赖 Tailwind 处理桌宠样式。

## 角色大小

- 默认显示为原始单帧尺寸的三分之二；右键角色打开大小滑杆，50%–150% 相对该新默认计算，恢复默认回到 100%。图集仍按原尺寸取帧，显示与命中围绕角色右下角一起缩放。
- 大小由 renderer localStorage 保存，独立于 Thread、主题和原生位置文件；无效或不可读取的偏好回退默认，写入失败仍保留本次调整。大小调整不重建回复节点或清除草稿。
- 大小控件可在只显示角色时打开，此时请求能容纳控件的 `compact` 窗口；这不恢复隐藏对话。缩放只改角色表面，对话字号、宽度及输入控件不随之缩放。

## 验证入口

[renderer 测试](../../tests/activity-window/activity-window.md)覆盖轻量交互；[agent-server 用例](../../../agent-server/tests/tests.md)覆盖真实 Thread、SQLite 与 Blob；原生窗口合约见 Electron `pet-window` 用例。跨应用拖入、焦点、位置与透明命中必须另做[实机验收](../../../../docs/manual-qa.md)。
