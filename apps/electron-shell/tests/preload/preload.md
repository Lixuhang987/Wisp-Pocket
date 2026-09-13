# preload

`tests/preload` 覆盖 preload scripts 暴露给 renderer main world 的受控 globals。

## 文件

| 文件 | 覆盖对象 |
|------|------|
| `threadWindowPreload.test.ts` | ThreadWindow preload 的 `/api/thread` config、`availableSkills` 注入、host theme 注入与回放、pending initial prompt receiver 和既有 receiver 保留 |
| `activityWindowPreload.test.ts` | 桌宠 preload 的 Thread endpoint、隔离 QA URL、host theme 与最小窗口能力边界 |

## 测试前提

- preload 单测加载 `dist/preload/*.cjs` 产物，先运行 `pnpm --filter handagent-electron-shell build`。
- 使用 Node module load mock 拦截 CJS `require("electron")`，注入 fake `contextBridge` / `ipcRenderer`，不加载真实 Electron。
- ThreadWindow preload 测试要在 fake main world 中执行 `executeInMainWorld` 的 `func`，确认 globals 写入结果。
- ThreadWindow 和 ActivityWindow preload 测试要覆盖 `additionalArguments` 里的初始 host theme fallback / parse、`handagent:theme-changed` payload 过滤、订阅前 latest theme 回放和 unsubscribe。
- 新增 preload API 时，必须测试它没有暴露原始 `ipcRenderer` 或 Node/Electron 对象。
- 桌宠 `handAgentPet` 的完整调用路径在 `tests/use-cases/pet-window.test.ts` 验证：加载真实 `.cjs` preload，经过 IPC sender / payload 校验后驱动真实窗口控制器和位置文件。
