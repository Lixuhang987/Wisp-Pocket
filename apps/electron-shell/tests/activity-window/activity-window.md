# activity-window

本目录验证桌宠 renderer 的可观察交互，复用 Thread 客户端与 store。React 用例使用 JSDOM，窗口系统边界另由 Electron `pet-window` 用例覆盖。

## 直接子节点

- `pet-interaction.test.tsx`：启动仅角色、最新 assistant、悬停/焦点、隐藏恢复、建议/自由回复、待处理输入、最终 drop 区域及服务端错误展示/恢复。

## 验证边界

- 使用 Testing Library 操作真实 React 组件，以 fake WebSocket 提供 Thread 通知；不再使用 Activity-only fixture 代表桌宠功能。
- 文件拖入用浏览器 File/DataTransfer 边界读取图片/PDF bytes，不依赖原文件路径。
- 保存失败覆盖带 threadId 与连接级错误两种路径；错误受主动隐藏控制，恢复后不能留下过期提示。
- 后端真实读取、SQLite/Blob 保存、独占回执与队列恢复由 [agent-server 用例](../../../agent-server/tests/tests.md)验证。
- 原生跨应用 drag/drop、透明命中、输入焦点、屏幕边缘和滚动手感保留到 [manual QA](../../../../docs/manual-qa.md)，JSDOM 结果不能替代实机证据。
