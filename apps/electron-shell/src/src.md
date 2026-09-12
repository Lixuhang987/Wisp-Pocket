# src

`apps/electron-shell/src` 是 Electron shell 源码层。这里按 Electron 进程边界拆分：main process、preload scripts、ActivityWindow renderer。

## 直接子目录

| 子目录 | 子文档 | 职责 |
|------|------|------|
| `main/` | [main/main.md](/Users/mu9/proj/handAgent/apps/electron-shell/src/main/main.md) | Electron main process：Swift bridge、agent-server supervisor、窗口生命周期和 command 路由 |
| `preload/` | [preload/preload.md](/Users/mu9/proj/handAgent/apps/electron-shell/src/preload/preload.md) | ThreadWindow / ActivityWindow 的受控 renderer globals 与 IPC 暴露 |
| `activity-window/` | [activity-window/activity-window.md](/Users/mu9/proj/handAgent/apps/electron-shell/src/activity-window/activity-window.md) | React 桌宠 renderer，通过 `/api/thread` 接收拖入、显示历史并回复 |

## 进程边界

- `main/` 可以使用 Electron main API、Node API 和 stdio，但不直接 import 或 new `AgentRuntime`、`ToolRegistry`、`LLMClient` 等 core runtime 对象。
- `main/` 除窗口和 supervisor 编排外，还负责从本地 action manifest 根目录（默认 `HANDAGENT_ACTIONS_DIR ?? ~/.spotAgent/actions`）读取配置，把启用项汇总为只读 `availableSkills` 并随 ThreadWindow preload 注入 renderer。
- `preload/` 是 renderer 能力边界，只能通过 `contextBridge` 暴露显式字段或 IPC 方法；源文件使用 `.cts`，构建产物是 Electron sandbox renderer 可加载的 CommonJS `.cjs`；不要开启 `nodeIntegration`，不要把 `ipcRenderer` 原样暴露出去。
- `activity-window/` 是 browser/React 代码，复用 `apps/thread-window-web` 的协议、store factory、socket 和附件 URL；原生窗口能力通过 preload 窄桥调用。
- ThreadWindow renderer 复用 `apps/thread-window-web`；桌宠只增加轻量呈现和本地选择状态，不创建另一套 Thread 历史或运行队列。

## 验证

- 改 main、preload、ActivityWindow renderer 任一目录后，至少运行 `pnpm --filter handagent-electron-shell test`。
- 改 main/preload 或 package 路径后，还要运行 `pnpm --filter handagent-electron-shell build`，确认 `dist/main/main.js` 与 `dist/preload/*.cjs` 输出存在。
