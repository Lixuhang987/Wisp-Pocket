# Desktop Experience

Desktop Experience 描述用户在 macOS 上发起、查看和配置 Agent 工作的产品界面与主动输入边界。

Pet 术语按 [ADR 0007](../../docs/adr/0007-frontend-pet-workspace-threads.md) 已确认目标更新，尚未实现；旧模型见 [ADR 0006](../../docs/adr/0006-workspace-pet-separation.md)。

## 伙伴

**Pet**:
具有稳定身份、形象和角色设定的前端伙伴，可更换所绑定的 Workspace 并选择该工作区的 Thread；可见时必须绑定有效 Workspace，隐藏时可以未绑定。
_Avoid_: Workspace、Profile（指代伙伴身份时）、基础 Pet（指代工作区自动生成的伙伴时）

**当前 Thread**:
某只 Pet 当前选择接续的 Thread，可以运行中、已结束或等待输入；改变这项选择不等于结束旧 Thread 的任务。
_Avoid_: 正在执行的 Thread（指代前端选择时）

**角色提示**:
Pet 在新建对话时添加的提示内容；它不建立 Thread 对 Pet 的归属，也不因伙伴之后更换或修改而重新注入既有对话。
_Avoid_: Pet Snapshot（指代后端伙伴身份快照时）

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
Wisp Pocket 的常驻轻量交互界面，以某个 Pet 的形象接收主动输入、展示其 Thread 并承接回复。
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
用户基于 AgentTrigger Package 创建、明确指定目标 Workspace 的一条触发规则。
_Avoid_: Automation Policy、AgentTrigger Package

**AgentTrigger Event**:
AgentTrigger Instance 命中后产生的一次事实记录，可渲染为后台 `UserInput`。
_Avoid_: Tool Call、Automation Run
