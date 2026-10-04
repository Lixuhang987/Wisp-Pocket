# Pet 归前端，Thread 仅归属 Workspace

状态：已实现（2026-10-04），完整实机待验；规格见 [Issue #9](https://github.com/Lixuhang987/Wisp-Pocket/issues/9)，检查状态见 [实施记录](../medium-powers/plans/2026-10-04-issue-9-frontend-pet.md)，人工步骤见 [manual QA](../manual-qa.md)。本决策替代 [ADR 0006](./0006-workspace-pet-separation.md) 的 Pet 后端所有权、固定项目归属与 Thread 双归属。

用户希望桌宠是可以被召到不同工作区的前端伙伴，而不是后端任务身份。后端删除 Pet 概念，Thread 仅关联 Workspace；Pet 列表由前端一级 store 管理，包含角色资料、图片、默认标记、时间与版本、Workspace、当前 Thread，以及可见性、位置和大小等界面状态。代价是角色提示的执行语义、多个窗口的共享状态，以及非桌宠入口的任务上下文必须重新确定，不能沿用后端 Pet 注册表隐式解决。

## 用户已明确的目标

- 启动恢复所有可见 Pet；桌面可见 Pet 均已有固定的当前 Workspace，可有正在接续的 Thread，也可处于新对话空态。
- Pet 管理页支持新建、修改；“选择工作区”是一级操作。Pet 的当前 Thread 为空表示下一次输入新建对话，“新建对话”清空该关联。
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
- 可见 Pet 的当前 Thread 不得被其他 Pet 夺取，这是前端分配不变量，与 Thread 当前是否执行 Turn 无关。
- 工作区目录失效时保留 Pet 的关联和显隐，明确提示目录不可用并阻止新一轮执行；不自动换目录或工作区。

## 历史与伙伴分配

- Workspace 管理列出该工作区历史，支持打开旧 Thread 或新建对话；历史点击先查全部 Pet 的当前关联，已有则复用并显示，否则分配隐藏 Pet，重复点击幂等。
- 历史分配无库存时只显示需要新建 Pet 的最小提示，不额外提供管理跳转或自动创建流程。
- 手动指定伙伴从“设置 → Pet”进入：选择 Pet，点击一级“选择工作区”，选择任意 Workspace，再选择历史 Thread 或新对话，最后绑定并展示该 Pet。隐藏与可见 Pet 都提供该一级按钮，取消选择不改变原关联。
- 手动选择的 Thread 若已关联另一只可见 Pet，只提示“Thread 正在运行”，不转移、不改变双方状态；该文案表示可见伙伴占用，不根据后端 Turn 运行状态决定能否夺取。若关联的是隐藏 Pet，则解除其旧关联、保留它的 Workspace 和隐藏状态，把 Thread 分配给用户明确选中的 Pet。
- 选择旧 Thread 只恢复对话，不重放旧输入；新对话先为空态，首次发送才创建 Thread。
- 所有 Thread 的 Permission 通知均可触发桌宠承接，与来源前端无关；没有 Pet 关联时从隐藏库存分配，已有则复用。各前端只观察后端通知，不查询另一前端是否正在呈现请求。
- Permission 无库存时只提示任务等待授权且需要新建伙伴，不占用可见 Pet 或自动创建；请求按后端生命周期继续等待，也可由独立 ThreadWindow 回执。

分配必须统一处理，不能由各 renderer 分别“先查询再写入”；两个窗口并发操作也必须遵守以下规则。

| 操作 | 目标 Thread 已关联可见 Pet | 已关联隐藏 Pet | 无 Pet 关联 |
| --- | --- | --- | --- |
| Workspace 历史 / Permission 自动分配 | 复用已有 Pet | 显示并复用已有 Pet | 从隐藏库存分配；无库存只提示 |
| 设置 Pet 页明确指定伙伴 | 已属自己则复用；属于别人则提示并拒绝 | 转移给指定 Pet | 交给指定 Pet |

## 独立前端与初始化

- PromptPanel / AgentTrigger 直接面向 Workspace；ThreadWindow 保持独立前端，不加入 Pet 召唤或选择，不与桌宠选择联动。旧 Pet 协议依赖必须删除，不能据此重设计 ThreadWindow 的其他交互。
- 首次使用自动准备一个 Workspace 和一只可见伙伴。isDefault 仅服务无数据时的首次初始化，不再承担快捷输入默认目标或随机召唤优先级。
- 首版准备十几只内置 Pet 作为库存，其余初始隐藏；用户新建 Pet 默认隐藏且可以未绑定 Workspace。内置库存不意味着自动显示全部伙伴。
- 第一版不提供 Pet / Workspace 删除；不据此撤销已有 Thread 删除能力。

规范术语由 [Desktop Experience](../../apps/desktop/CONTEXT.md) 的 Pet / 角色提示和 [Conversation Runtime](../../packages/core/CONTEXT.md) 的 Thread / Workspace 分别拥有。

## 工程所有权

- Pet 一级 store 由 Electron UI Shell 的 main 统一持有和持久化，设置与宠窗通过 IPC 操作 / 订阅；Electron main 属于前端宿主，不属于 agent-server。Pet 图片导入与受管 data URL 也归前端，不保留后端 Pet 图片表或导入 API。
- Pet 列表保留用户要求的身份、名称、描述、rolePrompt、revision、imageRef、isDefault、时间、Workspace / Thread 和显隐 / 位置 / 大小；Workspace / Thread 关联可为空。Thread 消息、运行和请求仍是后端事实，Pet store 不另存权威历史。
- 所有关联、显隐及转移在同一 store 操作中校验并提交；启动恢复持久状态，初始化幂等，不因重启补出重复伙伴。首轮只通过现有通用 Input Item 承载角色提示，不新增 Pet 字段。
- PromptPanel 使用独立的 Workspace 选择并记住上次选择；AgentTrigger 配置 Workspace；均不读取 Pet store。ThreadWindow 只清理旧 Pet UI / DTO 依赖，不加入桌面管理流程或选择联动。
- 不设计旧开发 schema 兼容层；开发和验收使用隔离数据，不把本次重构当作授权清空用户实际目录。旧开发数据库明确拒绝打开并说明隔离数据方式，不自动迁移或清除旧文件。

## 首版排除与验收

- 草稿转移语义和 Permission 无库存后新增库存的自动重试暂不设计，分别留到 [TODO](../TODO.md)；首版有最小库存不足提示。
- 验证重点：后端无 Pet 类型 / 表 / 协议 / 身份关联，启动可见集合恢复，自动分配幂等，隐藏关联转移与可见占用拒绝，目录失效、后台任务继续、普通角色输入，以及跨前端 Permission 的单次有效回执。
- 自动化用例与窗口替身只证明分配、恢复和协议编排，完整宿主的 picker、焦点、透明命中、多屏与真实模型仍待人工验收。

## 文档与实施边界

产品、surface 和 owning 模块文档描述当前行为；用户故事和验收要求以 [Issue #9](https://github.com/Lixuhang987/Wisp-Pocket/issues/9) 为准。主要测试边界为 Electron 前端公开分配 / 恢复 / 承接操作，后端公开协议验证执行与请求仲裁；本 ADR 的实现状态不表示已通过实机验收。