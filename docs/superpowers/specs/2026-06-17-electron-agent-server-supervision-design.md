# Electron agent-server 统一守护设计

## 背景

当前产品入口已经切到 `Swift desktop -> Electron shell -> React ThreadWindow`。agent-server 仍是独立 Node 运行时，承载 `packages/core` 的 thread、LLM、tool 和持久化组合根。

本次目标不是把 runtime 合并进 Electron main，也不是调整 ThreadWindow 的 `/api/thread` 连接拓扑。目标是明确并补齐一条运行时不变量：agent-server 的进程生命周期只归 Electron main 管，Swift 和 renderer 都不能直接启动、停止或重启 agent-server。

## 现状判断

代码里已经存在 Electron 侧 supervisor 基础：

- `apps/electron-shell/src/main/main.ts` 在 `app.whenReady()` 后创建并启动 agent-server supervisor。
- `serverSupervisor/` 已拆出 `NodeAgentServerSupervisor` 与 `UtilityProcessAgentServerSupervisor`。
- `ElectronShellRuntime` 已把 `agent_server.health` 转发给 Swift，并在 server ready 后预热 ThreadWindow。
- Swift 侧 `AgentServer` 文档已经写明 Swift 不再启动 agent-server，只保留健康状态、平台桥连接和 Electron launch 所需能力。

仍需通过 spec 固化的点是：后台常驻语义、唯一 owner 语义、异常重启语义、关闭窗口不停止服务、主动退出才停止服务，以及测试和文档验收边界。

## 目标

1. Electron main 是 agent-server 的唯一 supervisor。
2. agent-server 随 Electron shell 启动，在后台持续运行。
3. 关闭 ThreadWindow、隐藏预热窗口或 ActivityWindow 不停止 agent-server。
4. agent-server 非主动退出、ready 失败或进程错误时，由 Electron main 指数退避重启。
5. Swift 只观察 `agent_server.health`，不拥有 Node 子进程，不实现重启策略。
6. renderer 只消费协议，不拥有 agent-server 进程生命周期。

## 非目标

- 不把 `AgentRuntime`、tool registry、LLM client 或 thread store 合并进 Electron main。
- 不把 ThreadWindow 的 `/api/thread` WebSocket 改成 Electron IPC 或 main-process proxy。
- 不改 `/api/activity` 与 `/api/platform` 的协议边界。
- 不迁移 PromptPanel、Settings、Hotkey、焦点恢复或 macOS 原生 platform tool。
- 不新增跨机器 server 模式；agent-server 仍只监听本机回环地址。

## 方案选择

### 推荐方案：Electron main supervisor + 独立 agent-server 进程

Electron main 在启动完成后拉起 agent-server，优先使用 Electron `utilityProcess` 承载构建后的 JS entry；开发态或构建产物缺失时 fallback 到 Node child process 运行 TypeScript 源码入口。

该方案保留 runtime 独立进程边界，同时让生命周期进入 Electron 生态。Electron main 负责 health、重启、日志转写、shutdown 和窗口 ready gate。Swift 不再有 agent-server 子进程概念。

### 备选方案：把 agent-server runtime 内嵌到 Electron main

该方案会减少一个进程，但会把 Electron main 变成 UI 编排、LLM/tool runtime、WebSocket server、SQLite 持久化的混合组合根。它会扩大 main process 崩溃半径，也会让 renderer/window 生命周期和长任务 runtime 更难隔离。

不采用。

### 备选方案：Swift 继续守护 agent-server，Electron 只承载 UI

该方案与“放到 Electron 生态里，后台持续运行”的目标相反，会保留 Swift 与 Electron 双 owner 风险。Electron 窗口 ready、ThreadWindow 预热和 agent-server health gate 仍要跨两套生命周期协调。

不采用。

## 架构不变量

### 进程所有权

- 只有 Electron main 可以调用 `supervisor.start()`、`supervisor.stop()` 或调度重启。
- Swift 不得新增 Node process launcher，也不得通过 shell 命令启动 `apps/agent-server`。
- renderer 不得 import supervisor、fork 子进程或通过 IPC 请求启动/停止 agent-server。
- `AgentServerSupervisorDescription.coreRuntimeHost` 固定为 `"agent-server"`，用于防止把 core runtime 偷偷搬进 Electron main。

### 启动顺序

1. Swift 启动 Electron shell。
2. Electron main 完成 `app.whenReady()`。
3. Electron main 应用 macOS accessory/background policy。
4. Electron main 启动 command socket。
5. Electron main 向 Swift 发送 `electron.ready`。
6. Electron main 记录 supervisor mode。
7. Electron main 调用 `supervisor.start()`。
8. supervisor readiness 成功后发送 `agent_server.health available=true`。
9. `ElectronShellRuntime` 收到 available 后预热 hidden ThreadWindow。

`thread_window.prepared` 不能早于 `agent_server.health available=true`。Swift 的可提交状态仍由 `agent_server.health available=true` 与 `thread_window.prepared` 共同决定。

### 后台常驻

- agent-server 是 Electron shell 生命周期内的后台服务。
- hidden ThreadWindow 关闭、visible ThreadWindow 关闭、ActivityWindow 关闭、renderer crash 都不能直接停止 agent-server。
- visible ThreadWindow 关闭后，如果 agent-server 仍 available，Electron main 应重新预热 hidden ThreadWindow。
- 只有 Electron shell shutdown、Electron app quit、Swift 主动停止 Electron shell，才会调用 `supervisor.stop()`。

