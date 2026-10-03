# Workspace 与 Pet 分离，Thread 保留两种归属

状态：领域设计已确认，尚未实现；实施待办见 [TODO](../TODO.md)。本决策重新讨论多桌宠历史规格中“Pet 直接替换 Workspace”的选择，不表示当前代码已经拆分。

用户需要多个伙伴共享项目目录及项目指令，同时保持伙伴角色、Thread 和界面偏好独立。将项目上下文作为独立 Workspace，由多个 Pet 引用；Pet 的所属 Workspace 与 Workspace 的 rootPath 创建后均不可更换。同一实际目录只对应一个 Workspace，选择已有目录时复用该身份。规范术语见 [Conversation Runtime](../../packages/core/CONTEXT.md)。

Thread 仍直接归属 Pet，同时持久保存 petId 与 workspaceId。后端根据 Pet 派生 Workspace 归属，并保证两者一致，不能接受客户端任意组合；两种归属均不能因界面选择而改变。桌宠按 petId 查询。ThreadWindow 展示全部 Workspace，只按 workspaceId 做一级历史分组，不按 petId 筛选或再分组；项目历史查询不合并不同 Thread 的模型上下文或转移 Pet 身份。

新建 Thread 只允许使用目标 Workspace 内的 Pet；明确指定时验证归属，未指定时由后端随机选择该项目的一只 Pet，基础 Pet 也参与候选。可见性是前端状态，不参与后端候选筛选。同一次创建的 commandId 重试必须返回原 Thread 及已选 Pet，不能重新随机选择；角色快照仍在 Thread 创建时固定。

项目指令仅来自 Workspace 根目录的 AGENTS.md，不加载祖先或子目录指令，不另存一份可编辑的数据库指令文本。每个 Turn 开始读取一次，该 Turn 的后续模型调用使用同一份内容，下一 Turn 再读取当前文件。用户本次明确要求优先于项目指令，项目指令优先于 Pet 角色习惯；后端工具边界与 Permission 不由这些文本改变。文件缺失与读取失败的具体反馈作为实现建议在最终规格中明确，不能写成已经验收的行为。

Workspace 首期由创建 Pet 时选择目录自动创建或复用，不新增独立 Workspace 管理页；项目展示名用目录名，AGENTS.md 经现有文件编辑器修改。每次真正创建 Workspace 都额外生成一只基础 Pet，再独立保存用户表单中的 Pet，不把当前表单充当基础 Pet；从 Pet 表单创建新项目会得到“基础 Pet + 用户 Pet”两只，复用已有项目只增加用户 Pet。

Workspace 创建及基础 Pet 生成由同一后端创建流程保证一致，按实际目录去重；已有 Workspace、同请求重试或并发目录复用都不能再次生成基础 Pet。用户 Pet 的同一次保存沿已有 commandId 去重，不因重试变成多只。基础 Pet 表示自动生成的初始成员，不承担未指定 Thread 时的选择优先级，也不改变既有全局默认 Pet 的入口语义。

本轮不新增 Workspace / Pet 的删除、归档或目录修改功能；既有 Thread 删除保持原语义。相比继续由 Pet 直接拥有文件根，这一选择允许同项目的伙伴共享指令来源，并把项目目录的唯一身份放在一处；新增的项目与伙伴引用由后端统一校验与持久化。

可见性继续由前端按稳定 petId 保存，不放入后端业务配置。Workspace 拆分不代替前端对完整权威身份集合的对账；启动 / 重连时清理失效引用并保留有效身份的显示偏好，不用过滤后的项目列表清理全局集合。未来若新增删除，需要另行定义历史、默认项和 AgentTrigger 引用规则。
