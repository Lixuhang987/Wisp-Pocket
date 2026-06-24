# Self-Evolving Automation Implementation Plan

## Automation Policy runtime 录制、执行与自进化闭环

### Goal

在 Context History 的原子 plugin 基础上，新增独立 Automation plugin runtime。第一阶段由 runtime API 接收结构化操作事件并采集前后证据，再基于 trace 创建受限 Automation Policy；运行时解释执行受限 policy，优先走 AX selector 与断言；失败时收集 AX 树、截图、失败步骤、已执行步骤和目标，保存 agent/computer use repair request；repair fallback 成功后生成可审计 policy patch，并自动合入当前 policy 版本。

### Existing Flow Inventory

- 复用 `PluginDynamicToolManager` 的官方 plugin 安装、enabled always-on lifecycle 和常驻 plugin RPC。
- 复用 Context History plan 中的 AX、screenshot、app/window 原子 plugin，通过 plugin-to-plugin RPC 获取桌面状态和执行 AX 动作。
- 新增 Automation runtime 作为官方 always-on plugin，不放进普通 `host_macos.*` provider，也不把 Automation Policy 当作任意 Swift 代码执行。
- 第一版 agent repair 的边界通过 injectable `AutomationRepairing` protocol 表达；生产实现可先返回 structured repair request，后续接入真实 agent/computer use。

### Core structure

```swift
struct AutomationPolicy: Codable {
    let id: String
    var version: Int
    var title: String
    var target: AutomationTarget
    var branches: [AutomationBranch]
    var failureFallback: AutomationFallback
}

struct AutomationBranch: Codable {
    let id: String
    var conditions: [AutomationCondition]
    var steps: [AutomationStep]
    var assertions: [AutomationAssertion]
}

enum AutomationStep: Codable {
    case activateApp(bundleId: String?)
    case click(selector: AXSelector)
    case setValue(selector: AXSelector, value: String)
    case typeText(String)
    case hotkey([String])
    case waitFor(AutomationCondition, timeoutMs: Int)
}

struct AutomationRunRecord: Codable {
    let id: String
    let policyId: String
    let policyVersion: Int
    let startedAt: Date
    var steps: [AutomationStepRecord]
    var failure: AutomationFailure?
    var repair: AutomationRepairResult?
}

struct AutomationPolicyPatch: Codable {
    let id: String
    let sourceRunId: String
    let basePolicyVersion: Int
    let branch: AutomationBranch
    let evidence: AutomationEvidence
}
```

存储路径：

- `~/.spotAgent/automation/policies/<policy-id>.json`
- `~/.spotAgent/automation/runs/<run-id>.json`
- `~/.spotAgent/automation/traces/<trace-id>/trace.json`
- `~/.spotAgent/automation/patches/<patch-id>.json`
- `~/.spotAgent/automation/repair-requests/<repair-request-id>.json`

官方 plugin manifest：

- `handagent-automation-runtime`：`kind = automation`，`lifecycle = alwaysOn`，默认 `enabled = false`；依赖 `app_window`、`ax`、`screenshot`；提供 `automation.record_start`、`automation.record_event`、`automation.record_stop`、`automation.policy_create`、`automation.run`、`automation.history`、`automation.apply_patch`、`automation.repair_apply`。

### Use case map

```mermaid
flowchart LR
    A["用户或 agent 开始结构化录制"] --> B["automation.record_start dynamic tool / plugin RPC"]
    B --> C["Automation runtime 保存结构化事件并通过原子 plugin 采集 app/window、AX、截图证据"]
    C --> D["record_stop 生成 trace.json"]
    D --> E["automation.policy_create 使用 trace 生成受限 AutomationPolicy"]
    E --> F["policy 写入 ~/.spotAgent/automation/policies"]
```

```mermaid
flowchart LR
    A["用户或 agent 启动 automation.run"] --> B["Automation runtime 读取 policy"]
    B --> C["app/window 原子 plugin 激活目标 App"]
    C --> D["AX 原子 plugin 匹配 selector 并执行步骤"]
    D --> E["关键步骤后执行 assertions"]
    E --> F{"selector/action/assertion 是否失败"}
    F -- "否" --> G["写入成功 run record"]
    F -- "是" --> H["收集 AX、截图、失败步骤、已执行步骤和目标"]
    H --> I["AutomationRepairing 修复"]
    I --> J["repair 成功后生成 AutomationPolicyPatch"]
    J --> K["自动合入 policy 并写入版本/patch/run history"]
```

