# Host Automation

Host Automation 描述可安装的宿主能力、历史观察数据，以及可回放和修复的自动化策略。

## Capability Packaging

**Plugin**:
由 Swift Host 管理、通过 manifest 声明能力并可提供 Dynamic Tool 的本地进程包。
_Avoid_: Append Prompt、MCP Server、AgentTrigger Package

**Plugin Manifest**:
Plugin 的身份、生命周期、能力依赖和 Tool 声明。
_Avoid_: Action Manifest、AgentTrigger Package Manifest

**Atomic Capability**:
可独立读取或改变一类宿主状态的最小能力，供更高层观察或 Automation 组合。
_Avoid_: Automation Policy、Workflow

## Observation

**Context History**:
按时间组织的宿主活动记录，用于查询过去的应用、窗口和视觉证据。
_Avoid_: Thread History、Audit Log

**Activity Sample**:
Context History 中某一时刻的宿主活动证据，可关联应用、窗口、AX 信息和截图。
_Avoid_: Agent Activity、Thread Event

## Automation

**Automation Policy**:
描述目标、条件分支和受限宿主操作的可版本化执行规则。
_Avoid_: AgentTrigger、Macro、Script

**Automation Trace**:
由录制或执行产生的有序证据，用于归纳、验证或修复 Automation Policy。
_Avoid_: Thread History、Run Log

**Repair Request**:
Automation 无法匹配或执行时产生的待修复问题，包含失败证据和人工接管上下文。
_Avoid_: Bug、Permission Request

**Repair Patch**:
根据 Repair Request 形成、可合入 Automation Policy 的结构化修改。
_Avoid_: Source Patch、Prompt
