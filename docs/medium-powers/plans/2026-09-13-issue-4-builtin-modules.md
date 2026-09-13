# Issue #4：内置宿主模块实施计划

规格以 [Issue #4](https://github.com/Lixuhang987/Wisp-Pocket/issues/4) 为准。基点为 `codex/issue-3-state-ownership-main-20260913` 的 `72787e2`；工作区为 `.worktrees/issue-4-builtin-modules`。本计划按已授权规格执行，不增加采集来源或自主修复能力。

证据位置：本文是原功能分支的历史记录，`.cache/...`、`dist/...` 和“本 worktree”均指 `/Users/mu9/proj/handAgent/.worktrees/issue-4-builtin-modules`，与本次合并 worktree 分开。现存汇总见该目录的 `.cache/issue-4-qa/FINAL-QA-SUMMARY.json` 与 `FINAL-evidence-manifest.json`；早期原始响应、整屏图和隔离数据已按 HOST1 清理，历史证据名称不表示这些文件仍存在。本次合并检查与未做新实机验收的边界见 [合并计划](./2026-09-13-issue-4-main-merge.md)。

当前状态（2026-09-13）：CH1–CH5、AU1–AU3、HOST1 九项实机验收已逐项 [归档](../../archive.md)，Issue #4 已完成。后台激活、EPIPE 和正常退出取消落盘均已修复、检查并实机复验；本次测试资源已清理，原 issue1 实例已恢复。

既有验证：初始重构日志为 `.cache/issue-4-{web,swift,build,package}-verified.log`，既有审核发现已闭合。后台激活阶段的 Web 检查见 `.cache/issue-4-activation-web.log`，Swift test/build/package 见 `.cache/issue-4-activation-final-{swift,build,package}.log`；这些记录不代替下述退出修复的检查与实机复验。

本轮产物为本 worktree 的 `dist/Wisp Pocket.app`，使用 `--mock-llm`，系统能力与业务模块保持真实实现，环境为 macOS 15.5 (24F74)。`codesign --verify --deep --strict` 通过（exit 0）；Swift 主程序 SHA-256 为 `ee8652922c8291e0a1f6e1dd2e38a81b5143a4f8ca7d9d6193311c9a12e516fb`。bundle 内 `ElectronShell/dist/main/swiftBridge/jsonLineBridge.js` 与本地 dist 相同，SHA-256 仍为 `edcf5250ad107b88ed8e9668d2726bdd85056d5dc757f9963669b0c389425cab`；核验记录为 `.cache/issue-4-qa/cancel-shutdown-fixed-artifact.json`。

## 已落地边界

Swift Host 显式组合 `HandAgentHostAutomation` 的两个业务模块，通过固定 `HostAutomationCapabilities` 共享 macOS 实现；原 Plugin manifest、安装、进程托管与 RPC 已移除。所有权从 [根架构](../../../handAgent.md) 进入；接口、Dynamic Tool 图片格式、callId 与声明刷新合约见 [平台桥](../../../apps/desktop/Sources/AppServices/PlatformBridge/platform-bridge.md)。

两个开关默认关闭，由 [宿主设置](../../../apps/desktop/Sources/AppServices/AgentSettings/agent-settings.md) 原子保存；写入失败保留原有效选择。业务生命周期和持久化边界见 [Host Automation](../../../apps/host-automation/host-automation.md)。

## 用例一：启用、采集、查询与重启

复用 `ContextHistoryStore`、`ContextHistoryCollector`、`ContextHistorySamplingScheduler` 和分层查询；`ContextHistoryModule` 拥有任务和采样状态，保持 5 秒观察、30 秒周期活动、60 秒截图。所有可变业务状态在 MainActor；取消后不得晚写入，重复启用不得启动多个任务。

数据流：设置写入 → BuiltinFeatures.start/apply → 模块启动 → 读取同一次前台 App/window、AX 与图片 → 原目录写入 Activity Sample / Screenshot Record → Provider 查询索引、批量详情、缩略图与原图 → 重建模块后相同标识和内容仍可读取。

保留 id、timestamp、sampleId、thumbnailId 关联；截图和缩略图必须可解码且尺寸真实。索引只返回轻量字段；详情补 AX，图片以 Dynamic Tool 图片内容返回并保留关联元数据。权限、文件损坏、缺失样本、无效参数和采集失败必须有明确结果，不能伪装为空白成功。

主要集成测试：`apps/desktop/TestsSwift/AppServices/PlatformBridge/BuiltinContextHistoryUseCaseTests.swift`。从 Provider hello 和调用进入真实模块，用临时目录与系统边界替身控制 App/window、AX、真实 PNG 和采样时刻；验证变化/周期采样、读回图片内容、时间关联、重建读取、停止和失败可见性。调度算法仍用真实实现。

## 用例二：录制、保存、运行与失败修复

复用 `AutomationRecordingService`、`AutomationStore`、`AutomationRuntime`、`AutomationToolRouter`；`AutomationModule` 持有录制会话和执行任务。录制默认沿用显式事件提交；`captureUserEvents` 继续使用现有 macOS event tap，并在停止、禁用、退出时回收。记录开始/事件/停止之间的状态不能因工具调用结束丢失。

数据流：Provider.record_start → 会话及初始证据 → record_event / 用户事件 → record_stop → Trace 落盘 → policy_create（已有 policy/branch/trace 格式）→ Policy 落盘 → 重建模块 → run → 真实步骤、条件、断言 → Run 与最终证据 → history 查询。

保留 Policy、Branch、Step、Condition、Assertion、Trace、Run、Repair Request、Patch 数据用途。失败保留已完成步骤、失败位置/原因和已有证据，返回失败 Run；生成候选修复或应用修复不更改失败 Run 为成功。默认只创建待处理 Repair Request，不复制失败步骤并冒充已修复。`repair_apply` / `apply_patch` 合入明确提交的修复并维护版本，下一次真实执行才产生新的成功记录。

主要集成测试：`apps/desktop/TestsSwift/AppServices/PlatformBridge/BuiltinAutomationUseCaseTests.swift`。用真实业务模块、临时目录和可控 macOS 边界，从 Provider 完整完成录制→保存→重建→运行→历史；覆盖条件、断言失败、进度证据、修复提交后重跑及取消清理。保留原核心测试中仍支持的业务用例，删除只覆盖框架外壳的测试。

## 已落地的用例补充

### 参数失败与系统目标

- 从 Provider 调用 `record_event` 和 `record_stop`，覆盖事件中的 `timeoutMs` / `timeout` 非有限值、非整数、越界、负数及错误类型。JSON 不支持的非有限值在可触达的内部边界测试；合法 JSON 的非法输入从完整工具请求进入。预期均为明确失败，不能经数值转换触发进程 trap，也不能写入伪成功 Trace。
- 原生工具覆盖重复字段或畸形 `elementId`，预期 `invalid_argument`；`screen_capture` 的未知 target kind、非法 displayId/screenId 或指定但不存在的显示器必须失败。只有未指定目标时使用默认显示器，不能把显式错误静默回退。
- 通过 Provider 创建最大版本的 Policy、产生失败 Run 后提交 Repair Patch；递增版本溢出必须在任何写入前返回明确错误，原 Policy、失败 Run 和 pending Repair Request 保持不变。
- 用例扩展 `BuiltinAutomationUseCaseTests`、`MacPlatformProviderParsingTests` / `MacPlatformNativeAutomationTests`，只替换真实系统查询与动作边界。

### 录制证据和返回内容

- 真实事件录制 → 停止 → Trace 持久化：每条 live event 保留 `timestamp`、`evidenceTiming`、`evidenceCapturedAt`，使用 `evidenceRef="finalEvidence"` 指向 Trace 顶层停止时证据，移除重复 `before` / `after` 图片。显式 `record_event` 的独立前后证据继续保留。
- 用包含多条真实事件和非空 PNG 的 Provider 用例验证事件引用均可解析，序列化体积不随事件数重复放大截图。业务状态与存储仍用真实模块。
- Automation 工具响应中的 evidence 图片转换为 `inputImage`，JSON 元数据保留原证据路径与图片内容的关联。验证开始录制、停止/查询及执行结果所支持的返回形态，不能仅断言存在 base64 字符串或图片 id。
- Dynamic Tool 失败仍由 adapter 抛 `Error` 给 Runtime，保留 `status:error`；错误内容保存包含 `success:false` 和图片在内的完整 JSON envelope，使失败证据仍进入模型消费链。沿用现有 wire 字段。

### 模型消费图片

- 新增真实 `DynamicToolAdapter → AgentRuntime → LLM Provider` 的完整用例，让工具返回已知 PNG 与 JSON 元数据，再捕获下一轮模型请求；验证图片可解码，关联 callId、工具名与元数据保持正确。
- Responses / Anthropic 使用原生 Tool 图片内容；Chat 路径把关联图片放到本批全部 tool results 之后的 user image 消息中，避免打断 assistant tool-call 与 tool-result 顺序。文本结果、失败结果和多工具并发结果仍保持各自关联。
- `VercelAdapters.ts`、相关 client 与图片判断必须一致；`dynamic-tool-images.test.ts` 以真实 adapter、Runtime、Provider client 和 SDK 覆盖跨层数据流，捕获实际协议请求。仅控制宿主响应、首轮模型决策与外部模型网络，不 mock 掉 Tool 分派或结果转换；既有 `vercel-client.test.ts` 继续回归文本、用户图片与 SSE。

### 长操作与取消

- Dynamic Tool bridge 默认等待 Provider 结果或真实连接失效；仅显式传入 timeout 时建立 deadline，移除默认 15 秒超时。补长操作正常完成、显式超时和断连失败用例，防止宿主动作完成却已被 transport 报失败。
- Provider 发送函数同步抛错时，在 reject 前清理该调用的 pending 和 timer；以相同 callId 重试应能重新发送并收到成功响应，不能因第一次发送失败留下占位而拒绝重试。
- `Thread.interrupt` 自有 `settleWithin(..., 3000)` 上限并停止旧 Turn 投影，不无限等待 Tool Promise；它不会远程取消 Host 步骤，现有协议没有 cancel 消息。用户禁用 Automation 或退出应用才取消宿主任务，此边界同步到平台桥、Thread 与 QA 文档。

## 实机验收与清理结果

- AU3 已在 1381718 新包完成紧凑退出取消与重启 history：Run 7410F4B8-E149-44A1-9BCC-572A52B75EDF 为 cancelled，保留两步且无 Repair Request；Host/Electron/Node 全部结束，CUA 确认后续 Apply 未执行。归档提交为 `ceb020a`，现存汇总为 `.cache/issue-4-qa/AU3-final-history-verdict.json` 和 `au3-cancel-persist-verdict.json`。
- HOST1 已验证原生读取/动作、Unicode/快捷键、可消费截图、英文 OCR 与 14 个明确参数失败；最终文本由 CUA 与 Provider AX 核对，未单独复核 fixture 磁盘文件。双开关恢复 off，声明退至 9 个原生工具，本次全部进程/监听结束，原 issue1 实例已按原配置恢复，归档提交为 `77f9929`。
- macOS TCC 拒绝未通过撤销现有授权实测，无窗口 Host 自激活未记为通过；这些边界保留在归档，未混同为产品成功。
- 两个隔离业务 home、原始响应/整屏图、token 和临时 fixture 已移除；保留最终构建、脱敏文本/哈希及 `AU2-policy-fixture.png`、`HOST1-window.png`。清理与最终进程/文件复核见 `.cache/issue-4-qa/HOST1-cleanup-verdict.json`、`FINAL-workspace-verification.json`；恢复实例见 `HOST1-old-instance-restored.json`。

## 后台激活修复与证据边界

后台 Host 经真实 Provider 激活外部 TextEdit、fixture 与已有 Settings 窗口已复验；有效外部激活记录为 `resumed-activation-green2`，核对了 Host 起初在后台以及返回 PID/window 与实际前台一致。阶段性判定见 `b22c542` 中的本计划，原始响应与实机日志已清理；最终宿主验收见 `77f9929` 的 [归档](../../archive.md) 与现存 `.cache/issue-4-qa/HOST1-archive.md`。当前激活合约见 [平台桥](../../../apps/desktop/Sources/AppServices/PlatformBridge/platform-bridge.md)。

不存在目标的 `not_found` 已验证；macOS TCC 拒绝仍未实测，无窗口 Host 自激活未记为通过。`resumed-activation-green` 未满足后台前提，不能计作产品失败。HOST1 的验证范围与最终结果见 QA 归档。

## 实机发现：退出期间回执管道关闭

旧缺陷为 Swift 退出关闭 stdout 读取端，Electron 的 shutdown ack 触发 `EPIPE` 错误框并残留进程；脱敏缺陷记录见 `7e74cfe` 中的 `docs/bugs.md`，原始实机日志已清理。修复仅处理预期异步 EPIPE 并跳过不可写输出，协议及 shutdown 顺序不变。

`host-shutdown.test.ts` 使用真实 Node stdout 管道与 parser/runtime/bridge，覆盖正常读取端、闭管道和非 EPIPE 的 EIO；回调记录不证明真实 Electron/supervisor 清理。红用例及检查日志为 `.cache/issue-4-shutdown-{red,web,swift,build,package}.log`。

`b22c542` 签名包已实机确认正常退出和运行中退出均无 EPIPE 残余，Host/Electron/Node 全部结束；产物身份见 `.cache/issue-4-qa/shutdown-fixed-artifact.json`，当时的进程结果见 `40719ac` 的缺陷记录。Run 取消落盘的最终通过依据为 `ceb020a` 的归档与现存 `AU3-final-history-verdict.json`。

## 实机发现：退出前未等待 Automation 取消持久化

用例：真实 Provider 启动已完成两步且仍在 waitFor 的 Run，用户正常 Command-Q。1.521 秒紧凑复现中三进程退出，但 Run `42907AFB-0358-44BC-BC68-40B30C55D110` 仍为 `running`，CUA 确认输入标记且未 Apply；脱敏复现与原文件哈希见 `40719ac` 中的 `docs/bugs.md`，原始文件已随 HOST1 清理。

已核验链路为 AppDelegate → AppCoordinator.shutdown → BuiltinFeatures → AutomationModule → AutomationRuntime/AutomationStore → AppKit 退出答复。旧生产代码的入口回归唯一失败是提前返回 `terminateNow`，耗时 0.317 秒；释放系统动作后取消与保存均通过，定位为退出答复过早。红用例见 `.cache/issue-4-cancel-shutdown-red.log`。

`HandAgentAppTests` 从实际 termination 入口进入，共享测试 target 内的 `AutomationUseCaseFixture`，使用真实 Provider、业务模块与临时存储。只替换系统动作、录制监听、窗口/进程与 AppKit 答复边界；动作释放前不得答复，释放后核对同一 Run 已取消落盘、原进度和失败位置、无 Repair Request、后续动作未执行，并验证重建 Store 可读和重复请求只答复一次。该测试不证明实际进程退出。

已实现：Automation 保留禁用时的同步 `stop`，新增等待在途操作结束的 `stopAndWait`；BuiltinFeatures/AppCoordinator 的正常退出路径等待完成，AppDelegate 使用 `terminateLater` 并在清理完成后答复一次。沿用既有取消与持久化格式，不修补旧 `running` 记录，强制杀进程不在正常退出保证内。

检查：目标回归、Web、Swift test/build/package 均 exit 0，日志 .cache/issue-4-cancel-shutdown-{green,web,swift,build,package}.log 均为 success；签名与新包资源已核验。独立文档审核已同步退出合约和测试边界，两项退出缺陷均已实机复验归档。

收尾完成：退出取消和重启 history 核对旧失败文件不变、成功图片一致与两种取消状态；HOST1 完成宿主工具、配置恢复、进程/数据清理和旧实例恢复。脱敏总览见 .cache/issue-4-qa/FINAL-QA-SUMMARY.json，详细证据以 QA 归档为准。