- Integration test need to create: `apps/builtin-plugins/Tests/AutomationRuntimeTests.swift`
  - 用 fake app/window、AX、screenshot plugin client 执行一条 policy：激活 app、点击 selector、set value、断言成功。
  - 断言运行记录包含目标、步骤、AX/截图引用、成功状态。
  - 构造 selector 失败，fake repair 返回成功分支；断言 runtime 生成 patch、自动合入 policy version + 1，并写入 patch evidence 与 run repair 结果。
- Integration test need to update: `apps/desktop/TestsSwift/AppServices/PlatformBridge/PluginDynamicToolsTests.swift`
  - 官方 installer 写入 Automation runtime manifest，默认 `enabled = false`。
  - 覆盖 Automation manifest 的 `alwaysOn`、`kind = automation`、原子 plugin 依赖和 `automation.*` tool 集合。
  - always-on plugin 的 reload / 常驻 RPC 路由行为沿用同文件中的通用 lifecycle 测试覆盖；Automation runtime 的 tool 路由、policy 执行和 history 由 `AutomationRuntimeTests.swift` 覆盖。

### Implementation tasks

1. 在官方 plugin installer 中加入 `handagent-automation-runtime` manifest，默认关闭，声明 `kind = automation` 和原子 plugin 依赖。
2. 新增 Automation runtime core：policy schema、trace schema、run record、patch schema、JSON store。
3. 实现受限 policy interpreter：目标 app 激活、AX selector 匹配、click/set value/type/hotkey/wait/assertion。
4. 实现录制 trace 存储接口：第一版以 runtime API 接收 structured user events，并在每个 event 前后读取 app/window、AX、截图引用。
5. 实现 failure collection 与 `AutomationRepairing` 边界：失败时收集当前 AX tree、截图、失败步骤、已执行步骤和目标。
6. 实现 repair 成功后的 patch 生成与自动合入：更新 policy version，保存 patch、run history 和证据引用。
7. 暴露 `automation.*` dynamic tools：record_start、record_event、record_stop、policy_create、run、history、apply_patch；第二阶段追加 repair_apply。
8. 更新 `platform-bridge.md`、`app-services.md`、builtin plugin 文档和 `docs/manual-qa.md`。

### Self-review

- Automation runtime 是独立 plugin，不混入普通 dynamic tool plugin 的进程模型。
- Automation Policy 是受限 JSON policy，不允许 AI 直接生成并执行任意 Swift 代码。
- 运行时优先用 AX selector 与断言，失败才进入 repair。
- repair 成功后自动合入 patch，不要求用户审核。
- 不把 Context History 和 Automation 合并；它们只共享原子 plugin 能力。

## 第一阶段补充：agent 归纳 policy 回填

### Goal

补齐“agent 根据 trace 生成自动化”的数据入口：agent 可先读取 `record_stop` 保存的 trace，再调用 `automation.policy_create` 提交已经归纳好的受限 `AutomationPolicy` 或单个 `AutomationBranch`。runtime 只负责校验 JSON schema、保存 policy，并继续保留从 trace events 自动映射 branch 的 fallback。

### Use case map

```mermaid
flowchart LR
    A["agent 读取 trace.json"] --> B["agent 归纳 AX selector / steps / assertions"]
    B --> C["agent 调用 automation.policy_create(policy 或 branch)"]
    C --> D["Automation runtime 校验并保存受限 AutomationPolicy"]
    D --> E["后续 automation.run 读取同一 policy 执行"]
```

- Integration test need to update: `apps/builtin-plugins/Tests/AutomationRuntimeTests.swift`
  - 调用 `automation.policy_create` 传入 agent 生成的完整 `policy`，断言返回与落盘 policy 保留 agent 给出的 id、target、branch、steps 和 assertions。
  - 调用 `automation.policy_create` 传入 agent 生成的单个 `branch`，断言 runtime 用 tool 参数中的 policy metadata 包装成完整 policy 并保存。

