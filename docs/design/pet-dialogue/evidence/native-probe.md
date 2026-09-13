# 多桌宠原生窗口可行性实验

真实 Electron 42.3.3 窗口实验通过 11 项限定检查，证明三窗口同屏、原生尺寸展开/收起、单槽轮换、原窗口恢复与内存草稿保留可行。这不是生产功能实现，也没有验证跨应用拖入、透明命中、输入法或跨 Spaces 行为。

## 归档证据与运行方式

- [完整运行记录](./native-report.json)：最终实跑为 2026-09-14 03:28:49–03:28:51（Asia/Shanghai），命令退出码 0。原始 JSON 保留运行时路径与阶段名称；复核使用本目录的归档副本。
- [三宠并排图](./native-three-pets.png)：三张原始 capturePage 图的 contact sheet，图中已注明并非桌面合成截图；棋盘底仅用于看清透明内容。
- [展开与脚本输入图](./native-expanded-input.png)、[单槽第二宠图](./native-solo-pet.png)：保留原始 capturePage PNG。该次运行共生成 12 张原始图及 1 张派生并排图，本目录只保留这三份代表性图；其他阶段的数值和 DOM 记录仍在 JSON 中。
- 实验源码：[native-probe.cjs](../../../../apps/electron-shell/src/activity-window/prototypes/pet-dialogue/native-probe.cjs)、[native-probe.html](../../../../apps/electron-shell/src/activity-window/prototypes/pet-dialogue/native-probe.html)。两文件只载入本地素材，不启动生产 shell 或 agent-server。
- 从仓库根执行：`pnpm --filter handagent-electron-shell exec electron src/activity-window/prototypes/pet-dialogue/native-probe.cjs`。
- 命令默认自动执行全部阶段后退出，不留下可交互窗口。每次按 UTC 时间创建 `.cache/pet-dialogue-native/run-<timestamp>/`，并更新该缓存目录下的 `latest.json`；此次窗口实验约 1.7 秒，临时 profile 随后由短命 helper 清理。
- 图集直接引用 [yachiyo.webp](../../../../apps/electron-shell/src/activity-window/assets/yachiyo.webp)，1536×1872，使用 idle 第一帧、单帧 192×208、比例 2/3；三个工作角色标签是试验数据，不代表已支持多个人设。
- 样式直接引用[生成的主题](../../../../apps/thread-window-web/src/styles/generated-theme.css)；没有新增设计 token，也没有生成代替真实角色的图像。

## 环境与隔离

| 项目 | 实际值 |
| --- | --- |
| 系统 | macOS 15.5，Build 24F74，darwin/arm64 |
| Electron | 42.3.3（`environment.versions.electron`） |
| 屏幕 | 1 块内建视网膜显示器；1440×932 DIP，scaleFactor=2 |
| 工作区 | `{x:0,y:34,width:1440,height:898}` |
| 窗口配置 | 三个独立 BrowserWindow；frame=false、transparent=true、backgroundColor=#00000000、alwaysOnTop=true、showInactive() |
| renderer 配置 | contextIsolation=true、nodeIntegration=false、sandbox=true；preload 只接受本窗口 expanded/collapsed 意图 |
| 进程/数据 | 独立临时 userData/sessionData/crash/log 路径；不启动 agent-server，不连接真实用户数据库 |
| 网络/权限 | renderer CSP 禁用 connect；session 仅允许 file/data 请求；所有权限请求拒绝；本次未发生网络请求 |

## 已证实行为

下表的阶段名称与字段均可在[完整运行记录](./native-report.json)中检索。

