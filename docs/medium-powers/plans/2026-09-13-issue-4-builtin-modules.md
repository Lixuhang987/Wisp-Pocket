# Issue #4：内置宿主模块实施计划

规格以 [Issue #4](https://github.com/Lixuhang987/Wisp-Pocket/issues/4) 为准。基点为 `codex/issue-3-state-ownership-main-20260913` 的 `72787e2`；工作区为 `.worktrees/issue-4-builtin-modules`。本计划按已授权规格执行，不增加采集来源或自主修复能力。

当前状态（2026-09-13）：初始重构与后台激活修复已完成，并已独立核对规格、代码与文档。后台 Host 激活外部应用及可见 Settings 的自身激活已实机复验；实机验收逐项归档，剩余条目见 manual-qa；Issue #4 尚未完成。

验证记录：初始重构日志为 `.cache/issue-4-{web,swift,build,package}-verified.log`，既有审核发现已闭合。本次激活修复的 Web 检查见 `.cache/issue-4-activation-web.log`，Swift test/build/package 见 `.cache/issue-4-activation-final-{swift,build,package}.log`；四项均通过，由主 agent 执行，实机复验期间代码未再变化。

产物均为本 worktree 的 `dist/Wisp Pocket.app`，使用 `--mock-llm`，系统能力与业务模块保持真实实现。旧实施提交 `8911eaf` 的主程序 SHA-256 为 `b3596abbecd8a2f8089c6154d90fae7845e7bd836078ef246e176b469e72c503`；本次修复复验产物为 `b86c404631a0bb81b1a62ac0624e30770ac06c2a1b94eb9cb6a8b6c14cc95be7`，环境为 macOS 15.5 (24F74)。

已有部分验收使用 `.cache/issue-4-qa/home` 隔离内置业务数据与受控 fixture；CH1 已在新 home-final-20260913 完整通过，过程见 [QA 归档](../../archive.md)。九项状态统一维护在 [manual-qa](../../manual-qa.md)，各轮产物、进程与清理证据分别记录；旧进程记录不表示当前运行状态。

已有 CH1 原始记录位于 `.cache/issue-4-qa/` 下的 `provider-hellos.jsonl`、`ch1-restart.json` 与 `CH1-evidence.jsonl`。这些记录只支持已注明的部分步骤，不能代表九项完整验收。

## 目录与现有链路

Swift Host 直接组合 `HandAgentHostAutomation` 的 Context History / Automation，原 Plugin manifest、安装、进程托管与 RPC 已移除。当前模块所有权从 [根架构](../../../handAgent.md) 进入；业务数据路径与默认关闭配置保持下述接口边界。

## 明确接口

Swift Host 通过固定的 `HostAutomationCapabilities` 共享 macOS 实现，`BuiltinFeatures` 显式组合两个模块；不建立模块注册表、能力发现或新运行协议。接口、Dynamic Tool 图片格式、callId 与声明刷新合约见 [平台桥](../../../apps/desktop/Sources/AppServices/PlatformBridge/platform-bridge.md)。

两个开关默认关闭，由 [宿主设置](../../../apps/desktop/Sources/AppServices/AgentSettings/agent-settings.md) 原子保存；写入失败保留原有效选择。业务生命周期和持久化边界见 [Host Automation](../../../apps/host-automation/host-automation.md)。

## 用例一：启用、采集、查询与重启

触发：用户在工具设置页启用 Context History。预期：选择持久化，应用存续期间采集；关闭窗口继续，禁用或退出停止。

复用 `ContextHistoryStore`、`ContextHistoryCollector`、`ContextHistorySamplingScheduler` 和分层查询；`ContextHistoryModule` 拥有任务和采样状态，保持 5 秒观察、30 秒周期活动、60 秒截图。所有可变业务状态在 MainActor；取消后不得晚写入，重复启用不得启动多个任务。

数据流：设置写入 → BuiltinFeatures.start/apply → 模块启动 → 读取同一次前台 App/window、AX 与图片 → 原目录写入 Activity Sample / Screenshot Record → Provider 查询索引、批量详情、缩略图与原图 → 重建模块后相同标识和内容仍可读取。

保留 id、timestamp、sampleId、thumbnailId 关联；截图和缩略图必须可解码且尺寸真实。索引只返回轻量字段；详情补 AX，图片以 Dynamic Tool 图片内容返回并保留关联元数据。权限、文件损坏、缺失样本、无效参数和采集失败必须有明确结果，不能伪装为空白成功。

主要集成测试：`apps/desktop/TestsSwift/AppServices/PlatformBridge/BuiltinContextHistoryUseCaseTests.swift`。从 Provider hello 和调用进入真实模块，用临时目录与系统边界替身控制 App/window、AX、真实 PNG 和采样时刻；验证变化/周期采样、读回图片内容、时间关联、重建读取、停止和失败可见性。调度算法仍用真实实现。

## 用例二：录制、保存、运行与失败修复

触发：启用 Automation，经工具开始录制、跨多次调用记录、停止保存，再创建并按 id 运行流程。预期：进程重建后仍能运行；只有执行和断言完成才成功。

复用 `AutomationRecordingService`、`AutomationStore`、`AutomationRuntime`、`AutomationToolRouter`；`AutomationModule` 持有录制会话和执行任务。录制默认沿用显式事件提交；`captureUserEvents` 继续使用现有 macOS event tap，并在停止、禁用、退出时回收。记录开始/事件/停止之间的状态不能因工具调用结束丢失。

数据流：Provider.record_start → 会话及初始证据 → record_event / 用户事件 → record_stop → Trace 落盘 → policy_create（已有 policy/branch/trace 格式）→ Policy 落盘 → 重建模块 → run → 真实步骤、条件、断言 → Run 与最终证据 → history 查询。

保留 Policy、Branch、Step、Condition、Assertion、Trace、Run、Repair Request、Patch 数据用途。失败保留已完成步骤、失败位置/原因和已有证据，返回失败 Run；生成候选修复或应用修复不更改失败 Run 为成功。默认只创建待处理 Repair Request，不复制失败步骤并冒充已修复。`repair_apply` / `apply_patch` 合入明确提交的修复并维护版本，下一次真实执行才产生新的成功记录。

主要集成测试：`apps/desktop/TestsSwift/AppServices/PlatformBridge/BuiltinAutomationUseCaseTests.swift`。用真实业务模块、临时目录和可控 macOS 边界，从 Provider 完整完成录制→保存→重建→运行→历史；覆盖条件、断言失败、进度证据、修复提交后重跑及取消清理。保留原核心测试中仍支持的业务用例，删除只覆盖框架外壳的测试。

## 审核发现的用例补充

这些补充直接服务“参数失败可定位、正常录制可用、图片由消费方实际读取”，不扩展产品能力。每组先补调用方可见的用例，再修实现；已有自动化通过结果不能覆盖新增改动。

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

## 待完成的实机验证

- 使用上述修复产物，继续 manual-qa 保留的未完成条目；记录二进制、进程和权限环境，快捷键通过 `osascript` 发送。测试数据与用户现有业务记录隔离，配置与临时应用状态在验证后恢复。
- 实际启用采集，切换受控 App/window 并等待 30/60 秒；通过真实工具通路读回磁盘活动、AX、缩略图、原图并核验内容。
- 关闭设置与会话窗口仍产生新样本；禁用与完全退出后不再写入，重启遵守保存的开关并可读旧记录。
- 在受控、可撤销的桌面窗口录制操作，保存 Trace / Policy，重启后执行并检查实际界面结果；失败与修复数据按上述状态验证。清理测试录制、任务和进程。
- 区分产品缺陷、系统权限、环境和测试工具限制；未执行项不得标通过。发现本规格阻断问题先修复再复验。
- 根据实机结果同步相关中文文档与可核验证据，通过项按 QA 归档流程处理；如需修复代码，再完成对应检查与独立审核并提交。

## 后台激活修复与证据边界

以下原始记录位于 `.cache/issue-4-qa/`，单次工具响应保存在其 `responses/` 子目录。

- **核心用例**：后台 Swift Host 经真实 Provider 激活已运行外部应用；链路为 Provider → `activateRunningApplication` → AppKit / AX 请求 → 实际前台状态。旧 CH1 的 fixture 激活失败见 `.cache/issue-4-qa/CH1-evidence.jsonl`；早期自身激活红用例仅补充定位，不能把核心范围缩成无窗口 Host 自激活。
- **实现边界**：宿主自身使用 `NSApplication`；外部目标的 AppKit 请求被拒绝时，检查已有 Accessibility 授权并设置 `AXFrontmost`。稳定前台、权限、目标有效性与取消合约见 [平台桥](../../../apps/desktop/Sources/AppServices/PlatformBridge/platform-bridge.md)，不以请求返回成功代替实际切换。
- **外部应用复验**：`resumed-activation-green2` 分别确认 Host `isActive:false` 后调用真实 `app_activate`；TextEdit 的 PID 54458 / window 19565、fixture 的 PID 27058 / window 24269 均成功，`app_frontmost` 的 PID 与窗口 owner 正确。证据为 `.cache/issue-4-qa/responses/resumed-activation-green2-*` 和 `activation-external-evidence.jsonl`。
- **可见窗口复验**：Settings 已可见且 Host 在后台时，`resumed-settings-visible-activate-host` 成功，随后激活 fixture、再切回 Host 也成功；最终 Host PID 51805 / 设置窗口 24546。CUA 观察到设置工具页两个开关 on、最近采样 17:42:09，以及 fixture 的 QA Input / Apply / Ready，记录在 `.cache/issue-4-qa/activation-ui-evidence.jsonl`。
- **失败与未测边界**：不存在的 `local.handagent.issue4.missing` 返回 `not_found`，证据为 `activation-boundary-evidence.jsonl`。权限拒绝未通过撤销用户 TCC 来实测；取消仍待 AU3 禁用/退出的真实停机验证。无窗口 Host 自激活仍可能明确失败，未声称该场景已修复或通过。
- **证据有效性与状态**：`resumed-activation-green` 的 Host 实际在前台，未满足用例前提，不计作产品失败；有效复验以上述 `green2` 为准。核心缺陷已从 bugs 移除，HOST1 原完整条目恢复到 manual-qa；HOST1 仍待完整验收，其余条目的最新状态以 manual-qa / archive 为准。


## 实机发现：退出期间回执管道关闭

触发：用户正常退出 Swift Host，Electron 处理既有 shutdown command 时向已经关闭的 stdout 读取端发送 ack。预期：停止 supervisor 并退出 Electron，不因回执传输失败进入异常模态框；连接正常时 NDJSON 内容保持原合约。

复用链路：`ElectronBackedAppServer.stop → shutdown → ElectronShellRuntime.handleCommand → ack → JsonLineBridge.send → stdout`。不新增协议字段、托管进程或业务状态；输出流的终止必须作为传输边界处理，不能打断 shutdown 清理。

用例级回归先在 Electron `tests/use-cases/` 构造真实 Node 子进程与可关闭的输出 socket，调用真实 command parser、runtime 和 bridge，仅替换 Electron 窗口/退出及 supervisor 系统边界；读取端正常时验证 ack，读取端关闭时验证进程正常结束且停止 supervisor，不产生未处理 EPIPE。再检查其他输出错误的定位边界，避免把未预期错误伪装成成功。

TODO：建立并运行红用例 → 最小修复输出生命周期 → 用例及仓库 Web/Swift test/build/package 检查 → 独立文档审核 → 本地提交 → 原构建退出链路实机复验并继续 AU3/HOST1。用户已授权发现 bug 后按流程修复，沿用本 worktree 和既有分层基线。