### Implementation tasks

1. 扩展 `automation.policy_create` 参数：优先接受完整 `policy` payload；其次接受 `branch` payload；最后才从 `traceId` 对应 trace events 自动映射 branch。
2. 保持 policy schema 使用现有 `AutomationPolicy` / `AutomationBranch` Codable 解码，不引入任意代码执行。
3. 更新 Automation runtime 测试、builtin plugin 文档和 manual QA。

## 第二阶段：agent/computer-use repair 队列与回填闭环

### Goal

把第一阶段的 repair request 从“仅落盘”推进为 agent 可消费、可回填的 runtime 队列。`automation.run` 失败时仍收集当前 app/window、AX、截图、失败步骤、已执行步骤和目标，并保存 repair request；`automation.history` 必须返回 pending repair requests，让 agent 可以发现需要 computer-use 介入的失败运行。agent / computer-use 完成当前任务后，通过新的 repair result 入口提交可执行 branch，runtime 生成 `AutomationPolicyPatch`、自动合入 policy，并把 repair request 标记为 applied。

这一阶段仍不把 plugin 进程直接连到 `/api/thread`，也不让 Automation runtime 自己驱动 LLM。agent 触发与 computer-use 执行由当前 thread/tool 体系承担；Automation runtime 负责提供可审计的 request/result 数据边界和自动合入语义。

### Existing Flow Inventory

- 复用 `AutomationRepairRequestStore.saveRepairRequest` 的 request 落盘能力，扩展为可列举、可加载、可标记状态的 repair request store。
- 复用 `AutomationToolRouter.history` 作为 agent 查看运行历史的入口，追加 `repairRequests`，避免新增仅用于列表的 tool。
- 复用 `AutomationStore.applyPatch` 的 policy version + patch 落盘语义；新增 repair result 入口只负责从 agent 返回的 branch 构造 patch 并调用 apply。
- 不绕过 dynamic tool provider：agent 仍通过 `automation.*` tool 调用 runtime。

### Core structure

```swift
struct AutomationRepairRequestRecord: Codable {
    let id: String
    let status: String // pending | applied
    let policyId: String
    let runId: String
    let failedStepIndex: Int
    let completedSteps: [[String: JSONValue]]
    let appWindow: [String: JSONValue]
    let axSnapshot: [String: JSONValue]
    let screenshot: [String: JSONValue]
    var patchId: String?
    var appliedAt: String?
}

automation.history -> {
  runs: [...],
  patches: [...],
  repairRequests: [AutomationRepairRequestRecord]
}

automation.repair_apply({
  repairRequestId,
  branch: { id, steps, assertions },
  evidence: { ... }
}) -> {
  policy,
  patch,
  repairRequest
}

// 非 pending repair request 必须拒绝，避免同一个 agent/computer-use
// repair result 重复合入并重复递增 policy version。
```

### Use case map

```mermaid
flowchart LR
    A["automation.run selector/action/assertion 失败"] --> B["AutomationRuntime 收集失败 evidence"]
    B --> C["AutomationRepairRequestStore 写入 pending repair request"]
    C --> D["automation.history 返回 repairRequests"]
    D --> E["agent 使用 computer-use 完成当前任务并形成 branch"]
    E --> F["agent 调用 automation.repair_apply"]
    F --> G["runtime 生成 patch 并自动合入 policy"]
    G --> H["repair request 标记 applied，history 可审计 patchId"]
```

- Integration test need to update: `apps/builtin-plugins/Tests/AutomationRuntimeTests.swift`
  - 构造失败 policy，断言 `automation.history` 返回 pending repair request，包含 runId、failedStepIndex、completedSteps、appWindow、axSnapshot、screenshot。
  - 调用 `automation.repair_apply`，传入 agent/computer-use 生成的 branch，断言 policy version + 1、patch 写入、repair request status 变为 applied，并在 history 中带 patchId。

### Implementation tasks

