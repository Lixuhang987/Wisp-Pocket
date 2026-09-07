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

**StatusBubble**:
显示 Agent Activity 并聚焦已有 ThreadWindow 的轻量状态界面。
_Avoid_: ActivityWindow（指代用户可见界面时）

## 设计中术语（尚未实现）

**Wisp**:
接收并持久保留用户拖入内容、通过轻量对话提出处理建议的桌宠；任何执行都必须由用户明确选择，习惯学习不会产生自动执行权。

## Input

**Attachment**:
用户在提交前主动选择并确认的上下文内容，例如文本选区或图片；它不是环境的默认快照。
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
