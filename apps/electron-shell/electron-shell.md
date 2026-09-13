# electron-shell

`apps/electron-shell` 是 [Electron UI Shell](/Users/mu9/proj/handAgent/apps/desktop/CONTEXT.md)：承载 ThreadWindow、桌宠，并作为 agent-server 的唯一 supervisor。

## 直接子节点

- [src/src.md](/Users/mu9/proj/handAgent/apps/electron-shell/src/src.md)：main、preload 与桌宠 renderer。
- [tests/tests.md](/Users/mu9/proj/handAgent/apps/electron-shell/tests/tests.md)：Electron shell 测试索引。
- `package.json`：test/build 入口与运行依赖。
- `tsconfig*.json`、`vite.activity-window.config.ts`：main/preload 与 renderer 构建边界。

## 所有权

- command socket 接收 Swift 意图，stdout NDJSON 回写 shell event。
- agent-server ready 后由 Electron main 预热 hidden ThreadWindow；Swift 不发送 prepare command。
- ThreadWindow 的 open/focus/close 与桌宠窗口的显示、位置和命中由 Electron main 管理；桌宠的回复、历史和气泡显隐由 renderer 管理。
- 关闭 UI 窗口不停止 agent-server；Electron shutdown 才停止 supervisor。
- 主题初值来自 `HANDAGENT_INITIAL_THEME`，后续 `theme.changed` 同步到两个 renderer；renderer 不持久化主题偏好。角色大小是[桌宠 renderer](./src/src.md)独立保存的本地界面偏好。

## 安全边界

- renderer 使用 `contextIsolation: true`、`nodeIntegration: false`；preload 只暴露受控配置与回调。
- React ThreadWindow 和桌宠直接连接 `/api/thread?acceptServerRequests=1`，共享后端历史与请求。Electron main 不 mirror Thread 消息。
- Swift Host 继续拥有 PromptPanel、Settings、AgentTrigger、焦点恢复和 Dynamic Tool Provider；本包不实现 macOS 能力或管理内置业务模块生命周期。
- ThreadWindow 当前不做断线恢复；桌宠重连后重新列出并恢复最新创建的 Thread，保持本次 renderer 的隐藏状态。

## Supervisor 与构建

- supervisor 优先使用构建后的 agent-server entry；不可用时走 Node child fallback。两条路径必须保持 health、日志、退避重启和 shutdown 语义一致。
- main/preload 修改后必须运行完整 build，确保 `.cts` preload 输出为 sandbox 可加载的 `.cjs`，并生成 ActivityWindow bundle。

```bash
pnpm --filter handagent-electron-shell test
pnpm --filter handagent-electron-shell build
```
