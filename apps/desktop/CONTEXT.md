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
