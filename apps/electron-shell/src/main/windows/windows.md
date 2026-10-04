# windows

`windows/` 封装 Electron main process 中的窗口生命周期与桌宠位置；Thread 消息和交互连接由 renderer 持有；main 的 `observeRequests=1` 连接只消费身份/Permission 事实。

## 文件

| 文件 | 职责 |
|------|------|
| `threadWindowPrewarmer.ts` | ThreadWindow 单实例以及独立设置实例的 hidden loading、首轮输入与目标 Thread 交付、show/focus、close 状态、host theme 下发与只读 `availableSkills` 注入 |
| `petWindowCollection.ts` | N 个绑定 petId 的窗口集合、前端 store 驱动窗口、Workspace/Thread 分配校验与 Permission 召回 |
| `activityWindowController.ts` | 单宠 ActivityWindow 的非激活展示、布局、拖动、透明命中、host theme 下发和 renderer crash 回调 |
| `petPositionStore.ts` | 角色右下角屏幕坐标类型与独立几何测试适配；生产写入 Pet store |

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

- 窗口透明、无边框、置顶；`showInactive()` 负责启动展示。保留 `focusable: true`、`acceptFirstMouse: true`，角色主动点击唤出时由 renderer 聚焦回复框；hover 和后台更新不请求窗口聚焦。
- 初次在主屏工作区右下方按集合顺序错位定位，并预留角色右侧的对话列。`PetPosition` 保存角色右下角的屏幕 DIP 坐标及显示器 ID、相对 workArea 锚点；恢复/布局变化先沿显示器关联还原，原屏消失后回可达主屏；窗口右边界还包含对话列，不能当作角色锚点。
- 角色本地锚点与对话列尺寸来自 [src 共享布局](../../src.md)。`compact` 使用 renderer 上报的内容高度，在角色所需最小高度与展开上限之间收紧或增高；`expanded` 使用统一浏览高度。两种模式都只利用锚点上方可用空间，切换和内容变化保留角色及 composer 的底部锚点（输入行与下方工具行随资料高度统一测量），溢出由 renderer 的上方浏览区裁剪。恢复位置、屏幕变动和拖动仍将完整窗口限制在目标工作区内。
- 伙伴位置、大小和当前 Thread 归 [前端 store](../pets/pets.md)；消息投影和回复草稿归 renderer。角色缩放不改变窗口布局槽位，main 只消费实际命中矩形。已有桌宠窗口被重复显示或 ThreadWindow 关闭时，继续使用同一 renderer。
- renderer 按[桌宠布局](../../activity-window/activity-window.md)统一浏览视口裁剪上方气泡、建议和请求，经 [preload](../../preload/preload.md) 上报角色和各交互表面的本地矩形；main 再按窗口边界裁剪，用系统光标轮询决定 `setIgnoreMouseEvents(..., { forward: true })`。透明间隙保持穿透，外部应用拖入时也能恢复命中，不能只依赖 renderer 的 mousemove。
- `beginMove`、`move`、`endMove` 只使用 main 读取的系统光标。拖动期间保留鼠标事件，让 renderer 的 pointer capture 跨窗口边界继续工作；结束后保存位置并恢复局部命中。
- 鼠标和焦点直接进入桌宠 renderer，保留输入、滚动和原生 drop；窗口控制器不把这些事件转换为 ThreadWindow 聚焦请求。
- 窗口只 load `dist/activity-window/index.html`；preload 注入固定 petId、Thread endpoint 和 host theme。加载期间收到的新 theme 在 loaded 后补发，后续通过 `handagent:theme-changed` 推送。
- [桌宠正文](../../activity-window/activity-window.md)的网页链接使用新窗口意图；controller 始终拒绝创建 Electron 子窗口，校验绝对 HTTP/HTTPS 后交给组合根的 `shell.openExternal`，页面内导航一律阻止。renderer 不取得任意协议或本地文件打开权限。
- renderer crash 仍上报 `renderer.crashed window: "activity"`；它不代表 agent-server 不可用。

## 修改约束

- 不在窗口控制器里解析 Thread 协议或持有消息状态。
- 改 BrowserWindow security 选项时，必须同时检查 `src/preload/preload.md` 中的暴露边界。
- 改窗口 close/prewarm 语义时，同步更新 `tests/use-cases/thread-window-commands.test.ts` 和 `tests/use-cases/desktop-startup.test.ts`。

## 多宠窗口集合

- [Pet store](../pets/pets.md) 是显隐与关联权威；重启只恢复可见集合，已有全部隐藏不会重播种。Swift `pet.show/hide` 与桌宠入口操作同一集合。
- main 使用 `/api/thread?observeRequests=1` 分页查询 Workspace/Thread 摘要与有效 Permission 事实，绑定前核对后端 Thread→Workspace。不会 resume 历史、保存消息或回答请求；各 renderer 恢复完整投影。
- 手动指定 Pet 可以转移隐藏 Pet 的 Thread；另一可见 Pet 占用时拒绝且双方不变。Workspace 历史和 Permission 自动复用已有 owner，否则使用隐藏库存；同步 store 提交使并发操作保持唯一关联。
- 隐藏先取消显示；若 renderer 等待接收 ACK，则延后 close。隐藏、换工作区、清空当前 Thread、窗口关闭均不停止后端任务。
- Permission 观察请求结束、超时和 Thread 删除；有效请求唤出绑定正确项目与 Thread 的角色，再发送无焦点展示意图。库存不足显示最小系统通知，不抢其他可见角色，也不自动重试分配。

## 设置与管理

- 设置窗口加载 `?surface=settings`，复用独立 prewarmer，只用 focus/openHistory/updateTheme；关闭后重建默认模型服务页，不参与 ThreadWindow gate。macOS 设置采用 `hiddenInset` 原生标题栏，保留交通灯按钮；main 同时写入 `titlebar=hiddenInset` URL 布局提示，Web 必须预留原生按钮空间和顶部空白 drag 区域，见 [Web 设置约束](../../../../thread-window-web/src/src.md)。其他平台保留默认标题栏。
- 管理桥仅接受设置或登记宠窗 sender；提供资料保存、分配、显隐、大小、受控目录/图片 picker 和变更订阅，详见 [preload](../../preload/preload.md)。普通 ThreadWindow 无管理权限。
- 图片限制 PNG/JPEG/WebP、20 MiB，经 main 解码后保存前端 data URL；renderer 不能指定磁盘读取路径。目录失效保留安排，后端拒绝新执行并由 renderer 展示错误。
