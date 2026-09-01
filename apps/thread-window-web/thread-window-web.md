# thread-window-web

`apps/thread-window-web` 实现 [ThreadWindow](/Users/mu9/proj/handAgent/apps/desktop/CONTEXT.md)。它由 Electron UI Shell 承载，直接消费 Conversation Runtime 协议。

## 直接子节点

- [src/src.md](/Users/mu9/proj/handAgent/apps/thread-window-web/src/src.md)：React 源码索引、状态所有权和交互约束。
- [tests/tests.md](/Users/mu9/proj/handAgent/apps/thread-window-web/tests/tests.md)：Web 用例与边界测试。
- `package.json`：test/build 入口。
- `vite.config.ts`、`tsconfig.json`：浏览器 bundle 与类型检查。

## 运行边界

- React 持有 `/api/thread?acceptServerRequests=1` 长连接，是持续 ThreadNotification 与交互式 ServerRequest 的唯一 UI owner。
- Swift 只提交 PromptPanel / AgentTrigger 首轮输入；Electron main 只管理窗口。两者都不 mirror React 的 Thread 状态。
- preload 只注入 WebSocket URL、只读 Append Prompt 候选、主题与 initial-prompt fallback。React 不接触 Dynamic Tool spec。
- 非主动断开后只进入 disconnected 状态；当前不重连、不恢复订阅、不自动拉取 snapshot。
- 主题由宿主解析，React 只应用 resolved theme；设计 token 来源是 `design/tokens.json`。

## 协议边界

- 类型真相在 [core protocol](/Users/mu9/proj/handAgent/packages/core/src/protocol/protocol.md)；Web 侧只做 encode、guard 和 UI 投影。
- `thread.resume` 是用户打开历史 Thread 的加载入口，不是断线恢复。
- permission/workspace 请求必须以 `ClientResponse` 回覆；不要转成普通 `op.submit`。
- Stop 发送 Interrupt，不通过关闭 socket 表达中断。

## 验证

```bash
pnpm --filter handagent-thread-window-web test
pnpm --filter handagent-thread-window-web build
```
