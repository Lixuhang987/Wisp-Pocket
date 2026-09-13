# tests

`apps/electron-shell/tests` 通过主路径和边界用例验证窗口、preload、协议与 supervisor。默认运行于 Node；React 交互用例声明 JSDOM。Electron API 通过 fake objects 或 Node CJS module load mock 注入。

## 直接子节点

| 子节点 | 子文档 | 职责 |
|------|------|------|
| `use-cases/` | 无独立子文档 | `desktop-startup`、`thread-window-commands`、`pet-window` 与真实进程管道的 `host-shutdown` 用例 |
| `activity-window/` | [activity-window/activity-window.md](/Users/mu9/proj/handAgent/apps/electron-shell/tests/activity-window/activity-window.md) | 桌宠 React 交互、Thread 消息呈现和拖入分流 |
| `main/` | [main/main.md](/Users/mu9/proj/handAgent/apps/electron-shell/tests/main/main.md) | 初始主题和 macOS Dock 策略 |
| `preload/` | [preload/preload.md](/Users/mu9/proj/handAgent/apps/electron-shell/tests/preload/preload.md) | preload 注入的 main-world globals 和 IPC bridge |
| `protocol/` | [protocol/protocol.md](/Users/mu9/proj/handAgent/apps/electron-shell/tests/protocol/protocol.md) | Swift <-> Electron command/event 解析、编码和拒绝旧 `thread_window.prepare` command |
| `serverSupervisor/` | [serverSupervisor/serverSupervisor.md](/Users/mu9/proj/handAgent/apps/electron-shell/tests/serverSupervisor/serverSupervisor.md) | supervisor entry 选择、Node fallback、utilityProcess 语义、readiness、restart 和 stop |
| `swiftBridge/` | [swiftBridge/swiftBridge.md](/Users/mu9/proj/handAgent/apps/electron-shell/tests/swiftBridge/swiftBridge.md) | newline-delimited JSON bridge 与 command socket 的 chunk 切行和 event 写出 |
| `windows/` | [windows/windows.md](/Users/mu9/proj/handAgent/apps/electron-shell/tests/windows/windows.md) | ThreadWindow hidden prewarm、initial prompt 注入、桌宠主题与加载边界 |
| `smoke.test.ts` | 无独立文档 | Electron shell test runtime 基础 smoke |

## 运行方式

```bash
pnpm --filter handagent-electron-shell test
pnpm --filter handagent-electron-shell build
```

- `pnpm --filter handagent-electron-shell test` 现在会先执行 `tsc -p tsconfig.json`，生成 `dist/main/*` 和 `dist/preload/*.cjs`，因为 `tests/preload/*` 直接加载 CommonJS preload 产物验证 main-world globals。
- `host-shutdown` 消费构建后的真实 parser、runtime 与 bridge，以 Node 子进程的 stdout 管道验证正常 ack、读取端关闭后的退出及非 `EPIPE` 错误可见性。`stopSupervisor` / `quit` 使用边界回调记录；测试证明这些调用与 Node 测试进程退出，不替代真实 Electron、agent-server 进程清理的实机证据。

单文件示例：

```bash
pnpm --filter handagent-electron-shell exec vitest run tests/use-cases/thread-window-commands.test.ts
```

## 新增测试约束

- 新增 `src/main/*` 行为时，优先把 Electron API 抽成 fakeable interface，避免启动真实 Electron。
- 新增 Swift bridge command/event 时，必须同时覆盖 protocol parser/encoder 和 runtime ack 语义；相关断言优先放进已有的 `protocol/`、`preload/` 或 `serverSupervisor/` 边界测试目录。
- 新增 preload global 时，验证 `contextBridge` 调用，不依赖真实 renderer；测试 `.cjs` preload 产物时要在 Node module load 层 mock `require("electron")`，因为 `vi.doMock("electron", ...)` 不会拦截 CJS `require`。
- 新增 supervisor 行为时，覆盖用户主动 stop、readiness late resolve、非零退出 restart、最大重启次数四类边界。
- 桌宠 renderer 复用 `/api/thread` fixture；真实 Thread/SQLite/Blob 编排由 agent-server `pet-conversation` 覆盖。`pet-window` 从真实 preload 经 IPC 验证角色锚点的保存/恢复、对话列向右展开与上边缘高度限制；断言须区分角色右下角和窗口右边界。Electron 与系统屏幕使用替身，不能据此宣称原生视觉通过。
- `.test.tsx` 必须进入 Vitest include；UI 断言不能替代 macOS 实机的跨应用拖放、焦点、滚动与透明穿透。
