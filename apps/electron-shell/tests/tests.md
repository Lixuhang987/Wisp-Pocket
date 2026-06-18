# tests

`apps/electron-shell/tests` 是 Electron shell 的 Vitest 测试集合。当前以 `use-cases/` 里的主路径测试为入口，配合 `preload/`、`protocol/`、`serverSupervisor/`、`swiftBridge/`、`windows/` 等目录中保留的边界测试覆盖 preload、protocol 和 supervisor 等高风险合约。测试运行在 Node test environment；Electron API 通过 fake objects、`vi.doMock("electron", ...)` 或 Node CJS module load mock 注入。

## 直接子节点

| 子节点 | 子文档 | 职责 |
|------|------|------|
| `use-cases/` | 无独立子文档 | `desktop-startup`、`thread-window-commands`、`activity-window` 等主路径用例 |
| `activity-window/` | [activity-window/activity-window.md](/Users/mu9/proj/handAgent/apps/electron-shell/tests/activity-window/activity-window.md) | Activity renderer 的 activity event parser、重连和展示状态 |
| `main/` | [main/main.md](/Users/mu9/proj/handAgent/apps/electron-shell/tests/main/main.md) | `ElectronShellRuntime` command / health / prewarm 状态机，以及 ActivityWindow IPC sender 校验 |
| `preload/` | [preload/preload.md](/Users/mu9/proj/handAgent/apps/electron-shell/tests/preload/preload.md) | preload 注入的 main-world globals 和 IPC bridge |
| `protocol/` | [protocol/protocol.md](/Users/mu9/proj/handAgent/apps/electron-shell/tests/protocol/protocol.md) | Swift <-> Electron command/event 解析、编码和拒绝旧 `thread_window.prepare` command |
| `serverSupervisor/` | [serverSupervisor/serverSupervisor.md](/Users/mu9/proj/handAgent/apps/electron-shell/tests/serverSupervisor/serverSupervisor.md) | supervisor entry 选择、Node fallback、utilityProcess 语义、readiness、restart 和 stop |
| `swiftBridge/` | [swiftBridge/swiftBridge.md](/Users/mu9/proj/handAgent/apps/electron-shell/tests/swiftBridge/swiftBridge.md) | newline-delimited JSON bridge 与 command socket 的 chunk 切行和 event 写出 |
| `windows/` | [windows/windows.md](/Users/mu9/proj/handAgent/apps/electron-shell/tests/windows/windows.md) | ThreadWindow hidden prewarm、initial prompt 注入、ActivityWindow 非激活展示 |
| `smoke.test.ts` | 无独立文档 | Electron shell test runtime 基础 smoke |

## 运行方式

```bash
pnpm --filter handagent-electron-shell test
pnpm --filter handagent-electron-shell build
```

- `pnpm --filter handagent-electron-shell test` 现在会先执行 `tsc -p tsconfig.json`，生成 `dist/main/*` 和 `dist/preload/*.cjs`，因为 `tests/preload/*` 直接加载 CommonJS preload 产物验证 main-world globals。

单文件示例：

```bash
pnpm --filter handagent-electron-shell exec vitest run tests/use-cases/thread-window-commands.test.ts
```

## 新增测试约束

- 新增 `src/main/*` 行为时，优先把 Electron API 抽成 fakeable interface，避免启动真实 Electron。
- 新增 Swift bridge command/event 时，必须同时覆盖 protocol parser/encoder 和 runtime ack 语义；相关断言优先放进已有的 `protocol/`、`preload/` 或 `serverSupervisor/` 边界测试目录。
- 新增 preload global 时，验证 `contextBridge` 调用，不依赖真实 renderer；测试 `.cjs` preload 产物时要在 Node module load 层 mock `require("electron")`，因为 `vi.doMock("electron", ...)` 不会拦截 CJS `require`。
- 新增 supervisor 行为时，覆盖用户主动 stop、readiness late resolve、非零退出 restart、最大重启次数四类边界。
- ActivityWindow renderer 测试只验证 `/api/activity` 和 UI state，不引入 `/api/thread` fixture。