1. 扩展 repair request 存储：列举、加载、标记 applied，保存时包含 `status = pending`。
2. 扩展 `automation.history` 返回 `repairRequests`。
3. 新增 `automation.repair_apply` tool 路由：解析 `repairRequestId`、branch、evidence，只允许 pending request 构造 patch、调用 `AutomationStore.applyPatch` 并标记 request applied；已 applied request 必须拒绝，避免重复合入。
4. 更新官方 Automation manifest tool 列表、desktop manifest 测试、builtin plugin 文档和 manual QA。

## 第三阶段：真实用户事件录制

### Goal

把 `automation.record_start` / `record_stop` 从纯结构化事件 API 推进到可录制真实用户输入。用户或 agent 调用 `record_start` 时可请求 `captureUserEvents = true`；Automation always-on plugin 在同一常驻进程中启动 macOS 事件监听，记录鼠标点击、基础 keyDown 文本输入和快捷键。`record_stop` 停止该 session 的事件收集，把真实事件与现有 app/window、AX、截图 evidence 包装后写入 trace。

这一阶段仍不要求 UI 设置页提供录制按钮；动态工具入口已经能表达“开始录制 / 停止录制”。真实事件监听需要 macOS 辅助功能或输入监控权限，权限失败时 runtime 应保留结构化录制能力，并在响应里暴露 live recorder 状态，避免 tool call 崩溃。

### Existing Flow Inventory

- 复用 `AutomationRecordingService` 的 session 存储、`recordedEvent` evidence 包装和 `record_stop -> AutomationStore.saveTrace`。
- 在 Support target 中新增 `AutomationLiveEventRecording` 协议，让 core 流程可测试；生产实现放在 `Sources/Automation/main.swift`，避免 Support target 直接依赖 macOS event tap API。
- 复用 `record_event` 作为结构化事件补充入口；live recorder 捕获的事件和 `record_event` 手动事件在 stop 时合并到同一 trace。

### Core structure

```swift
public protocol AutomationLiveEventRecording {
    func start(recordingId: String) throws
    func stop(recordingId: String) throws -> [[String: Any]]
}

record_start({ recordingId, captureUserEvents: true }) -> {
  recordingId,
  status: "recording",
  liveRecording: "running" | "unavailable",
  initialEvidence
}

record_stop({ recordingId, traceId }) -> {
  traceId,
  eventCount,
  liveEventCount,
  status: "saved"
}
```

### Use case map

```mermaid
flowchart LR
    A["agent 调用 automation.record_start captureUserEvents=true"] --> B["AutomationRecordingService 创建 session"]
    B --> C["AutomationLiveEventRecording.start 启动生产 macOS event tap"]
    C --> D["用户执行点击、输入、快捷键"]
    D --> E["event tap 写入 live event buffer"]
    E --> F["agent 调用 automation.record_stop"]
    F --> G["AutomationRecordingService.stop 读取 live events 并逐条补 before/after evidence"]
    G --> H["trace.json 包含真实事件、app/window、AX、截图证据"]
```

- Integration test need to update: `apps/builtin-plugins/Tests/AutomationRuntimeTests.swift`
  - 用 fake `AutomationLiveEventRecording` 启动 `record_start(captureUserEvents: true)`，断言 fake recorder 收到 recordingId，返回 `liveRecording = running`。
  - fake recorder 在 stop 时返回 click/typeText/hotkey 事件；断言 `record_stop` 保存的 trace 包含这些事件，每个事件都有 before/after evidence，并返回 liveEventCount。

### Implementation tasks

1. 新增 `AutomationLiveEventRecording` 协议，并让 `AutomationRecordingService` 可选持有 live recorder。
2. `record_start` 在 `captureUserEvents = true` 时启动 live recorder，响应 live recorder 状态；启动失败不终止结构化录制，并清理已登记的 live recording id，避免后续事件写入失败 session。
3. `record_stop` 停止 live recorder，把捕获事件与 stop 入参 events 合并后保存 trace，并返回 liveEventCount。
4. 在 `Sources/Automation/main.swift` 增加 macOS CGEvent tap live recorder，捕获 click、基础 keyDown typeText、hotkey 事件；无权限或 tap 创建失败时抛错，由 core 响应降级。
5. 更新 Automation runtime 测试、builtin plugin 文档和 manual QA。
