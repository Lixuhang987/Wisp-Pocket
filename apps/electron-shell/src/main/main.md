# main

`src/main` 是 Electron main process 源码层。它负责前端 Pet store、进程和窗口编排：接收 Swift command、监督 agent-server、创建 Electron 窗口、回报事件。

## 直接子节点

| 子节点 | 子文档 | 职责 |
|------|------|------|
| `protocol/` | [protocol/protocol.md](/Users/mu9/proj/handAgent/apps/electron-shell/src/main/protocol/protocol.md) | Swift <-> Electron JSON command / event 类型与运行时校验 |
| `serverSupervisor/` | [serverSupervisor/serverSupervisor.md](/Users/mu9/proj/handAgent/apps/electron-shell/src/main/serverSupervisor/serverSupervisor.md) | agent-server 后台进程 supervisor，包含 utilityProcess 候选与 Node fallback |
| `swiftBridge/` | [swiftBridge/swiftBridge.md](/Users/mu9/proj/handAgent/apps/electron-shell/src/main/swiftBridge/swiftBridge.md) | stdio newline-delimited JSON bridge |
| `pets/` | [pets/pets.md](./pets/pets.md) | 前端唯一伙伴 store、资料和原子分配持久化 |
| `windows/` | [windows/windows.md](/Users/mu9/proj/handAgent/apps/electron-shell/src/main/windows/windows.md) | ThreadWindow hidden prewarm 与桌宠窗口、位置保存 |
| `main.ts` | 无独立文档 | Electron process 入口，组装 bridge、runtime、supervisor、window controllers 和 IPC；读取 `HANDAGENT_INITIAL_THEME` 和 action manifest 以初始化 renderer 必需 UI 配置，不读取或转发默认 dynamic tools |
| `electronShellRuntime.ts` | 无独立文档 | 可测试的 command / health / prewarm 状态机 |
| `initialHostTheme.ts` | 无独立文档 | 解析 `HANDAGENT_INITIAL_THEME`，为 Electron window controllers 提供启动期 host theme 初值 |
| `settingsManagementIpc.ts` | 无独立文档 | 设置/桌宠管理 sender 校验、目录/图片 picker 与全宠显示意图；资料写入前端 store；Workspace/Thread 校验走通用后端协议 |
| `petWindowIpc.ts` | 无独立文档 | 校验当前桌宠 sender 和布局、可选内容高度、命中区域、拖动 IPC |
| `macosDockApp.ts` | 无独立文档 | macOS regular activation policy 与 Dock 显示 |
| `availableSkills.ts` | 无独立文档 | 读取本地 action manifest 根目录（`~/.spotAgent/actions`），解析启用项的 `action.json`，输出只读 `AvailableSkill[]` 供 ThreadWindow preload 注入 |

## 运行时分层

- `main.ts` 是组合根：读取 env、创建 `JsonLineBridge`、`AgentServerSupervisor`、`ThreadWindowPrewarmer`、`PetWindowCollection`，在 `app.whenReady()` 后应用 macOS regular activation policy 并显示 Dock 图标，再把进程和窗口对象交给 `ElectronShellRuntime`。`HANDAGENT_INITIAL_THEME` 只作为启动期初值，必须经过 `initialHostTheme.ts` 校验后传给 window controllers。
- `ElectronShellRuntime` 不直接 import Electron API；它只依赖窗口、event output 和 supervisor 生命周期接口，负责 command ack、health gate、host theme fan-out 和预热重入。
- `thread_window.focus` 携带非空目标 ID 时，runtime 必须交给 prewarmer 的目标打开入口，即使窗口已经可见；无目标时才沿窗口级 focus/openHistory 路径。交付与回执边界见 [protocol](./protocol/protocol.md)。
- `petWindowIpc.ts` 从登记的 sender 解析所属宠窗，校验布局与可选内容高度；高度只是窗口布局建议，不包含消息。拖动坐标由 main 读取系统光标；renderer 上报本地 DOM 命中矩形及显式窗口意图。桥接合约见 [preload](../preload/preload.md)。
- 伙伴资料、关联、显隐、大小和位置统一写入 `~/.spotAgent/pets.json`，由 `HANDAGENT_PET_STORE_PATH` 隔离；位置适配器保持屏幕锚点语义。`HANDAGENT_PET_THREAD_WEBSOCKET_URL` 用于隔离原生 QA；URL 仍限 loopback `/api/thread`，由 preload 确保开启交互式请求。

## 状态机前提

- `agent_server.health available=true` 到达后，runtime 才主动调用 `prewarmer.prepare()`；Swift 不发送 `thread_window.prepare`。
- `theme.changed` command 必须同时调用 ThreadWindow、独立设置窗口和 ActivityWindow controller 的 `updateTheme()`；Electron main 保存并下发的是 Swift 已解析的 host theme，不在 renderer 侧持久化偏好。启动期同样使用 Swift 传入的 `{ preference, resolved }`，不要在 Electron main 固定 dark/light 或自行解析系统外观。
- ThreadWindow 预热时只把当前 host theme 与只读 `availableSkills` 传给 prewarmer；skills 由本地 action manifest 根目录（默认 `HANDAGENT_ACTIONS_DIR ?? ~/.spotAgent/actions`）读取。Dynamic Tool 的声明、调用与内置模块生命周期由 Swift Host 管理，Electron 不向 ThreadWindow preload 传递默认 dynamic tools。
- `prewarmAfterServerReadyPromise` 用来合并并发预热；改动预热流程时必须保持只发一次对应的 prepared / prepare_failed 结果。
- ThreadWindow 关闭后发送 `thread_window.closed`；如果窗口曾 prepared 且 agent-server 仍 available，runtime 会再次主动预热。各可见宠独立保留 renderer；隐藏角色在接收确认后回收窗口。
- 桌宠点击、输入焦点、滚动和 drop 由 renderer 正常接收；ThreadWindow 的 show/focus 仍走独立 command 生命周期。
- `shutdown` command 要先 ack，再停止 supervisor 并退出 Electron；关闭 ThreadWindow 或 ActivityWindow 不能停止 agent-server。

## 输出规则

- stdout 只写给 Swift 的 JSON event line；普通日志写 stderr。
- agent-server stdout/stderr 会被 supervisor 加前缀后写 stderr，不能混入 stdout，否则 Swift decoder 会尝试当作事件解析。

- `settings.open` 复用窗口加载控制器的独立实例，加载 ThreadWindow Web 的 `surface=settings`；不预热，不参与 ThreadWindow availability，不经 renderer 注入改页。已有窗口只 focus，关闭重建默认模型服务页。管理 IPC 只接受当前设置窗口或登记桌宠 sender，普通 ThreadWindow 无权限。