### 重启语义

以下情况视为 supervisor failure：

- agent-server 非 0 退出。
- agent-server process error。
- readiness check 超时或失败。
- `utilityProcess` error。

failure 后必须：

1. 发送 `agent_server.health available=false`，附带可诊断 message。
2. 按指数退避重启，默认上限 5 次。
3. 超过上限后发送最终 unavailable message，不继续重启。
4. 主动 `stop()` 后递增 generation，阻止旧 readiness 或 restart callback 复活旧进程。

### 日志边界

- Electron -> Swift 的 stdout 只允许 newline-delimited JSON event。
- agent-server stdout/stderr 必须由 supervisor drain，并加前缀写入 stderr 或测试注入的 log sink。
- supervisor mode、entry、utilityProcess blocker 必须写入 stderr，方便判断当前运行在 `utility_process` 还是 `node_child`。

## 组件职责

### `apps/electron-shell/src/main/main.ts`

- 作为 Electron main 组合根创建 supervisor。
- 在 `app.whenReady()` 后启动 supervisor。
- 监听 supervisor health 并交给 `ElectronShellRuntime`。
- 在 `before-quit`、stdin end 或 `shutdown` command 中停止 supervisor。
- 不能 import `@handagent/core/runtime`、tool registry 或 LLM client。

### `apps/electron-shell/src/main/serverSupervisor/`

- 定义 supervisor 抽象和两种实现。
- `UtilityProcessAgentServerSupervisor` 用于构建后 entry。
- `NodeAgentServerSupervisor` 用于开发态 fallback。
- 两种实现必须共享 health、ready、restart、stop、日志 drain 的语义。

### `apps/electron-shell/src/main/electronShellRuntime.ts`

- 只消费 `agent_server.health`。
- available 后触发 hidden ThreadWindow 预热。
- `shutdown` command 必须先 ack，再 stop supervisor，再 quit。
- 不直接操作 child process 或 utility process。

### `apps/desktop/Sources/AppServices/AgentServer/`

- Swift 只暴露 app-server health、fatal error、host termination request 和 `/api/platform` client。
- `AgentServerHealth` 只观察 ElectronBackedAppServer 的 availability。
- 不重新引入 Swift agent-server launcher。

## 验证要求

### TypeScript 单元测试

必须覆盖：

- `NodeAgentServerSupervisor.start()` 只启动一次。
- Node fallback 使用 repo root 作为 cwd，并运行 `apps/agent-server/src/server/server.ts`。
- readiness 成功后发送 `available=true`。
- readiness 失败会 kill 当前进程、发送 unavailable，并调度重启。
- 非主动 exit/error 会调度指数退避重启。
- `stop()` 会发送 stopped health，并阻止旧 generation 的 readiness/restart 回调。
- 超过最大重启次数后发送最终 unavailable，不再重启。
- `UtilityProcessAgentServerSupervisor` 与 Node fallback 具备同等 stop/restart/health 语义。
- `createAgentServerSupervisor()` 在构建后 entry 存在且 Electron 提供 `utilityProcess.fork` 时选择 utility process；否则选择 Node fallback，并保留 blocker。
- `ElectronShellRuntime` 在 available 后只合并一次并发 prewarm，unavailable 不触发 prewarm。
- `shutdown` command 的顺序是 ack、stop supervisor、quit。

### Swift 单元测试

必须覆盖：

- `ElectronBackedAppServer` 的 availability 仍由 `agent_server.health available=true` 与 `thread_window.prepared` 共同决定。
- `agent_server.health available=false` 会断开 `/api/platform`。
- Swift stop 只停止 Electron shell，不直接停止 Node agent-server。
- 非主动 Electron clean exit 与 fatal exit 的处理不被 agent-server supervisor 改动破坏。

### 集成验证

必须运行：

```bash
bash ./scripts/test.sh
bash ./scripts/swiftw test
bash ./scripts/swiftw build
```

涉及 packaged app 或 `utilityProcess` entry 时，还必须验证：

```bash
pnpm --filter handagent-electron-shell build
bash ./scripts/package-app.sh --mock-llm
```

## 手工 QA

`docs/manual-qa.md` 需要新增或确认以下条目：

1. 冷启动桌面 App 后，不打开 ThreadWindow，agent-server 仍由 Electron main 拉起并上报 available。
2. 关闭 visible ThreadWindow 后，agent-server 不退出，随后再次打开 ThreadWindow 不需要重新启动 agent-server。
3. 关闭 ActivityWindow 后，agent-server 不退出。
4. 主动退出桌面 App 后，Electron shell 停止 agent-server，不遗留 `4317` 监听进程。
5. mock LLM 打包模式下，agent-server 仍由 Electron supervisor 注入 `HANDAGENT_LLM_MODE=mock`。

## 文档更新要求

实现该 spec 时，如代码或行为变化影响现有描述，必须同步检查并更新：

- `handAgent.md`
- `apps/apps.md`
- `apps/electron-shell/electron-shell.md`
- `apps/electron-shell/src/main/main.md`
- `apps/electron-shell/src/main/serverSupervisor/serverSupervisor.md`
- `apps/desktop/Sources/AppServices/AgentServer/agent-server.md`
- `apps/desktop/Sources/AppServices/ElectronShell/electron-shell.md`
- `docs/manual-qa.md`

若最终实现确认现有文档已经准确，也必须在完成说明中明确写出无需更新的原因。
