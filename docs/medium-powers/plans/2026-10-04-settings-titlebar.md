# Electron 设置顶部标题栏

## 用户用例与范围

用户从菜单打开独立 Electron 设置，页面背景延伸到窗口顶端，不再出现原生深灰标题条；保留 macOS 红黄绿按钮、顶部空白拖动、搜索与各设置操作。重复打开仍只聚焦，草稿、切页与关闭重建默认模型页沿用现有合约。普通 ThreadWindow 和桌宠不在此次外观修改范围。

## 现有流程与接口

`settings.open` → runtime 的独立 `ThreadWindowPrewarmer` → main 的设置 BrowserWindow factory → `?surface=settings` → SettingsApp。窗口使用 `contextIsolation: true` / `nodeIntegration: false`，布局提示通过设置 URL 的 `titlebar=hiddenInset` 传递，不增加 preload / Node / IPC 操作能力。macOS 设置窗口采用 `titleBarStyle: hiddenInset`，renderer 同步预留原生按钮空间并提供专用空白拖动区域；非 macOS 保留默认窗口框架。页面表单及持久化数据结构不变。

## 验证与预算

复用 `apps/electron-shell/tests/use-cases/thread-window-commands.test.ts` 的 `opens one independent settings renderer, focuses it unchanged and recreates after close`，保留安全与单实例语义。标题条、拖动及原生按钮必须在实际 Electron 窗口验证；布局与命中通过实际 Electron 窗口确认，不增加断言 CSS class 的测试。累计新增测试预算为 0，原生视觉不以 mock option 断言代替。

## 实施步骤

1. 工作流记入 TODO，完成独立 worktree、Web / Electron test 与 Swift build 基线，读取目录文档链。
2. 修改设置 BrowserWindow 的 macOS 标题栏样式；同步设置页面顶部安全空间与 drag 区域，避免覆盖交互控件。
3. 完整 Electron build，真实原生窗口检查亮暗主题、宽窄布局、按钮命中和拖动；跑 `scripts/test.sh`、`swiftw test`、`swiftw build`。
4. 更新 owning 文档和 manual QA；分发不继承上下文的独立文档审核，确认后迁出 TODO 并提交。

## 状态

已实现并通过 Web / Electron / Swift 检查；隔离真实 Electron 窗口确认灰条移除、亮暗主题、宽窄布局及搜索命中。当前跨模块合约见 [Electron 窗口](../../../apps/electron-shell/src/main/windows/windows.md)与 [Web 设置约束](../../../apps/thread-window-web/src/src.md)；正式宿主的拖动与交通灯按钮功能仍见 [manual QA](../../manual-qa.md)，不将 Computer Use 未产生 move 事件的尝试记为通过。
