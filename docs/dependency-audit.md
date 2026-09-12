## 依赖收敛审核报告

审核范围：`thread-window-web`、`electron-shell`、`agent-server`、`packages/core` 全部 TypeScript 源码。

审核目标：识别“已有依赖未使用”和“可以用现有 / 知名依赖替代的自造轮子”两类问题。

以下仅保留仍未完成、需要后续处理的独立迁移项。

## 后续独立迁移项

| 审计项 | 保留原因 |
|------|------|
| `reconnecting-websocket` 替换桌宠手写重连逻辑 | ThreadWindow 当前不做断线恢复；桌宠负责重连并恢复选中的 Thread，替换依赖须保留两端各自的连接与显隐语义。 |
| `sirv` / `serve-static` 替换手写静态资源服务 | 会改变 cache headers、range、ETag、fallback 与错误语义；本轮只收敛 MIME 推断，静态服务整体替换需单独验证。 |
| `ws` path 选项替换手写 upgrade path routing | 当前一个 HTTP server 同时承载三条 WebSocket 和静态资源；改成多 `WebSocketServer` path 配置会触及启动 / 测试结构，收益低于风险。 |
| `lucide-react` 替换 inline SVG 图标 | 属于视觉资产和 bundle 迁移，需要按组件逐项替换并做视觉回归。 |
| `fallbackTheme`、`HostTheme`、`isPromiseLike`、NDJSON 解析、supervisor 大块生命周期逻辑继续 DRY | 这些重复横跨 renderer/preload/main 或两个 supervisor 生命周期，直接抽象容易扩大 blast radius；本轮只收敛无行为风险的 supervisor 输出 helper。 |
| `id()` / `newId()`、`now()` 小型重复 | 代码量小且调用点少，抽工具会增加间接层；本轮不处理。 |
