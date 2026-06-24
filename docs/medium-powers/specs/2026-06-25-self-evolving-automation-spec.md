# Self-Evolving Automation Spec

## Background

HandAgent 当前已有 macOS host dynamic tools，可通过 Swift 读取前台 app、截图、OCR、Accessibility 快照并执行有限 AX action。现有 plugin 系统主要面向 dynamic tools：LLM 调用 tool，Swift provider 转发请求，plugin 或 host capability 返回结果。

用户希望新增一种更强的自动化能力：用户录制一段真实操作，系统保存截图、AX 树变化、前台 app/window、用户输入和操作前后状态；随后 agent 把 trace 归纳成可执行自动化流程。该流程不追求坐标级完全重放，而是优先使用 AX selector、条件和断言来控制 UI；当当前 UI 状态不匹配时，路由到 agent / 通用 computer use 修复；修复成功后，把新情况沉淀成可审计的新分支，使自动化逐步覆盖更多边界情况。

这类能力不同于普通 dynamic tool plugin。它更接近 Automation Plugin：录制、生成、执行、失败修复、审计和演化共同组成一个自动化系统。是否由 Swift 内嵌执行、由外部 plugin 进程执行，或通过 Swift host capability RPC 执行，仍需单独设计。

## Goal

定义一种自进化自动化的产品能力：用户可以通过录制或请求 AI 创建自动化流程，系统将其转成可执行、可审计、可修订的自动化策略。运行时优先用 AX API 做确定性操作，减少 LLM 参与；只有在 selector 匹配失败、断言失败或遇到未知 UI 状态时，才把当前 AX 树、截图、失败步骤和目标交给 agent 修复。

自动化流程的核心形态应是受限、可校验的 Automation Policy，而不是任意 Swift 代码。Swift 或外部 plugin runtime 负责解释执行 policy、调用宿主能力、记录审计日志、处理失败和生成待审核的演化 patch。

自进化不等于运行时静默改写规则。第一版应把 agent repair 成功后的新分支保存为 draft patch，附带 trace 和证据，由用户批准后生效。

## Non-Goals

- 不在第一版允许 AI 直接生成并执行任意 Swift 代码。
- 不把 Automation Policy 设计成完整通用编程语言。
- 不承诺坐标级宏回放；自动化以 AX selector、UI 条件和断言为主。
- 不在第一版自动启用自进化 patch。
- 不把普通 dynamic tool plugin 和 Automation Plugin 混为同一运行时模型。
- 不在本 spec 中决定 Swift host capability RPC 的最终协议；该协议需要后续单独设计。
- 不要求 Context History plugin 必须由自进化自动化生成；Context History 是独立的持续采集能力。

## Use Cases

- 触发：用户点击录制自动化，并完成一段真实任务。
- 预期结果：系统生成操作 trace，包含前台 app/window、用户点击/输入/快捷键、操作前后 AX tree、截图、元素 selector 候选和最终成功状态。

- 触发：用户要求 agent 根据 trace 生成自动化。
- 预期结果：agent 输出 Automation Policy，描述目标 app/window、适用条件、AX selector、操作序列、断言和失败 fallback。

- 触发：用户或 agent 启动某个自动化。
- 预期结果：runtime 激活目标 app，读取当前 AX tree，匹配 policy 条件，按 AX selector 执行 click / set value / type / hotkey 等操作，并在关键步骤后执行断言。

- 触发：某一步 selector 匹配失败、操作失败或断言失败。
- 预期结果：runtime 收集当前 AX tree、截图、失败步骤、已执行步骤和目标，路由给 agent / computer use 修复，而不是继续盲目执行。

- 触发：agent repair 成功完成当前任务。
- 预期结果：系统生成 Automation Policy patch draft，描述新增条件分支、对应操作和成功证据，不直接静默生效。

- 触发：用户审核并批准某个 patch draft。
- 预期结果：该分支合入自动化 policy，后续相同或相近 UI 状态可优先走确定性 AX 流程。

- 触发：用户查看自动化历史或调试失败。
- 预期结果：系统展示每次运行的目标、匹配条件、执行步骤、读取的 AX/截图引用、失败原因、agent repair 结果和已启用或待审核的 patch。
