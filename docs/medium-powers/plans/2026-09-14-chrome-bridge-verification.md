# Chrome Bridge 当前行为核对与测试隔离

## 用例与范围

全功能 QA 的历史 P1 记录为 `bridge.json` 的端口或 token 与当前监听不一致。当前单次启动和文件夹快照 HTTP 测试通过，历史记录不能直接作为当前缺陷的证明；先覆盖真实 runtime reload，再决定是否需要生产修复。

同时发现本轮退出子进程测试仅注入临时 Store，却仍会使用默认 Chrome factory 的用户 home。退出链路不需要 AgentTrigger Provider，应显式注入空 registry，确保该测试不启动用户目录的 bridge。

## 流程与接口

`AgentTriggerRuntime.reload()` → 真实 Chrome Provider → 真实 loopback bridge → 写入 `bridge.json` → 按文件中的 host/port/token 发送 hello 和 folder tree snapshot → `folders.json` 可读。

- `bridge.json` 的协议版本、host、port、token 与更新时间保持现有 DTO；测试不能用内存中的监听地址绕过该文件。
- 测试使用临时 home、已安装 Package 和 enabled Instance；每次 reload 后都按新文件发送真实 HTTP 请求并核对快照。
- factory 只注入临时 home，不替换 runtime、Provider、Network listener 或 HTTP 处理。
- 退出测试继续使用真实 Process、server、Coordinator、delegate 与 AppKit，只隔离与该用例无关的 AgentTrigger 来源。
- 未复现旧 P1 时保持生产逻辑不变，并保留打包 App / native host / Settings 的待实机边界。

## 执行 TODO

- [x] 从主 checkout 创建 worktree 并确认独立 CodeGraph 路径。
- [x] TypeScript/Web 与 Swift build 基线通过；读取 owning 文档链到根。
- [x] 当前 bridge 的两项单次启动 / HTTP 用例通过。
- [x] 补充真实 runtime 连续 20 轮 reload 的端口、token 与快照回归，运行通过。
- [x] 显式隔离退出子进程测试的 AgentTrigger registry，真实 AppKit 退出链路复验通过。
- [x] 隔离用例未复现旧 P1，保持生产代码不变并保留实机排查项。
- [x] 完成三项检查，更新测试隔离与待实机边界，独立文档审核完成。
- [ ] 提交测试和文档更新。
- [ ] 回到主分支实机验证 native host 与 Settings，不把隔离 HTTP 通过等同于扩展整链路通过。

## 核对结果（2026-09-14）

- 本轮代码只改两处测试：Chrome 用例的 factory 仅注入临时 home；退出用例改为空 registry，不改变真实 Process、server、Coordinator、delegate 与 AppKit 调度。
- 定向 bridge / 退出测试、`bash ./scripts/test.sh`、`bash ./scripts/swiftw test`（342 项）及 `bash ./scripts/swiftw build` 全部通过。完整 Swift suite 使用临时 `CFFIXED_USER_HOME` / `HOME`，运行前已通过 Foundation 确认 home 重定向；原因与复用入口见 [开发说明](../../dev.md#swift-测试隔离)。
- 命令结果保存在主 checkout 的 `.cache/live-qa-20260914/chrome-verification-checks.json`；仓库 wrapper 成功只输出 `success` 并删除内部日志，该文件记录命令结果与隔离探针，不是完整测试日志。
- 测试目录与生产 AppServices 指南已同步注入边界，[manual-qa](../../manual-qa.md#agenttrigger-设置二级菜单与默认-package) 已补充当前证据及实机步骤。旧 Chrome P1 保留；本轮没有打包 App、真实扩展、native host 或 Settings 整链路通过结论。
