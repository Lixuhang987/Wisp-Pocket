# Workspace 与 Pet 分离，Thread 保留两种归属

状态：部分设计已确认，尚未实现；剩余问题见 [TODO](../TODO.md)。本决策重新讨论多桌宠历史规格中“Pet 直接替换 Workspace”的选择，不表示当前代码已经拆分。

用户需要多个伙伴共享项目目录及项目指令，同时保持伙伴角色、Thread 和界面偏好独立。将项目上下文作为独立 Workspace，由多个 Pet 引用；Pet 的所属 Workspace 创建后不可更换。同一实际目录只对应一个 Workspace，选择已有目录时复用该身份，项目指令来自 AGENTS.md。规范术语见 [Conversation Runtime](../../packages/core/CONTEXT.md)。

Thread 仍直接归属 Pet，同时持久保存 petId 与 workspaceId。后端根据 Pet 派生 Workspace 归属，并保证两者一致，不能接受客户端任意组合；两种归属均不能因界面选择而改变。桌宠按 petId 查询，ThreadWindow 按 workspaceId 查询；查询同项目的历史不等于合并不同 Thread 的模型上下文或转移 Pet 身份。

相比继续由 Pet 直接拥有文件根，这一选择允许同项目的伙伴共享指令来源，并把项目目录的唯一身份放在一处。代价是增加项目与伙伴的引用约束，以及删除、目录变更和指令加载的独立生命周期；这些规则须在实现前补齐。

可见性继续由前端按稳定 petId 保存，不放入后端业务配置。Workspace 拆分不代替前端对权威身份集合的对账；失效引用的正常清理与残留偏好兜底需要独立落实。当前没有 Pet 删除接口，后续删除不能只处理 visible 而遗漏历史与 AgentTrigger 引用。
