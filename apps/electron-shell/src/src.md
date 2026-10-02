# src

`apps/electron-shell/src` 是 Electron shell 源码层。这里按 Electron 进程边界拆分：main process、preload scripts、ActivityWindow renderer。

## 直接子节点

| 子节点 | 子文档 | 职责 |
|------|------|------|
| `main/` | [main/main.md](/Users/mu9/proj/handAgent/apps/electron-shell/src/main/main.md) | Electron main process：Swift bridge、agent-server supervisor、窗口生命周期和 command 路由 |
| `preload/` | [preload/preload.md](/Users/mu9/proj/handAgent/apps/electron-shell/src/preload/preload.md) | ThreadWindow / ActivityWindow 的受控 renderer globals 与 IPC 暴露 |
| `activity-window/` | [activity-window/activity-window.md](/Users/mu9/proj/handAgent/apps/electron-shell/src/activity-window/activity-window.md) | React 桌宠 renderer，通过 `/api/thread` 接收拖入、显示历史并回复 |
| `petWindowLayout.ts` | 无独立子文档 | renderer 与 main 共用的角色几何、默认比例、对话列与回复框尺寸及窗口布局合约 |

## 进程边界

- `main/` 可以使用 Electron main API、Node API 和 stdio，但不直接 import 或 new `AgentRuntime`、`ToolRegistry`、`LLMClient` 等 core runtime 对象。
- `main/` 除窗口和 supervisor 编排外，还负责从本地 action manifest 根目录（默认 `HANDAGENT_ACTIONS_DIR ?? ~/.spotAgent/actions`）读取配置，把启用项汇总为只读 `availableSkills` 并随 ThreadWindow preload 注入 renderer。
- `preload/` 是 renderer 能力边界，只能通过 `contextBridge` 暴露显式字段或 IPC 方法；源文件使用 `.cts`，构建产物是 Electron sandbox renderer 可加载的 CommonJS `.cjs`；不要开启 `nodeIntegration`，不要把 `ipcRenderer` 原样暴露出去。
- `activity-window/` 是 browser/React 代码，复用 `apps/thread-window-web` 的协议、store factory、输入控制器、socket 和附件 URL；原生窗口能力通过 preload 窄桥调用。
- `petWindowLayout.ts` 是跨进程的纯布局合约，不依赖 Electron 或 DOM。renderer 与窗口控制器共用角色右边缘距窗口左侧的固定坐标、右侧对话列和底部回复框尺寸；常态内容高度由 renderer 测量后交给 main 限制。修改时须同时核对[桌宠布局](./activity-window/activity-window.md)和[原生位置语义](./main/windows/windows.md)，角色大小偏好不改变该布局槽位。
- ThreadWindow renderer 复用 `apps/thread-window-web`；每宠窗口只增加轻量呈现、本宠选择与持久草稿，不创建另一套 Thread 历史或运行队列。

## 验证

- 改 main、preload、ActivityWindow renderer 任一目录后，至少运行 `pnpm --filter handagent-electron-shell test`。
- 改 main/preload 或 package 路径后，还要运行 `pnpm --filter handagent-electron-shell build`，确认 `dist/main/main.js` 与 `dist/preload/*.cjs` 输出存在。
