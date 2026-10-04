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

## 后端与提示边界

- 后端继续拥有 Workspace 注册表、目录校验、持久化与逐 Turn AGENTS.md；只删除 Pet 的后端概念，创建 Workspace 不再自动生成 Pet。
- 后端移除 Pet 注册表、Pet API / 协议、petId、Pet 版本和 Pet 关联；不得用改名后的伙伴身份或伙伴快照继续保存旧概念。
- 本期 Pet 前端只在首轮普通输入中添加角色 prompt，随历史保存，既有 Thread 不随 Pet 角色编辑或伙伴更换而重新注入。后端不识别其 Pet 来源，不新增角色快照或每轮 system 注入；后续用户要求可以改变角色表现。
- 角色提示是本期创建时固定的简化方案；后续策略单独记入 [TODO](../TODO.md)，不扩大本期实现。

## 前端状态与任务

- 隐藏 Pet 保留 Workspace 与当前 Thread。同 Workspace 召唤恢复原对话；跨 Workspace 召唤清空当前 Thread，旧 Thread 仍留在原 Workspace。
- 隐藏 Pet 可以未绑定 Workspace；可见 Pet 必须绑定有效 Workspace。模型允许未绑定库存，不将无 Workspace 的 Pet 展示到桌面。
- 隐藏、清空当前 Thread / 新建对话、切换 Workspace 均允许在任务运行中发生，不取消旧任务；旧 Thread 的 Workspace 和运行状态不随 Pet 变化。
- 同一 Thread 最多关联一只 Pet，隐藏状态也计入独占；ThreadWindow 不属于这项桌宠独占限制。

## 历史与伙伴分配

- Workspace 管理列出该工作区历史，支持打开旧 Thread 或新建对话；历史点击先查全部 Pet 的当前关联，已有则复用并显示，否则分配隐藏 Pet，重复点击幂等。
- 历史分配无库存时只显示需要新建 Pet 的最小提示，不额外提供管理跳转或自动创建流程。
- 手动指定伙伴从“设置 → Pet”进入：选择隐藏 Pet，点击一级“选择工作区”，选择任意 Workspace，再选择历史 Thread 或新对话，最后绑定并展示该 Pet。若 Thread 已关联另一只 Pet，保留用户明确选择，转移给选中的 Pet 并解除旧关联；不套用自动分配的复用规则。
- 选择旧 Thread 只恢复对话，不重放旧输入；新对话先为空态，首次发送才创建 Thread。
- 所有 Thread 的 Permission 通知均可触发桌宠承接，与来源前端无关；没有 Pet 关联时从隐藏库存分配，已有则复用。各前端只观察后端通知，不查询另一前端是否正在呈现请求。
- Permission 无库存时只提示任务等待授权且需要新建伙伴，不占用可见 Pet 或自动创建；请求按后端生命周期继续等待，也可由独立 ThreadWindow 回执。

## 独立前端与初始化

- PromptPanel / AgentTrigger 直接面向 Workspace；ThreadWindow 保持独立前端，不加入 Pet 召唤或选择，不与桌宠选择联动。旧 Pet 协议依赖必须删除，不能据此重设计 ThreadWindow 的其他交互。
- 首次使用自动准备一个 Workspace 和一只可见伙伴。isDefault 仅服务无数据时的首次初始化，不再承担快捷输入默认目标或随机召唤优先级。
- 第一版不提供 Pet / Workspace 删除；不据此撤销已有 Thread 删除能力。

目标术语由 [Desktop Experience](../../apps/desktop/CONTEXT.md) 的 Pet / 角色提示和 [Conversation Runtime](../../packages/core/CONTEXT.md) 的 Thread / Workspace 分别拥有；词表记录已确定目标，不代表旧实现已迁移。

## 当前待决边界

- 新建 Pet 的默认显隐、初始化幂等与默认标记的后续编辑边界。
- 显式转移 Thread 后旧 Pet 的显隐和空态、草稿归属；可见 Pet 是否共用“选择工作区”流程。
- Permission 无库存后补充库存的自动重试，以及目录失效时的召唤行为。
- Pet 一级 store 的跨 renderer 所有权、持久化位置及图片资源归属。
- PromptPanel / AgentTrigger 的具体 Workspace 选择；ThreadWindow 仅清理旧 Pet 依赖。
- Workspace 目录失效处置、旧开发数据处置和手工验收范围。

## 文档与实施边界

当前产品与 surface 文档继续描述已实现行为，目标入口见本文；访谈确认后更新目标术语与决策，实施后再替换现状说明。规格若需发布，按 [issue tracker](../agents/issue-tracker.md) 发布到 GitHub Issues，不能把本 ADR 当作已通过验收的实现规格。
