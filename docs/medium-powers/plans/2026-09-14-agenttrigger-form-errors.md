# AgentTrigger 表单错误生命周期

## 用例与边界

- 已授权任务：全功能实机 QA 与缺陷修复；本次只处理已有 P3 表单错误残留。
- 主 checkout `2920af8` 的打包 App 已实机复现：Chrome Bookmarks 新增表单校验失败后，取消或收起会隐藏字段，但红色错误仍在详情页。
- 期望：失败时保留表单并显示原因；取消或收起时一起清除本次错误；再次展开为新表单，不改变已保存的 AgentTrigger Instance。
- 不调整校验规则、Package 切换规则、运行时、Chrome 连接协议或其他设置页。

## 调用链与合约

1. 选中 Package 后，`AgentTriggerSettingsView` 显示 `PackageDetailView`；详情页的新增按钮展开表单，局部 `@State` 持有字段与展开状态。
2. 保存调用 `createCurrentInstance()`，进入 ViewModel 的 Chrome 文件夹校验或通用创建校验；校验失败返回 `false`、设置 `saveErrorMessage`，不写 Store。
3. 外层 View 观察 `saveErrorMessage`，通过统一错误组件展示。
4. 取消与收起均进入 `resetForm()`；该入口必须同时结束本次错误状态。

错误仍由 `AgentTriggerSettingsViewModel` 持有，`saveErrorMessage` 保持 `private(set)`。现有共享重置入口调用 `clearSaveError()`，该命令不访问 Store/runtime，也不增加第二份错误状态。

## 测试入口

- 在 `TestsSwift/Settings/AgentTriggerSettingsViewTests.swift` 托管真实 SwiftUI View，使用不显示、不激活的 `NSWindow` 与 `NSHostingView`，通过辅助功能按钮动作执行新增、无效保存、取消/收起、重新展开。
- 测试宿主临时开启本进程的 `AXEnhancedUserInterface` 并在关闭时恢复；SwiftUI 节点通过公开 AX selector 读取与操作，既不要求 `NSAccessibilityProtocol` conformance，也不调用 View 内部重置方法。
- 使用临时 `AgentTriggerStore`、临时文件夹快照 Store、nil runtime 和隔离连接状态 provider；不得实例化生产 AppServices 或启动 Chrome factory。
- 覆盖 Chrome 空文件夹与 System Clock 空标题的两类校验，以及取消/收起两个关闭入口；若 AX 托管边界不可用，先修测试驱动，不把工具失败当作产品失败。
- 断言失败时错误状态与界面文案一致，关闭后表单与错误都消失，重新展开无旧错误；新建 Store 读回的既有实例与测试前一致。
- 先在旧实现运行失败用例，记录具体失败，再作最小修改并重跑。真实打包后的观感与交互仍进入 manual QA。

## TODO

- [x] 从主 checkout 初始化 `.worktrees/live-qa-trigger-form-20260914`，取得独立 CodeGraph projectPath。
- [x] Web/TypeScript 与 Swift build 基线通过；阅读 Settings、TestsSwift、docs 的目录链到 `handAgent.md`。
- [x] 主分支产物实机复现两条关闭路径，提交缺陷证据并停止测试 App。
- [x] 真实 View 的四条集成用例在旧实现连续两次失败，均为关闭后 ViewModel 错误及可见错误残留；按钮动作、表单关闭与已有记录不变均已验证。
- [x] 最小修复通过四条真实 SwiftUI 按钮回归，取消与收起后错误清除、重新展开无旧错误、已有 Instance 不变。
- [x] `bash ./scripts/test.sh` 与隔离 home 的 `bash ./scripts/swiftw test` 全量通过。
- [x] `bash ./scripts/swiftw build` 通过。
- [x] 更新 Settings、TestsSwift 文档与 manual QA，移出已修复 bug；独立无上下文子 agent 已核对计划、代码与所有修改目录的文档链，修正调用链表述和验收默认值。
- [x] 最终检查及独立审核完成后以 `b2b8288` 提交并合入 `main`。
- [x] 主 checkout 再次通过三项检查、正式模型模式打包与签名验证；Chrome 与 System Clock 的取消、收起、重新展开均实机通过，已有 `instances.json` 哈希不变。证据为 `.cache/live-qa-20260914/trigger-form-fixed.json`，通过项使用 QA 技能脚本归档；其他功能继续按总清单验收。
