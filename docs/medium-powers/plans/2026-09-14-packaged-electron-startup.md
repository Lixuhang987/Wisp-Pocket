# 打包应用 Electron 冷启动修复

## 用例与证据

用户在已安装依赖的 checkout 打包并打开 `dist/Wisp Pocket.app`，应显示桌宠并准备好 ThreadWindow。2026-09-14 主分支实测在此之前失败：`env: electron: No such file or directory`，Swift 弹出 status 127；同一 checkout 的 workspace Electron 能运行。

用户已授权全功能实机 QA 与缺陷修复。该修复属于启动验收，证据位于主 checkout 的 `.cache/live-qa-20260914/`。

## 流程与合约

`AppServices.defaultRuntime` → `defaultElectronShellLaunchConfiguration` → `ElectronShellProcess.start` → Electron ready → agent-server health / ThreadWindow prepared。

- 配置仍使用 `ElectronShellLaunchConfiguration` 的 executable、arguments、environment、working directory 四个字段。
- bundled main 与 runtime 的选择独立：main 优先包内资源，找到 repo root 时通过已有 `pnpm --filter handagent-electron-shell exec electron` 使用 workspace 依赖。
- 只有无法定位 checkout 的包才继续使用现有全局 Electron 路径；显式有效 binary/main 配置继续按原合约解析。
- 生产故障点为 bundled main 分支提前返回 `/usr/bin/env electron`，丢失 workspace runtime 解析与工作目录。

## 执行 TODO

- [x] 从主 checkout 创建 `.worktrees/live-qa-startup-fix-20260914`；确认独立 CodeGraph 索引及 TypeScript/Web、Swift build 基线。
- [x] 阅读 AppServices、ElectronShell 及测试目录文档链到 `handAgent.md`，核对 launch 与 termination 调用链。
- [x] 在 `AppServicesTests` 增加进程级用例：临时 checkout 与包内 main、PATH 仅有可控 pnpm，无全局 electron；复用真实配置、Process 启动与事件解码，核对 ready、working directory 和传入 main。
- [x] 原实现出现 `env: electron: No such file or directory` 与 ready timeout；限制仅无 repo root 的 packaged fallback 使用全局 Electron 后，用例通过。
- [x] `AppServicesTests`、TypeScript/Web、Swift test（340 项）与 Swift build 全部通过；更新 owning 文档与手工 QA 项。
- [x] 独立子 agent 审核本计划、全部修改目录指南、代码与 QA 文档；更新启动合约、测试边界和打包依赖，并把 P1 移为待实机回归，恢复完整 QA-START。
- [ ] 主 agent 复核审核结论后提交。
- [ ] 合入主分支，重新打包并通过 Computer Use 验证冷启动、后端健康和后续生命周期用例。

## 验证边界

进程测试的 pnpm/Electron 为系统边界替身，只证明配置到子进程与 ready 解码的链路。真实 runtime、窗口、模型与生命周期继续由 [manual-qa.md](../../manual-qa.md#打包应用-electron-冷启动回归) 实机项证明。该修复不宣称产物已是脱离 checkout 的自包含发行包；本次自动检查与文档审核没有新增实机通过结论。
