# Desktop Experience

Desktop Experience 描述用户在 macOS 上发起、查看和配置 Agent 工作的产品界面与主动输入边界。

## Surfaces

**Swift Host**:
拥有 macOS 生命周期、系统集成、原生设置和瞬时输入界面的宿主进程。
_Avoid_: Desktop Shell、Native Shell

**Electron UI Shell**:
承载常驻 React 界面并管理其后台服务生命周期的桌面 UI 进程。
_Avoid_: Desktop Host、Swift Host

**PromptPanel**:
由全局热键唤起的瞬时输入界面，用于编辑 `UserInput` 并确认主动附件。
_Avoid_: Prompt Window、ThreadWindow

**ThreadWindow**:
展示 Thread 历史、运行状态、请求和后续输入的常驻工作界面。
_Avoid_: Chat Window、Conversation Window、PromptPanel

**桌宠**:
Wisp Pocket 的常驻轻量交互界面，以月见八千代形象接收主动拖入、展示 Thread 并承接回复。
_Avoid_: Wisp（指代桌宠时）、StatusBubble、ActivityWindow（指代用户可见界面时）

**桌宠对话区**:
桌宠中呈现当前 Thread 气泡、建议选项和回复框的交互区域；回复框专指其中编辑并发送文字的输入区域。
_Avoid_: 对话框（混指整个对话区与回复框时）、ThreadWindow

## 产品命名

**Wisp Pocket**:
本产品的名称。它包含 PromptPanel、ThreadWindow、常驻桌面交互和宿主自动化能力。

## Input

**Attachment**:
用户主动选择并交付的上下文内容，例如文本选区、图片或 PDF；它不是环境的默认快照。
_Avoid_: Ambient Context、Tool Result

**Append Prompt**:
由本地 manifest 定义、追加到 `UserInput` 的可复用提示模板。
_Avoid_: Skill（指代该 manifest 能力时）、Action

## Triggers

**AgentTrigger Package**:
一种触发来源的定义，包含 provider 类型、配置结构和默认策略。
_Avoid_: Plugin、AgentTrigger Instance

**AgentTrigger Instance**:
用户基于 AgentTrigger Package 创建的一条已配置触发规则。
_Avoid_: Automation Policy、AgentTrigger Package

**AgentTrigger Event**:
AgentTrigger Instance 命中后产生的一次事实记录，可渲染为后台 `UserInput`。
_Avoid_: Tool Call、Automation Run

## 拟议概念（多桌宠设计，尚未实现）

以下概念用于多桌宠主入口的设计讨论；不改变上文对当前产品的定义。

**桌宠档案**:
用户配置的一位持续存在的助手身份，关联名称、外观、角色提示和工作偏好；更换外观或桌面位置不改变其身份。
_Avoid_: 皮肤（指代身份时）、Thread、Workspace

**角色提示**:
桌宠档案中的长期角色定位、工作习惯与表达偏好；它不等于某次输入使用的 Append Prompt，也不授予工具执行权。
_Avoid_: 记忆、权限、人设（仅指外观时）

**桌宠席位**:
桌面上展示桌宠的一个位置；可以固定一位助手，也可以在同一位置切换不同助手。
_Avoid_: Workspace、会话归属

**桌宠会话面板**:
从具体桌宠展开、保持该助手和当前对话身份的持续交互表面，用于完整阅读、输入与处理决定。
_Avoid_: 新会话、ThreadWindow（仅因展开尺寸较大而混称时）
