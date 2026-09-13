# Host Automation

Host Automation 描述宿主能力、按时间保留的活动证据，以及可重复执行和修订的内置自动化流程。

## 宿主能力

**Host Capability**:
读取或改变宿主应用、窗口、屏幕与辅助功能状态的能力，供观察与 Automation 共用。
_Avoid_: Atomic Plugin、Plugin

## 历史观察

**Context History**:
按时间组织的宿主活动记录，用于查询过去的应用、窗口和视觉证据。
_Avoid_: Thread History、完整操作日志

**Activity Sample**:
Context History 中某一时刻的宿主活动证据，可关联应用、窗口、辅助功能内容和截图。
_Avoid_: Agent Activity、Thread Event

**Screenshot Record**:
某一时刻的截图及其缩略图证据，与对应 Activity Sample 关联。
_Avoid_: 用户 Attachment、录屏

## 自动化

**Automation**:
录制宿主操作、保存可复用流程、按需执行并保留执行与修复数据的内置功能。
_Avoid_: 自进化 Agent、AgentTrigger

**Recording Session**:
从开始到停止录制之间保留操作事件和证据的同一次录制。
_Avoid_: Automation Run、Thread

**Automation Policy**:
描述目标、条件分支、受限宿主操作和结果断言的可版本化执行规则。
_Avoid_: AgentTrigger、任意脚本

**Automation Trace**:
录制形成的有序操作与证据记录，可用于创建或修订 Automation Policy。
_Avoid_: Thread History、Automation Run

**Automation Run**:
对某个版本 Automation Policy 的一次实际执行及其步骤进度、证据和最终状态。
_Avoid_: Repair Patch、录制会话

**Repair Request**:
Automation 无法匹配或执行时形成的待修复问题，包含失败原因、进度和已有证据。
_Avoid_: 已修复结果、Permission Request

**Repair Patch**:
根据 Repair Request 或其他明确修复输入形成、可合入 Automation Policy 的结构化修改；它本身不是成功重跑的证明。
_Avoid_: Source Patch、成功的 Automation Run
