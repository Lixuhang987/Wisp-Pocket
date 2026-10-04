# Sources

Context History 和 Automation 的可变业务状态由 `MainActor` 隔离。两个模块显式接收同一个宿主能力实现；系统调用、用户事件和时间可在测试边界替换，业务调度、存储与执行使用真实实现。

## 直接子节点

- `ContextHistoryCore.swift`、`ContextHistoryModule.swift`：活动历史、采样调度与任务生命周期。
- `AutomationCore.swift`、`AutomationModule.swift`：录制、策略、执行、历史与修复数据。
- `HostAutomationCapabilities.swift`：共享的固定 macOS 调用边界，由 [desktop 平台桥](../../desktop/Sources/AppServices/PlatformBridge/platform-bridge.md) 实现。
- `DynamicToolResult.swift`：沿用已有 Dynamic Tool 的成功标志、文本与图片内容格式。

## 合约

- Context History 每 5 秒观察一次前台状态；变化时采样，同一状态每 30 秒生成周期样本，首次观察后每 60 秒截屏。它是活动采样，不能作为完整操作日志。
- App/window、AX 与截图必须指向同一活动目标；采集期间前台切换或证据损坏返回可定位错误，不能拼成错误关联。
- 采集失败保留在模块状态中，设置页读取真实模块状态，Node `activity_index` 只返回已保存历史；有效空历史与查询失败有区别。索引保持轻量，详情按样本 id 补充 AX；图片结果包含 JSON 关联元数据与 `inputImage` 内容。
- 退出与取消会清理采集任务，已取消采样不得晚写入。窗口开关不改变模块生命周期；重复启动与重叠 tick 共用单次采样会话。
- Automation 每次只执行一个工具调用，并发调用返回 busy；Recording Session 跨调用保留；`record_event` 记录已经发生的动作，不执行动作。启用 `captureUserEvents` 才启动用户事件监听。
- 实时事件保留事件时间，使用 `evidenceTiming=recording_stop`、`evidenceCapturedAt` 标明证据时间，并以 `evidenceRef=finalEvidence` 引用 Trace 顶层停止时画面/AX，避免每个事件复制大图片。显式 `record_event` 继续保留独立前后证据。
- Automation 工具返回图片时保留原 JSON 嵌套位置，以 `imageContentIndex` 指向同一响应的 `contentItems`；相同图片只返回一次。业务持久化与工具返回格式分开，消费端见 [Provider adapters](../../../packages/core/src/adapters/providers/providers.md)。
- 禁用 Automation 使用同步 `stop()`：拒绝后续调用、请求取消并清理录制。取消是协作式的，当前系统调用返回前仍保留 busy；保存的 Policy 继续存在。
- 正常退出经 [平台桥](../../desktop/Sources/AppServices/PlatformBridge/platform-bridge.md) 等待 `stopAndWait()`，直到在途操作完成既有取消处理与 `cancelled` Run 持久化，保留进度和取消原因且不生成 Repair Request。此合约不包含强制杀进程后的恢复，也不修补以前遗留的 `running` 记录。
- Run 在步骤完成后保存进度，失败先保存 Run 再保存 Repair Request。候选修复和已应用修复都不改变失败 Run，只有下一次执行和断言完成才产生 `completed` Run。
- 修复应用先验证来源版本和可表示的下一版本，再写 Patch / Policy；版本上界失败必须保留原 Policy、失败 Run 与 pending Repair Request，不能溢出崩溃或留下已应用状态。
- Automation 工具参数的公开声明位于 [BuiltinFeatureToolSpecs.swift](../../desktop/Sources/AppServices/PlatformBridge/BuiltinFeatureToolSpecs.swift)，变更业务输入、图片关联或失败语义时同步声明和 Provider 用例测试。

## Swift 写入与 Node 读取合约

历史目录使用 activities.json / screenshots.json 数组索引，新写日期为宿主本地带偏移 ISO8601、秒粒度；旧 Z 时间仍按绝对时刻读取，不迁移或清理历史。Store 的时区默认取创建时的宿主本地时区，不维护采集时区历史；Activity 的 app/window 值保存为字符串，AX JSON 保留原始数值。AX 先原子落盘，再发布 Activity；PNG 的 base64 文本写入 screenshots/original 与 thumbnails，随后原子发布截图索引，最后更新 Activity.thumbnailId。单文件原子替换不构成跨文件事务：截图已发布但 Activity 反向关联尚未更新是正常过渡，已发布证据缺失 / 损坏则必须失败。Node 读取不触发实时采样，不能从历史时间推断采集状态。

activity_index 与 thumbnails 使用相同 start/end 合约：带偏移 ISO8601 或 epoch 秒，包含端点，反向范围失败；按绝对时刻先过滤，再倒序和 limit。详情与原图按 ID 读取。Swift 工具结果采用 Store 时区，Node 查询时统一转为后端本地带偏移时间，不依赖索引重写；双方合约与证据校验见 [后端历史读取](../../agent-server/src/actions/actions.md)。跨语言 fixture 已用真实 Store 导出并作为静态证据保留；来源与消费边界见 [共享夹具](../../agent-server/tests/fixtures/context-history/context-history.md)，常规测试不重新导出。
