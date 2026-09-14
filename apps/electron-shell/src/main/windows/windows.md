# windows

`windows/` 封装 Electron main process 中的窗口生命周期与桌宠位置；Thread 消息和连接由 renderer 持有。

## 文件

| 文件 | 职责 |
|------|------|
| `threadWindowPrewarmer.ts` | 全局唯一 ThreadWindow `BrowserWindow` 的 hidden prewarm、首轮输入与目标 Thread 交付、show/focus、close 状态、host theme 下发与只读 `availableSkills` 注入 |
| `activityWindowController.ts` | 桌宠 ActivityWindow 的非激活展示、布局、拖动、透明命中、host theme 下发和 renderer crash 回调 |
| `petPositionStore.ts` | 角色右下角屏幕坐标的原子保存与恢复；文件路径由 main 注入 |

## ThreadWindow 前提

- `prepare()` 创建 `show: false` 的 `BrowserWindow`，启用 `contextIsolation: true`、`nodeIntegration: false`，并加载 `/thread-window/index.html`。
- 新建 ThreadWindow 时，prewarmer 还会通过 preload `additionalArguments` 传入当前 `availableSkills`；这些技能由宿主读取本地 skill manifest 后提供给 renderer，不让 renderer 直接访问宿主目录。
- `prepare()` 必须等待 `did-finish-load` 或 `loadURL` promise 成功后才把 `prepared` 置 true；加载失败或窗口关闭必须 reject。
- `openInitialPrompt()` 会先确保 prepared，再通过 `executeJavaScript("window.handAgentReceiveInitialPrompt(...)")` 注入 initial prompt，最后才 show/focus。
- `openThread(threadId)` 对隐藏、可见和重建窗口都先确保 prepared，再通过 [preload 窄桥](../../preload/preload.md) 交付目标，最后 show/focus。注入失败或交付期间窗口已关闭、替换时，command 返回失败；旧窗口的异步结果不能打开替代窗口。
- 两种 JSON 注入前都把 `<` 转义为 `\u003c`。成功回执只证明 renderer 已接收或缓冲请求且窗口已 show/focus，不代表 React 已完成选择渲染或收到后端 snapshot。
- `focus()` 只有窗口存在且已经 visible 时才返回 true；无目标且不可用时 runtime 调用 `openHistory()` 打开窗口，不请求 Swift 打开 PromptPanel，也不改变 React 当前选择。
- `closed` 事件要回传 `wasPrepared` 和 `wasVisible`，让 runtime 区分 hidden prewarm 失败和用户可见窗口关闭。
- controller 保存当前 host theme；进程启动时的初值来自 Electron main 解析后的 `HANDAGENT_INITIAL_THEME`，新建窗口时通过 preload `additionalArguments` 传入该 theme。窗口已创建但尚未 prepared 时收到 `theme.changed`，必须在 prepared 后补发一次当前 theme，避免 renderer 初始参数停留在旧主题。

## 桌宠 ActivityWindow 前提

- 窗口透明、无边框、置顶；`showInactive()` 负责启动展示。保留 `focusable: true`、`acceptFirstMouse: true`，让回复框通过正常点击获得焦点。
- 初次定位在主屏工作区右下方，并预留角色右侧的对话列。`PetPosition { right, bottom }` 保存角色右下角的屏幕 DIP 坐标；窗口右边界还包含对话列，不能当作角色锚点。
- 角色本地锚点与窗口尺寸来自 [src 共享布局](../../src.md)。有足够工作区时，`pet` 向右扩为 `compact`，`expanded` 仅增加上方高度；`compact` 与 `expanded` 切换保留同一锚点，上方不足则缩短历史窗口。恢复位置、屏幕变动和拖动仍将完整窗口限制在目标工作区内。
- 位置存储只保存角色锚点；大小偏好、消息、当前 Thread 和回复草稿归 renderer。角色缩放不改变窗口布局槽位，main 只消费实际命中矩形。已有桌宠窗口被重复显示或 ThreadWindow 关闭时，继续使用同一 renderer。
- renderer 按[桌宠布局](../../activity-window/activity-window.md)逐个裁剪可见气泡，经 [preload](../../preload/preload.md) 上报角色和各交互表面的本地矩形；main 再按窗口边界裁剪，用系统光标轮询决定 `setIgnoreMouseEvents(..., { forward: true })`。透明间隙保持穿透，外部应用拖入时也能恢复命中，不能只依赖 renderer 的 mousemove。
- `beginMove`、`move`、`endMove` 只使用 main 读取的系统光标。拖动期间保留鼠标事件，让 renderer 的 pointer capture 跨窗口边界继续工作；结束后保存位置并恢复局部命中。
- 鼠标和焦点直接进入桌宠 renderer，保留输入、滚动和原生 drop；窗口控制器不把这些事件转换为 ThreadWindow 聚焦请求。
- 窗口只 load `dist/activity-window/index.html`；preload 注入 Thread endpoint 和 host theme。加载期间收到的新 theme 在 loaded 后补发，后续通过 `handagent:theme-changed` 推送。
- renderer crash 仍上报 `renderer.crashed window: "activity"`；它不代表 agent-server 不可用。

## 修改约束

- 不在窗口控制器里解析 Thread 协议或持有消息状态。
- 改 BrowserWindow security 选项时，必须同时检查 `src/preload/preload.md` 中的暴露边界。
- 改窗口 close/prewarm 语义时，同步更新 `tests/use-cases/thread-window-commands.test.ts` 和 `tests/use-cases/desktop-startup.test.ts`。
