# preload

`preload/` 是 Electron renderer 的能力边界。ThreadWindow 和 ActivityWindow 都在 `contextIsolation: true`、`nodeIntegration: false` 下运行，只能使用这里显式暴露的 globals。

preload 源文件使用 `.cts`，由 TypeScript 编译为 `dist/preload/*.cjs`。Electron main 必须把 `BrowserWindow.webPreferences.preload` 指向 `.cjs` 产物，避免 sandboxed renderer 不能加载 ESM `.js` preload 时丢失 `handAgentTheme` 和 theme subscription。

## 文件

| 文件 | 职责 |
|------|------|
| `threadWindowPreload.cts` | 向 ThreadWindow main world 注入 `/api/thread` URL、`availableSkills`、host theme、theme subscription，以及首轮输入和目标 Thread 打开的临时 receiver |
| `activityWindowPreload.cts` | 向桌宠 main world 注入 Thread URL、host theme、theme subscription 与受控窗口 IPC |

## ThreadWindow preload

- 通过 `contextBridge.executeInMainWorld()` 写入 `window.handAgentThreadWindowConfig.threadWebSocketURL`、`window.handAgentThreadWindowConfig.availableSkills` 和 `window.handAgentTheme`。
- preload 自身持续监听 `handagent:theme-changed`，只接受已校验的 `HostTheme` payload，并保存 latest theme；`handAgentSubscribeThemeChange(handler)` 订阅时会先回放 latest theme，再接收后续变化，不暴露原始 `ipcRenderer`。
- 初始化 `window.handAgentPendingInitialPrompts`，并在 React receiver 尚未安装时提供临时 `window.handAgentReceiveInitialPrompt(payload)`。
- `window.handAgentReceiveThreadOpen(threadId)` 只接收明确目标 Thread ID；React 尚未安装 receiver 时按序写入 `window.handAgentPendingThreadOpens`。交付来自 [窗口控制器](../main/windows/windows.md)，消费与选择由 [Web App](../../../thread-window-web/src/src.md) 拥有，不在 preload 解析 Thread 消息。
- 两种入口都保留已有待交付数组和正式 receiver；React 安装时消费缓冲，旧 receiver 的清理不能移除后安装的 receiver。
- `availableSkills` 只接受 `actionId/title/prompt/description?` 这组只读字段；preload 负责从 `--handagent-available-skills=...` 参数解码并做最小校验，renderer 不得直接拿到 Node 文件系统或宿主 skill 源目录访问能力。
- `handAgentElectron` 只暴露轻量 feature marker，不提供 Electron 或 Node 能力。

## 桌宠 ActivityWindow preload

- 通过 `contextBridge.executeInMainWorld()` 写入 `window.handAgentActivityWindowConfig.petId/threadWebSocketURL` 和 `window.handAgentTheme`。桌宠直接连接 `/api/thread?acceptServerRequests=1`，与 ThreadWindow 共用会话和交互式请求协议。
- preload 自身持续监听 `handagent:theme-changed`，只接受已校验的 `HostTheme` payload，并保存 latest theme；`handAgentSubscribeThemeChange(handler)` 订阅时会先回放 latest theme，再接收后续变化，不暴露原始 `ipcRenderer`。
- `handAgentPet` 的窗口布局能力包括 `setLayout(mode, contentHeight?)`、`setInteractiveRegions(rectangles)` 和无参数的 `beginMove` / `move` / `endMove`。`mode` 为 `pet`、`compact` 或 `expanded`；可选高度是 renderer 测得的常态内容需求，由 main 按角色最小高度、展开上限及工作区裁剪。
- 矩形使用当前 renderer viewport 的本地坐标；布局、角色大小、DOM 尺寸或滚动变化后重新上报。气泡、建议与请求共用上方浏览视口的裁剪规则，由 [renderer](../activity-window/activity-window.md)维护；回复框与角色单独命中。
- 角色大小偏好通过管理桥保存在前端 Pet store，并以实际命中矩形反映给 main；桥接不增加整体窗口或页面缩放能力。
- main 从已登记 sender 解析其宠窗，拒绝附带其他窗口目标的 move/hide 请求，并校验布局、有限且有界的内容高度、有限矩形和参数数量；拖动始终由 main 读取系统光标，不接受 renderer 提交屏幕坐标。窗口侧合约见 [windows](../main/windows/windows.md)。
- 隔离原生 QA 可由 main 的 additional arguments 覆盖 loopback Thread endpoint；preload 限定 `ws:`、loopback host、`/api/thread`，并确保 `acceptServerRequests=1`。

## 修改约束

- 不暴露 `ipcRenderer`、`require`、文件系统、process env 或任意 Node/Electron 对象。
- 新增 renderer 能力必须是最小函数或只读 config，并在 main 侧做 sender / payload 校验。
- 改 window global 名称时，必须同步更新对应 React renderer、`apps/thread-window-web` native config 测试，以及 `tests/preload/*`。
- 改 preload 文件类型、输出路径或打包路径时，必须同时验证 `dist/preload/*.cjs` 和 packaged app 内 `Contents/Resources/ElectronShell/dist/preload/*.cjs`。

## 原路径和多窗窄接口

- `getPathForFile` 只调用 Electron `webUtils.getPathForFile`；`chooseFiles` 返回原路径。renderer 没有任意磁盘读取能力，资料以结构化 `file_reference` 交给后端，模型转换见 [protocol](../../../agent-server/src/protocol/protocol.md)。
- `showPet` 是明确管理意图；`hidePet`、`setReceiving`、布局和拖动总从 sender 解析本窗，不接受其他窗口 ID。`onReveal` 只交付 Permission 触发的显示意图，不携带消息或选择。

## 设置和伙伴管理桥

ThreadWindow/Settings 与 ActivityWindow preload 暴露 `handAgentSettings`：目录/图片 picker、listPets/savePet/onPetsChanged、assignPet/openWorkspaceThread/summonPet、importPetImage/setPetSize 和显隐。main 只允许当前设置窗口或登记 ActivityWindow sender；普通 ThreadWindow 即使得到桥函数也无管理权限。Pet 资料和状态写入 [main store](../main/pets/pets.md)，分配前使用通用后端 Workspace/Thread 事实校验。图片 picker 返回 name/mimeType/bytesBase64，main 解码并保存前端引用，不调用后端 Pet API。`handAgentPet.hidePet()` 仅操作 sender 本窗。
