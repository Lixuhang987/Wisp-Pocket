# Pet 归前端，Thread 仅归属 Workspace

状态：设计访谈中（2026-10-04），尚未实现；最终一致理解仍待用户确认。目标拟替代 [ADR 0006](./0006-workspace-pet-separation.md) 的 Pet 后端所有权、固定项目归属及 Thread 双归属；ADR 0006 仍描述当前实现。

用户希望桌宠是可以被召到不同工作区的前端伙伴，而不是后端任务身份。后端删除 Pet 概念，Thread 仅关联 Workspace；Pet 列表由前端一级 store 管理，包含角色资料、图片、默认标记、时间与版本、Workspace、当前 Thread，以及可见性、位置和大小等界面状态。代价是角色提示的执行语义、多个窗口的共享状态，以及非桌宠入口的任务上下文必须重新确定，不能沿用后端 Pet 注册表隐式解决。

## 用户已明确的目标

- 启动恢复所有可见 Pet；桌面可见 Pet 均已有固定的当前 Workspace，可有正在接续的 Thread，也可处于新对话空态。
- Pet 管理页支持新建、修改；“修改工作区”是一级操作。Pet 的当前 Thread 为空表示下一次输入新建对话，“新建对话”清空该关联。
- Pet 右键提供“唤出新伙伴”：取一个隐藏 Pet，将其 Workspace 改成当前 Pet 的 Workspace，再显示；无库存时提示需要新建。
- Pet 对话历史按 Workspace 查询，不再仅按 Pet 查询；不同 Thread 的模型历史是否共享不由此推导。
- Workspace 管理页支持选择文件夹创建 Workspace，并以一级入口随机召来一只隐藏 Pet。
- 本次允许破坏性重构，不以保留旧后端 Pet 或旧兼容层为目标。

## 当前待决边界

- 后端是否继续拥有 Workspace 注册表、目录校验和持久化；“只保留 Thread → Workspace”是否只针对 Pet 关系。
- 隐藏 Pet 是否保留原 Workspace / Thread；召到新 Workspace 时是否清空旧 Thread。
- 角色提示是在 Thread 创建时形成通用执行快照，还是每个 Turn 随当前 Pet 提交；打开同工作区其他 Pet 的历史时采用哪个角色。
- 库存的创建、默认 Pet 标记及首次启动的初始 Workspace / Pet 行为。
- 运行中切换 Workspace / 新建对话、同一 Thread 被多个 Pet 打开、Permission 召回和草稿归属。
- Pet 一级 store 的跨 renderer 所有权、持久化位置及图片资源归属。
- PromptPanel / ThreadWindow / AgentTrigger 在后端没有 Pet 后如何选择 Workspace 与角色上下文。
- 本期 Pet / Workspace 删除与目录失效处置、旧开发数据处置和手工验收范围。

## 文档与实施边界

当前产品与 surface 文档继续描述已实现行为，目标入口见本文；访谈确认后更新目标术语与决策，实施后再替换现状说明。规格若需发布，按 [issue tracker](../agents/issue-tracker.md) 发布到 GitHub Issues，不能把本 ADR 当作已通过验收的实现规格。
