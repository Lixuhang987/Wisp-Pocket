# Electron 退出后的宿主终止修复

## 用例与范围

用户已授权全功能实机 QA 与缺陷修复。ThreadWindow 前台收到 `Command+Q` 后，Electron 与 agent-server 正常退出，Swift Host 应完成异步清理并退出；不能留下无窗口的宿主进程。

2026-09-14 主分支产物复现宿主残留。主 checkout 的 `.cache/live-qa-20260914/host-exit.sample.txt` 显示主线程从 Electron termination 的 MainActor Task 进入 AppKit `_shouldTerminate` 等待。隔离 AppKit 测试在旧实现下两次于 5 秒超时：退出请求已执行，delegate 已进入且 Coordinator 存在，但异步清理 Task 未开始。

本次只处理退出调度边界，不改变 Automation 取消落盘、异常退出提示或关闭窗口继续后台运行的合约。

## 调用链与合约

`ElectronShellProcess` 的真实 Process termination → MainActor 回调 → `ElectronBackedAppServer` clean exit → Coordinator 的宿主退出请求 → `AppServices.terminateApplication` → AppKit delegate → `AppCoordinator.shutdown()` → AppKit 延迟答复 → 进程结束。

- 进程退出状态 0 仍表示正常宿主退出请求；非 0 状态维持现有错误语义。
- `terminateApplication` 保持 MainActor、无参数、无返回值的系统边界；不得强制退出以绕开 delegate。
- 生产退出使用主 run loop 的延迟 selector，使当前 Task / 主队列回调先返回，再进入 AppKit；调度合约由 [AppServices](../../../apps/desktop/Sources/AppServices/app-services.md) 持有。
- delegate 的 `terminateLater`、重复请求去重以及等待 `BuiltinFeatures.stopAndWait()` 不变。
- 关键检查点：真实子进程退出、宿主请求执行上下文、异步清理完成、真实 AppKit 答复、宿主进程退出码。
- 测试只在外部 Electron 可执行程序边界使用短命系统进程，复用真实进程桥、server、Coordinator、delegate 与 AppKit。

## 集成测试先行

在 `apps/desktop/TestsSwift/HandAgentAppTests.swift` 启动只运行本用例的 XCTest 子进程。子进程建立真实 `NSApplication` run loop，启动短命 shell，走生产退出链路；父进程核对请求与清理记录以及正常退出，超时必须终止本测试创建的进程。

设置、AgentTrigger 和记录使用临时目录；不打开产品窗口、不启动真实后端、不更改用户配置。既有在途 Automation 测试继续证明取消结果落盘先于 AppKit 答复。

## 执行 TODO

- [x] 从主 checkout 创建独立 worktree，确认独立 CodeGraph 索引。
- [x] 完成 TypeScript/Web 和 Swift build 基线，读取相关目录文档链到 `handAgent.md`。
- [x] 建立并运行能复现真实 AppKit 卡死的隔离回归测试，记录旧实现两次超时。
- [x] 依据检查点确认失败边界在退出调度；只改变 `AppServices` 的生产退出调度后测试通过，移除临时诊断日志。
- [x] 定向回归、TypeScript/Web、Swift test（341 项）与 Swift build 全部通过；更新相关模块文档与 manual QA。
- [x] 不继承上下文的独立子 agent 审核计划、代码和逐级目录指南，补齐调度与测试边界；已将修复从 bugs 移至待实机复验。
- [x] 主 agent 确认独立审核结论，提交 `984a04b` 并快进合入主分支。
- [x] 主 checkout 的 TypeScript/Web、Swift test/build 与正式模型模式打包全部通过。
- [x] 主分支打包产物已验证前台 Electron 退出、Swift 主动退出、关闭窗口继续运行、重启与历史恢复；证据已归档。

## 验证边界

2026-09-14 主 checkout 的正式模型模式包已完成正常退出与完整生命周期复验，原宿主挂起未再出现；两轮 Host、Electron、agent-server 均结束，4317 释放，重启后可恢复测试 Thread。实机记录见 [QA 归档](../../archive.md)，脱敏证据为主 checkout `.cache/live-qa-20260914/lifecycle.json`；早期自动检查保留在 `exit-fix-checks.json`。

本轮实机没有启用在途 Automation。既有自动化用例证明取消落盘先于退出答复，但当前合并产物的真实 Automation 退出取消仍按 [manual-qa.md](../../manual-qa.md) 的 QA-HOST 验证；正常退出通过不扩展为该项通过。