| 检查 | 真实观测 | 阶段或归档图 |
| --- | --- | --- |
| 三宠同屏 | BrowserWindow 数量为 3，ID 1/2/3 均 visible=true、focused=false；bounds 分别为 `(384,704,208,208)`、`(616,704,208,208)`、`(848,704,208,208)` | `01-three-pets`；[三宠并排图](./native-three-pets.png) |
| 透明画面和真实图集 | 三窗 DOM 确认 1536×1872 图集加载；body 为 transparent；原始每窗 PNG 约 71.87% 像素 alpha=0。文字和角色已视觉检查 | `checks` 第二项及各 capture 字段；并排图本身已加棋盘底，不用于重新测量 alpha |
| 单窗展开 | 程序点击本窗口 `#pet-open`，preload→main 把 ID 1 窗口变为 `(384,272,496,640)` | `02-expanded-input`；[展开输入图](./native-expanded-input.png) |
| 角色锚点 | 真实窗口坐标与 DOM 角色 rect 相加，展开前后右下锚点均为 `(584,880)` | `checks[].details` 中的 `initialCharacterAnchor/expandedCharacterAnchor` |
| 中文文本写入 | 对自身 textarea 执行 focus，再用 `webContents.insertText` 写入“请先读这篇资料，再给我三个可以继续追问的方向。”；DOM 值一致，截图文字完整 | `02-expanded-input` 的 `activeElement=draft` 与 draft；仅证明脚本写入 |
| 收起不丢草稿 | 点击收起后原窗口回到 208×208，dialog hidden，原 draft 留在 renderer 内存 | `03-collapsed-draft` |
| 工作区夹取 | 故意请求 `(2040,1532,208,208)`，夹取后应用 `(1232,724,208,208)`；原生 getBounds 返回相同值且位于工作区内 | `clampObservation` |
| 单槽轮换 | 依次只 showInactive 三宠之一；每阶段总窗口数仍为 3、可见数恰为 1，可见窗都在 `(616,704,208,208)` | `04-slot-1/2/3`；[单槽图](./native-solo-pet.png) |
| 恢复三宠 | 全部恢复初始位置；窗口 ID 仍为 1/2/3，没有重建；ID 1 中文草稿仍在 | `05-restored-three` |
| 再次打开输入 | ID 1 再次展开后仍显示原草稿 | `06-reopened-draft` |
| 自有窗口未取得 OS focus | 各次 isFocused 均 false，BrowserWindow.getFocusedWindow() 均为 null | 各阶段 observations；不能替代对外部 App 焦点的观察 |

`app.getAppMetrics()` 在初始和恢复三窗时记录了自有进程 PID/type/CPU/memory 原始值。没有采样周期或对照试验，因此不能据此推导性能预算、节能效果或可承载宠数量。

## 仍未证实的原生门槛

1. **跨应用真实 drop**：没有从 Finder、浏览器、预览等 App 拖文件/文字；未验证 DataTransfer 格式、错误目标或屏幕边缘 drop。本次没有请求系统权限来补这个缺口。
2. **点击穿透与鼠标捕获**：没有调用生产的命中轮询或 setIgnoreMouseEvents；PNG alpha 不证明透明区域能点到背后 App。正式验证仍须覆盖气泡间隙、邻宠、拖动越界与移动结束。
3. **真实输入焦点和输入法**：使用自身 executeJavaScript/insertText，不是用户键盘输入。中文 DOM 文本成功不代表拼音 composition、候选窗、Cmd+C/V、Tab 或焦点恢复通过。
4. **多个宠的碰撞和层级**：展开窗的 496 DIP 原生 bounds 会与邻宠 bounds 相交；本试验没有避让或跨窗命中仲裁，因此不能声称三宠展开时互不遮挡。
5. **多屏、Spaces、全屏、屏幕拔插**：只在一块真实内建显示器上验证工作区夹取；读取 getAllDisplays 不等于测试了多屏移动。
6. **VoiceOver、reduced motion 与持续动画**：本次只复用 idle 首帧；没有进行辅助技术或动画生命周期验证。
7. **生产接入**：没有 Thread、Persona、Permission、Workspace、AgentTrigger 或后端健康状态接入；没有模拟这些功能已实现。
8. **系统合成画面**：原始图来自每个真实 BrowserWindow 的 capturePage；并排图只是三张原图的排版，两者都不是带其他 App 的整桌面截图。屏幕外观与真实交互仍需后续实机 QA。

## 恢复与清理

- `finally` 只销毁本实验创建的三个窗口；最终各 `isDestroyed=true`，`BrowserWindow.getAllWindows().length=0`。
- Electron 退出码为 0。退出后用 `ps` 检查该次 `getAppMetrics` 记录的进程 PID 及清理 helper PID，全部已不存在。
- Chromium 会在退出阶段继续写临时 profile；仅在退出前删除会遇到 `ENOTEMPTY`。最终脚本使用仅监测本次 Electron PID 的短命 Node helper，在该进程退出后删除本次 mkdtemp 目录，并回写 `temporaryDataRemovedAfterExit=true`。
- [归档记录](./native-report.json)中的 `cleanupWorkerCompletedAt=2026-09-13T19:28:51.332Z`；随后独立检查临时目录确实不存在，`postExitTemporaryDataRemoved=true`、`postExitNoRecordedProcessesRemaining=true`。
- 调整清理时序的前两次试验也已在各自进程退出后删除临时 profile；其图片/JSON 只留在运行时缓存。本目录归档最终成功结果，复核不依赖前两次缓存。
- 没有停止、杀死、重启或控制用户的生产 App，也没有启动生产 UI 服务或外部浏览器。

本结果只能支持“多窗口与单槽的代表性原生试验已通过”。上述原生门槛仍须单独验收，不能据此认定多桌宠功能或 99% 桌宠交互已经实现。
