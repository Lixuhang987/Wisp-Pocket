# windows

`tests/windows` 覆盖 Electron main 的窗口控制器，不启动真实 Electron 窗口；ThreadWindow prewarm / command 主路径断言已迁入 `tests/use-cases/thread-window-commands.test.ts`。

## 文件

| 文件 | 覆盖对象 |
|------|------|
| `../use-cases/thread-window-commands.test.ts` | hidden ThreadWindow prepare、load failure、initial prompt 注入、show/focus 和 close 主路径 |
| `../use-cases/multi-pet-window.test.ts` | 五窗独立、隐藏延后回收、Permission 召回和两 sender 的 IPC 隔离 |
| `activityWindowController.test.ts` | 桌宠主题初值/后续更新、并发加载、加载中关闭和 renderer crash 边界 |

## 测试前提

- 使用 fake `BrowserWindow` / fake `webContents`，通过事件手动触发 `did-finish-load`、`did-fail-load`、`closed`、`render-process-gone`。
- ThreadWindow 测试必须确认 initial prompt 在 show/focus 前注入，并覆盖窗口在注入期间关闭的 race；相关断言优先放在 `tests/use-cases/thread-window-commands.test.ts`。
- 桌宠窗口的创建、布局、拖动保存/恢复、屏幕限制和正常 UI 事件以 `tests/use-cases/pet-window.test.ts` 为入口；用真实 preload、IPC、controller、位置文件，仅替换 Electron 与系统屏幕。
- 自动用例不能代替 macOS 实机对跨应用 drop、输入焦点、pointer capture 与透明穿透的检查；原生 QA 证据独立记录。
