# 默认读取工具与统一 Thread 输入

状态：已实现，实机与真实模型待验见 [manual QA](../manual-qa.md)；完整规格见 [Issue #6](https://github.com/Lixuhang987/Wisp-Pocket/issues/6)，执行与检查记录见 [实施计划](../medium-powers/plans/2026-10-02-pets-default-reading.md)。本决定调整 [ADR 0003](./0003-context-history-without-plugin-framework.md) 中 Context History 的 Dynamic Tool 接入与可禁用采集约定，Automation 的接入不在本次范围内。

为了让 Agent 首次理解用户资料时即可按需结合既有工作背景，四个 Context History 历史读取能力改为 agent-server 中直接读取本地记录的普通 Tool，Swift 继续拥有实时采集与写入。首轮工具由共享 Thread 后端统一开放 `user.ask` 和四个历史工具，不依赖前端入口或 `use_tools` 激活；四个历史工具调用无需 Permission 确认。查询只读取已保存记录，不触发实时采集。

彻底删除 `UserInput.mode`、`inspect/reply` 模式与首次输入只能分析、强制等待后续回复才能执行的设计。桌宠和 ThreadWindow 使用同一套后端 Thread/Turn 处理规则；`user.ask` 是模型按需追问并等待普通回复的能力，不强制每次首轮调用。首轮可以按用户要求进入既有工具执行路径，其他工具的激活与 Permission 策略不因本次改动取消。

仅桌宠将 PDF、图片等文件输入改为提交原文件路径，由 LLM 按需调用默认开放的 `file.read` 取得实际内容，后端删除原 `inspect` 自动预读。新读取实现直接替换旧 Workspace 文本工具，首版允许任意路径，无需 Workspace 或 Permission 确认。用户原文件不复制；每次读取取得路径当前内容，修改后读最新内容，移动、删除或无法访问时报错。已读取结果仍按 Thread 历史机制保存，不得由输入路径直接宣称已读取内容。

[多桌宠规格](../medium-powers/specs/multi-pet-pocket-dialogue/multi-pet-pocket-dialogue.md)采用本读取 / 输入规则。当前目录归属按 [ADR 0007](./0007-frontend-pet-workspace-threads.md) 实现：Workspace 的固定 rootPath 是相对路径基准和内置写入边界，不限制 file.read 的任意路径读取；Thread 只归属 Workspace，不保存 Pet 身份、角色或文件根快照；Pet 可在前端重新安排。桌宠本期不接收截图或剪贴板图片，不增加原文件变更监控或失效恢复。原生行为及真实模型理解仍须实机验证。

2026-10-03 用户修订覆盖原先桌宠路径使用 text 的决定：`InputItem.pdf` 替换为 `file_reference`，桌宠用结构化原路径引用，两端历史按文件名卡片呈现；持久化不存副本，模型输入仍是路径文字。此身份贯穿 pending、live 与恢复，避免把展示文案当协议。其他输入前端的资料交付方式保持；合并实现的 Issue #7 同步必要 Pet 协议、Settings 管理和 AgentTrigger 目标归属。PromptPanel 的截图仍按当前图片 bytes/Blob 链路进入模型，保留其现有输入协议和临时文件生命周期。共享后端统一工具规则不意味着统一所有前端的资料交付方式。宿主设置呈现真实采集状态，Pet 前端管理与 Workspace 接续范围由 Issue #9 规定。

移除 Context History 的采集开关，采集随 Swift Host 应用生命周期常驻运行。保留期限和自动删除后续单独设计，不在本次实现。常驻描述应用运行期间的采集生命周期，不改变 macOS 系统权限要求。采集失败或缺少权限时保留已有历史查询能力，在设置中明确展示失败与缺失权限。

直接读盘使历史查询不依赖 Swift Dynamic Tool Provider 在线，但也使既有 Swift 存储成为跨进程、跨语言合约。读取实现须保留空历史、坏记录和图片证据错误的区别，并处理与采集写入并发的边界；Swift 内存中的采集状态不能从历史文件可靠推导，实时采集状态继续由 Swift 在设置中呈现，不由 Node 历史读取冒充。
