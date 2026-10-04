# PromptPanel：发起请求

- **模式**：Operate。
- **范围**：全局快捷键输入、独立 Workspace 选择、Append Prompt 候选、主动附件确认与提交交接；主要源码为 `apps/desktop/Sources/PromptPanel/PromptPanelView.swift`。
- **用户与频率**：正在其他应用中工作的用户，按需短暂唤起；实际频率未测量。
- **成功条件**：请求与附件清楚可核对，提交后进入对应 Thread；取消或服务不可用时不会误提交。

## 当前 surface 合约

- **THESIS**：以短暂输入完成任务发起；持续对话交给 ThreadWindow。
- **OWN-WORLD**：继承共享设计系统，Swift 原生浮动输入面板；附件与模板以 chip 呈现，不另建视觉风格。
- **STORY**：唤起 → 输入与选择候选 → 核对 chip/预览 → Return 提交 → 隐藏面板并打开对应 ThreadWindow。
- **FIRST VIEWPORT**：上方为可增长的输入区、工作区选择与设置按钮；其下按需出现横向 chip 行和不可提交说明；分隔线下方为候选列表。输入默认聚焦，提交主要通过键盘完成。
- **FORM**：当前已实现的瞬时面板；候选选择和附件预览属于内部状态。未进行新方案选择，seed key 不适用。
- **FINISH**：本次现状记录完成以源码、文档和链接一致为准；键盘、捕获与焦点的实机结论沿用 QA 原记录，未新增视觉验收。

## 状态与约束

| 状态 | 当前行为 |
| --- | --- |
| 空白/无匹配 | 显示输入占位及无可用或无匹配候选提示 |
| 编辑/选择 | Tab 追加当前模板；Return 提交；Shift/Option+Return 换行 |
| 附件已加入 | chip 可移除，支持预览的附件可打开预览 |
| 工作区选择 | 从后端查询并记忆选择，失效目标保留并显示错误，不读取 Pet 或改投其他项目 |
| 服务不可用 | 显示不可提交说明，保留草稿与附件；ThreadWindow 预热和桌宠显隐不影响后端可用性 |
| 提交交接 | 面板先隐藏且不恢复旧应用焦点，再打开对应对话窗口 |

当前可辨识的交互是“从正在工作的应用短暂唤起，带上明确交付的内容再继续”。不将环境快照视作自动附件；具体输入与协议定义由模块文档拥有。

## 证据与待确认

- [源码与模块约定](../../apps/desktop/Sources/PromptPanel/prompt-panel.md)，代表视图：[PromptPanelView.swift](../../apps/desktop/Sources/PromptPanel/PromptPanelView.swift)。
- [手工验收](../manual-qa.md)：QA-INPUT、系统捕获与焦点相关记录；本轮未复验。
- 待确认：首次使用的引导需求、候选组织优先级；现有界面在长文、多附件和捕获失败时的视觉质量需实机检查。
