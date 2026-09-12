# main

`src/main` 是 Electron main process 源码层。它只负责进程和窗口编排：接收 Swift command、监督 agent-server、创建 Electron 窗口、回报事件。

## 直接子节点

| 子节点 | 子文档 | 职责 |
|------|------|------|
| `protocol/` | [protocol/protocol.md](/Users/mu9/proj/handAgent/apps/electron-shell/src/main/protocol/protocol.md) | Swift <-> Electron JSON command / event 类型与运行时校验 |
| `serverSupervisor/` | [serverSupervisor/serverSupervisor.md](/Users/mu9/proj/handAgent/apps/electron-shell/src/main/serverSupervisor/serverSupervisor.md) | agent-server 后台进程 supervisor，包含 utilityProcess 候选与 Node fallback |
| `swiftBridge/` | [swiftBridge/swiftBridge.md](/Users/mu9/proj/handAgent/apps/electron-shell/src/main/swiftBridge/swiftBridge.md) | stdio newline-delimited JSON bridge |
| `windows/` | [windows/windows.md](/Users/mu9/proj/handAgent/apps/electron-shell/src/main/windows/windows.md) | ThreadWindow hidden prewarm 与桌宠窗口、位置保存 |
| `main.ts` | 无独立文档 | Electron process 入口，组装 bridge、runtime、supervisor、window controllers 和 IPC；读取 `HANDAGENT_INITIAL_THEME` 和 action manifest 以初始化 renderer 必需 UI 配置，不读取或转发默认 dynamic tools |
| `electronShellRuntime.ts` | 无独立文档 | 可测试的 command / health / prewarm 状态机 |
| `initialHostTheme.ts` | 无独立文档 | 解析 `HANDAGENT_INITIAL_THEME`，为 Electron window controllers 提供启动期 host theme 初值 |
| `petWindowIpc.ts` | 无独立文档 | 校验当前桌宠 sender 和布局、命中区域、拖动 IPC |
| `macosDockApp.ts` | 无独立文档 | macOS regular activation policy 与 Dock 显示 |
| `availableSkills.ts` | 无独立文档 | 读取本地 action manifest 根目录（`~/.spotAgent/actions`），解析启用项的 `action.json`，输出只读 `AvailableSkill[]` 供 ThreadWindow preload 注入 |

## 运行时分层

- `main.ts` 是组合根：读取 env、创建 `JsonLineBridge`、`AgentServerSupervisor`、`ThreadWindowPrewarmer`、`ActivityWindowController`，在 `app.whenReady()` 后应用 macOS regular activation policy 并显示 Dock 图标，再把进程和窗口对象交给 `ElectronShellRuntime`。`HANDAGENT_INITIAL_THEME` 只作为启动期初值，必须经过 `initialHostTheme.ts` 校验后传给 window controllers。
- `ElectronShellRuntime` 不直接 import Electron API；它只依赖窗口、event output 和 supervisor 生命周期接口，负责 command ack、health gate、host theme fan-out 和预热重入。
- `petWindowIpc.ts` 只接受当前桌宠 `webContents`。拖动坐标由 main 读取系统光标；renderer 只上报本地 DOM 命中矩形及显式窗口意图。桥接合约见 [preload](../preload/preload.md)。
- 桌宠位置默认写入 `~/.spotAgent/pet-position.json`，路径由 main 注入。`HANDAGENT_PET_POSITION_PATH` 与 `HANDAGENT_PET_THREAD_WEBSOCKET_URL` 用于隔离原生 QA；URL 仍限 loopback `/api/thread`，由 preload 确保开启交互式请求。

## 状态机前提

- `agent_server.health available=true` 到达后，runtime 才主动调用 `prewarmer.prepare()`；Swift 不发送 `thread_window.prepare`。
- `theme.changed` command 必须同时调用 ThreadWindow prewarmer 和 ActivityWindow controller 的 `updateTheme()`；Electron main 保存并下发的是 Swift 已解析的 host theme，不在 renderer 侧持久化偏好。启动期同样使用 Swift 传入的 `{ preference, resolved }`，不要在 Electron main 固定 dark/light 或自行解析系统外观。
- ThreadWindow 预热时只把当前 host theme 与只读 `availableSkills` 传给 prewarmer；skills 由本地 action manifest 根目录（默认 `HANDAGENT_ACTIONS_DIR ?? ~/.spotAgent/actions`）读取。Electron 不读取 dynamic tool 环境变量，不向 ThreadWindow preload 传递默认 dynamic tools，不读取 plugin binary、不管理 plugin 生命周期。
- `prewarmAfterServerReadyPromise` 用来合并并发预热；改动预热流程时必须保持只发一次对应的 prepared / prepare_failed 结果。
- ThreadWindow 关闭后发送 `thread_window.closed`；如果窗口曾 prepared 且 agent-server 仍 available，runtime 会再次主动预热。桌宠保留同一 renderer 和当前 UI 状态。
- 桌宠点击、输入焦点、滚动和 drop 由 renderer 正常接收；ThreadWindow 的 show/focus 仍走独立 command 生命周期。
- `shutdown` command 要先 ack，再停止 supervisor 并退出 Electron；关闭 ThreadWindow 或 ActivityWindow 不能停止 agent-server。

## 输出规则

- stdout 只写给 Swift 的 JSON event line；普通日志写 stderr。
- agent-server stdout/stderr 会被 supervisor 加前缀后写 stderr，不能混入 stdout，否则 Swift decoder 会尝试当作事件解析。
