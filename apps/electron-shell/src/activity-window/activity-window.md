# activity-window

本目录是[桌宠](../../../desktop/CONTEXT.md)的 React renderer，复用 ThreadWindow 的协议、store factory、socket 和附件 URL。后端 Thread 是历史、输入队列与请求的唯一真源。

## 直接子节点

- `App.tsx`：两处拖入区域、气泡显隐、悬停/焦点、回复及窗口桥接。
- `PetConversation.tsx`：独立历史与回复气泡、持久附件、建议与 Permission/Workspace 请求。
- `petThreadController.ts`：Thread 连接、创建时间选择、隐藏状态和提交入口。
- `readDroppedItems.ts`：同步捕获浏览器拖入数据，异步读取用户交付文件。
- `PetSprite.tsx`：图集播放及 reduced-motion 行为。
- [assets/assets.md](./assets/assets.md)：角色图集来源与播放合约。
- `styles.css`：共享主题 token、固定主气泡、透明历史与受限滚动布局。
- `main.tsx`、`index.html`：renderer 入口。

## Thread 与输入边界

- endpoint 由 [preload](../preload/preload.md) 注入，使用 `/api/thread?acceptServerRequests=1`；完整历史不经过 Activity 通道。
- 当前展示只按 `createdAt` 选择最新 Thread。旧 Thread 的消息和结果不抢占当前展示，仍可从 ThreadWindow 历史找回。
- 启动先列出历史并恢复选中 Thread，但保持只显示角色；后续新建 Thread 接管展示。桌宠重连会重新列出、resume 当前选择；ThreadWindow 的连接语义见[其模块文档](../../../thread-window-web/thread-window-web.md)。
- 当前 Thread 被删除时选择剩余历史中最新创建的一项；列表为空则清空选择。重连后的列表也要确认旧 ID 仍存在，不能继续 resume 离线期间已被删除的 Thread。
- 最终 drop 在角色上新建 Thread，在气泡或展开历史上追加。drop 时先捕获目标 Thread 与 DataTransfer，再异步读文件；dragenter/dragover 只高亮和提示，不提交。
- 拖入支持文本、链接、PNG/JPEG/WebP、PDF，提交 `UserInput.mode: "inspect"`。原始 bytes 由服务端保存为 Blob，成功通知与历史使用同一持久引用。
- 文件读取失败或服务端拒绝保存必须显示具体错误；Thread 级与连接级 `thread.error` 都能呈现，但仍遵守主动隐藏。已保存后的内容读取失败由 Thread 消息说明，不能混为未提交。
- 建议按钮和自由回复发送同一种普通 UserInput；执行中也立即提交，由 Thread 保存并排队。接收确认展示“待处理”，`turn.started` 解除对应输入的标记。
- Permission/Workspace 使用原 ClientResponse；两界面竞争回执由 core 仲裁，收到 `request.resolved` 后同步清理。建议等待不使用这些请求的计时器。

## 展示与原生边界

- 角色在下、气泡在上。常态取最新非空 assistant 消息并限制约四行；展开保留同一主气泡节点及其相对角色的位置，长正文在原气泡内滚动读全。工具调用不进入桌宠历史。
- 历史在主气泡上方受限滚动，当前主气泡正文不重复进入历史，当前建议单独呈现；回复框是角色左侧的独立表面，各气泡之间保留透明间隙。
- 悬停或回复区及控件保持焦点时继续展开，鼠标离开且失焦才折叠。滚动查看旧消息时，新消息不会强制跳回底部。
- 主动隐藏只改 UI。后台更新不会解除隐藏；点击角色或再次拖入恢复。启动无首次纯文字输入框，首次文字仍由 PromptPanel 承接。
- renderer 只上报布局、命中矩形和移动意图；[原生窗口](../main/windows/windows.md)负责系统光标、位置文件、屏幕限制，并在上方空间不足时缩短历史窗口以保持主气泡与角色锚点。
- 命中矩形只包含角色、主气泡、逐条历史/请求/当前建议及回复表面；历史矩形与滚动视口取交集，滚动和尺寸变化后重新上报，透明容器保留穿透。
- 角色点击只恢复气泡；首次文字与完整历史继续通过现有 PromptPanel/ThreadWindow 入口访问。输入、滚动或 drop 不转换为窗口聚焦请求。
- 主题消费 Swift 解析的 resolved 值，不持久化主题偏好；气泡和控件的视觉形态与共享 token 遵守 [DESIGN.md](../../../../DESIGN.md)。
- `styles.css` 直接导入 ThreadWindow 的生成主题，使用普通 CSS 的 `--ha-*` 变量；图集尺寸来自播放合约，不依赖 Tailwind 处理桌宠样式。

## 验证入口

[renderer 测试](../../tests/activity-window/activity-window.md)覆盖轻量交互；[agent-server 用例](../../../agent-server/tests/tests.md)覆盖真实 Thread、SQLite 与 Blob；原生窗口合约见 Electron `pet-window` 用例。跨应用拖入、焦点、位置与透明命中必须另做[实机验收](../../../../docs/manual-qa.md)。
