# activity-window

本目录验证桌宠 renderer 的可观察交互，复用 Thread 客户端与 store。React 用例使用 JSDOM，窗口系统边界另由 Electron `pet-window` 用例覆盖。

## 直接子节点

- `pet-identity.test.ts`：固定归属、五宠逐 Thread 草稿重建、存储失败、稳定提交重试、请求不切选、离线删除和分页。
- `pet-interaction.test.tsx`：无偏好启动仅角色、常态消息/建议、悬停统一浏览、点击显隐与聚焦、首次文字、角色缩放与偏好恢复、可见命中矩形、待处理输入、最终 drop 区域及服务端错误展示/恢复。

## 验证边界

- 使用 Testing Library 操作真实 React 组件，以 fake WebSocket 提供 Thread 通知；不再使用 Activity-only fixture 代表桌宠功能。
- 用例在常态提交建议与自由回复，验证仅 hover 展开；移出后回复节点、焦点与草稿保持，最新正文和全部建议进入同一浏览区。每次悬停回到底部，同次展开手动上翻后新内容不抢阅读位置。
- 首次文字使用真实输入控制器：空回复框打开/关闭不创建 Thread，发送时只创建一次并关联首轮，后续回复追加同一 Thread。持久接收前保留首轮草稿，确认不覆盖新编辑；创建或提交失败可继续编辑，空 snapshot 合成的本地摘要不算接收，重试仍须等待确认；正式记录即使仍 pending 也算已接收，确认或失败通知不解除主动隐藏。
- 右键菜单用例验证伙伴 / 对话 / 隐藏动作、方向键 / Escape、进入大小滑杆、实际角色尺寸与命中刷新、localStorage 重新挂载恢复及默认重置，并确认回复节点和草稿保留；真实字号、列位置及重启后的显示仍需实机验证。
- hover 用例要求标题进入消息的统一滚动内容；JSDOM 不计算 CSS 布局，仍需实际 Electron 渲染验证标题、角色及回复框的屏幕坐标。
- 几何 fixture 只验证逐气泡命中、统一浏览视口裁剪与滚动后重新上报，不证明常态三行裁剪、真实 CSS 位置或系统穿透。
- 文件拖入用preload File/DataTransfer 边界取得原路径，不读取图片/PDF bytes。异步接收 分别覆盖角色和对话区：松手后主动隐藏，接收与提交完成、Thread 创建通知均保持隐藏，同时仍按松手目标提交；再次点击才恢复并聚焦。
- 保存失败覆盖带 threadId 与连接级错误两种路径；错误受主动隐藏控制，恢复后不能留下过期提示。
- 后端真实读取、SQLite/Blob 保存、独占回执与队列恢复由 [agent-server 用例](../../../agent-server/tests/tests.md)验证。
- 原生跨应用 drag/drop、透明命中、输入焦点、屏幕边缘和滚动手感保留到 [manual QA](../../../../docs/manual-qa.md)，JSDOM 结果不能替代实机证据。
