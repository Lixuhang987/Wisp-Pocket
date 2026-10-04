# thread-window-web

`apps/thread-window-web` 实现 Electron 设置与 [ThreadWindow](/Users/mu9/proj/handAgent/apps/desktop/CONTEXT.md)。它由 Electron UI Shell 承载，直接消费 Conversation Runtime 协议。

## 直接子节点

- [src/src.md](/Users/mu9/proj/handAgent/apps/thread-window-web/src/src.md)：React 源码索引、状态所有权和交互约束。
- [tests/tests.md](/Users/mu9/proj/handAgent/apps/thread-window-web/tests/tests.md)：Web 用例与边界测试。
- `package.json`：test/build 入口。
- `vite.config.ts`、`tsconfig.json`：浏览器 bundle 与类型检查。

## 运行边界

- ThreadWindow 持有 `/api/thread?acceptServerRequests=1` 长连接；[桌宠](../electron-shell/electron-shell.md)复用本包客户端与投影，各界面共享后端 Thread 身份及历史。
- 设置通过 `/api/settings/*` 管理模型 / 工具配置，通过 `/api/thread` 管理 Workspace 与历史；Pet 资料、图片和分配由 Electron 前端桥拥有。普通 ThreadWindow 不获得伙伴管理能力。两处伙伴管理复用表单与 revision 合同，桥定义见 [源码入口](./src/src.md)。
- Swift 只提交 PromptPanel / AgentTrigger 首轮输入；Electron main 拥有窗口与前端 Pet store。两者都不 mirror React 的 Thread 消息状态。
- [preload](../electron-shell/src/preload/preload.md) 只注入 WebSocket URL、只读 Append Prompt 候选、主题、initial-prompt fallback 与明确目标 Thread 的打开请求。React 不接触 Dynamic Tool spec。
- 非主动断开后只进入 disconnected 状态；当前不重连、不恢复订阅、不自动拉取 snapshot。
- 主题由宿主解析，React 只应用 resolved theme；设计 token 来源是 `design/tokens.json`。

## 协议边界

- 类型真相在 [core protocol](/Users/mu9/proj/handAgent/packages/core/src/protocol/protocol.md)；Web 侧只做 encode、guard 和 UI 投影。
- ThreadWindow 列出全部 Workspace，历史只按项目一级分组；新建只确定项目，创建 payload 必须含 workspaceId。桌宠按工作区查询历史，各前端独立持导航与草稿，不互相控制选择。
- `thread.resume` 是点击历史或宿主明确打开目标 Thread 的加载入口，不是断线恢复；选择规则由 [App](./src/src.md) 拥有。
- Permission 请求必须以 `ClientResponse` 回覆；不要转成普通 `op.submit`。
- 两端可同时显示同一请求，由 core 消耗首次有效回执；`request.resolved` 和 snapshot 同步请求状态。建议按钮则发送普通 UserInput。
- Composer 在执行中照常提交，由后端持久队列接收；消息中的 pending 表示已保存待处理，前端不再持有执行队列。
- Stop 发送 Interrupt，不通过关闭 socket 表达中断。

## 验证

```bash
pnpm --filter handagent-thread-window-web test
pnpm --filter handagent-thread-window-web build
```
