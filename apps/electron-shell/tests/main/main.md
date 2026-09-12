# main

`tests/main` 覆盖 Electron main process 的初始主题与 macOS Dock 策略；ElectronShellRuntime 的启动、command 和桌宠 IPC 主路径断言在 `tests/use-cases/`。

## 文件

| 文件 | 覆盖对象 |
|------|------|
| `../use-cases/desktop-startup.test.ts` | `src/main/electronShellRuntime.ts` 的 health gate、startup prewarm 和 ready event 主路径 |
| `../use-cases/thread-window-commands.test.ts` | `src/main/electronShellRuntime.ts` 的 command ack、theme fan-out、window close 和 shutdown 主路径 |
| `initialHostTheme.test.ts` | `src/main/initialHostTheme.ts` 的启动期 host theme 解析、非法 env fallback 和 system/dark 保留 |
| `macosDockApp.test.ts` | `src/main/macosDockApp.ts` 的 macOS regular activation policy 与 Dock 显示 |

## 测试前提

- 不创建真实 `BrowserWindow` 或 Electron app；runtime 测试通过 fake `prewarmer`、fake `activityWindow`、fake `send` 验证事件。
- 启动期主题测试必须覆盖 light、dark、system/dark 和非法 env fallback，避免把初值固定为 dark 或 light。
- 改 health gate、预热、窗口关闭、主题或 supervisor 生命周期时，优先在 `tests/use-cases/desktop-startup.test.ts` 或 `tests/use-cases/thread-window-commands.test.ts` 加断言。
- 桌宠布局、命中、拖动和位置保存由 `tests/use-cases/pet-window.test.ts` 从 preload 经 IPC 验证；只替换 Electron / screen 系统边界。
- 桌宠 IPC 用例必须覆盖非当前 renderer sender 被忽略，避免其他 renderer 改变桌宠窗口。
