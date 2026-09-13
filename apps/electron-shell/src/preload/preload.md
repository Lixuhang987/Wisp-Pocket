# preload

`preload/` 是 Electron renderer 的能力边界。ThreadWindow 和 ActivityWindow 都在 `contextIsolation: true`、`nodeIntegration: false` 下运行，只能使用这里显式暴露的 globals。

preload 源文件使用 `.cts`，由 TypeScript 编译为 `dist/preload/*.cjs`。Electron main 必须把 `BrowserWindow.webPreferences.preload` 指向 `.cjs` 产物，避免 sandboxed renderer 不能加载 ESM `.js` preload 时丢失 `handAgentTheme` 和 theme subscription。

## 文件

| 文件 | 职责 |
|------|------|
| `threadWindowPreload.cts` | 向 ThreadWindow main world 注入 `/api/thread` URL、`availableSkills`、host theme、theme change subscription、pending initial prompt 队列和临时 receiver |
| `activityWindowPreload.cts` | 向桌宠 main world 注入 Thread URL、host theme、theme subscription 与受控窗口 IPC |

## ThreadWindow preload

- 通过 `contextBridge.executeInMainWorld()` 写入 `window.handAgentThreadWindowConfig.threadWebSocketURL`、`window.handAgentThreadWindowConfig.availableSkills` 和 `window.handAgentTheme`。
- preload 自身持续监听 `handagent:theme-changed`，只接受已校验的 `HostTheme` payload，并保存 latest theme；`handAgentSubscribeThemeChange(handler)` 订阅时会先回放 latest theme，再接收后续变化，不暴露原始 `ipcRenderer`。
- 初始化 `window.handAgentPendingInitialPrompts`，并在 React receiver 尚未安装时提供临时 `window.handAgentReceiveInitialPrompt(payload)`。
- 如果 React 已经安装正式 receiver，preload 必须保留它，不覆盖。
- `availableSkills` 只接受 `actionId/title/prompt/description?` 这组只读字段；preload 负责从 `--handagent-available-skills=...` 参数解码并做最小校验，renderer 不得直接拿到 Node 文件系统或宿主 skill 源目录访问能力。
- `handAgentElectron` 只暴露轻量 feature marker，不提供 Electron 或 Node 能力。

## 桌宠 ActivityWindow preload

- 通过 `contextBridge.executeInMainWorld()` 写入 `window.handAgentActivityWindowConfig.threadWebSocketURL` 和 `window.handAgentTheme`。桌宠直接连接 `/api/thread?acceptServerRequests=1`，与 ThreadWindow 共用会话和交互式请求协议。
- preload 自身持续监听 `handagent:theme-changed`，只接受已校验的 `HostTheme` payload，并保存 latest theme；`handAgentSubscribeThemeChange(handler)` 订阅时会先回放 latest theme，再接收后续变化，不暴露原始 `ipcRenderer`。
- `handAgentPet` 只暴露 `setLayout("pet" | "compact" | "expanded")`、`setInteractiveRegions(rectangles)` 和无参数的 `beginMove` / `move` / `endMove`。矩形使用当前 renderer viewport 的本地坐标；布局、DOM 尺寸或滚动变化后重新上报，可见气泡与历史裁剪规则由 [renderer](../activity-window/activity-window.md)维护。
- main 校验 sender 是当前桌宠 `webContents`，并校验布局、有限矩形和参数数量；拖动始终由 main 读取系统光标，不接受 renderer 提交屏幕坐标。窗口侧合约见 [windows](../main/windows/windows.md)。
- 隔离原生 QA 可由 main 的 additional arguments 覆盖 loopback Thread endpoint；preload 限定 `ws:`、loopback host、`/api/thread`，并确保 `acceptServerRequests=1`。

## 修改约束

- 不暴露 `ipcRenderer`、`require`、文件系统、process env 或任意 Node/Electron 对象。
- 新增 renderer 能力必须是最小函数或只读 config，并在 main 侧做 sender / payload 校验。
- 改 window global 名称时，必须同步更新对应 React renderer、`apps/thread-window-web` native config 测试，以及 `tests/preload/*`。
- 改 preload 文件类型、输出路径或打包路径时，必须同时验证 `dist/preload/*.cjs` 和 packaged app 内 `Contents/Resources/ElectronShell/dist/preload/*.cjs`。
