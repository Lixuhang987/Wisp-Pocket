# Issue #9 实施计划

规格以 [Issue #9](https://github.com/Lixuhang987/Wisp-Pocket/issues/9) 为准，基准 91269ccf，隔离目录 .worktrees/issue-9-frontend-pet。已通过 scripts/test.sh 与 swiftw build 基线，CodeGraph projectPath 必须显式使用该 worktree 绝对路径。

## 主路径与合同

- 后端 Thread 创建必须传 workspaceId，删除 Pet 注册表 / 表 / DTO / API / 快照；Workspace 创建只返回 workspace 与 created。保持公开 Thread 生命周期、SQLite、普通输入历史和单次请求回执。
- 前端 Pet 型别在 Web native 下拥有，与后端 DTO 隔离：身份资料、imageRef、revision、isDefault、时间、workspaceId / threadId 可空、visible、size、position。Electron main 的唯一 Pet store 串行持久提交。
- 管理桥扩展 listPets、savePet(input,commandId?)、onPetsChanged、assignPet({petId,workspaceId,threadId})、openWorkspaceThread(workspaceId,threadId)、summonPet(workspaceId)、importPetImage(image)、setPetSize(petId,size)。保留 picker、showPet / hidePet；普通 ThreadWindow sender 不获得管理能力。
- savePet 输入只含可编辑资料及 id / expectedRevision；导入图片返回前端 PetImageRef。图片受管于前端。所有操作失败拒绝 Promise，保留表单；assign / open 只准备空态或 resume，不提交用户输入。
- 设置明确 assign：其他可见 Pet 占用拒绝；隐藏占用可转移。自动 open / Permission：已有关联复用，否则隐藏库存分配。关联需核验 Thread.workspaceId，一次原子提交，不能先写再异步检查。
- renderer 用 bridge.listPets + onPetsChanged 获取宠资料与选择；不从后端获取 Pet。PetThreadController 以 workspaceId 查询历史，创建只传 workspaceId，首轮通过普通 skill Input Item 添加角色，重建重试使用稳定身份。
- 启动 main 查询 / 必要时创建默认 Workspace 后幂等播种默认可见伙伴及十几只隐藏库存；既有全部隐藏状态不被改写。位置、大小和显隐归 Pet store，不 mirror 消息。
- Permission observer 消费全部请求与结束事实，查通用 Thread 元数据后统一分配并 reveal；不查询 ThreadWindow 状态、不抢焦点。无库存最小提示，不新增补货重试。
- Swift PromptPanel 选择并记忆 Workspace，Trigger 配置 Workspace；ThreadWindow 新建删 Pet 选择参数，其他选择 / 草稿保持独立。

## 测试选择与预算

- 先修改既有 agent-server thread-ownership / pet-conversation 和 thread-store 用例：workspace 创建与 thread.start、历史恢复、普通首轮提示、请求结束、后台持续执行。删除专测已移除 Pet API 的负向用例，不新增拒绝旧协议测试。
- 先修改既有 Electron pet-window、pet-identity、pet-interaction：本地 Pet 桥与选择恢复、Permission、不可夺取和接收 ACK；保留拖入、草稿、hover、窗口几何回归。
- 修改现有 Web settings-save / history / input 用例：前端保存、工作区选择、独立新建与提示持久提交。
- 修改 Swift 既有 client / trigger / coordinator 用例：Workspace 投递与选择。
- 新增预算累计 3/4：root 2 个前端公开分配 / 重启恢复用例；Web 1 个管理两级选择用例；后端与 Swift 均未新增，其余改动扩展既有用例。

## 执行与完成门槛

- [x] 主 checkout 初始化独立 worktree / CodeGraph，分层基线通过。
- [x] 后端 agent：packages/core、packages/thread-store、apps/agent-server 及相应测试。
- [x] Web agent：共享协议 / store / 输入控制器、独立 ThreadWindow、设置 Pet / Workspace 管理和 bridge 类型。
- [x] Swift agent：apps/desktop 的 Workspace 目标 client、PromptPanel 与 Trigger 及既有测试。
- [x] root：Electron main store / IPC / preload / window collection、桌宠 renderer 接续与既有测试，集成各端。
- [x] 按用例验证，完整 test.sh、swiftw test / build、Electron build 均成功；最终全套复验见 /tmp/issue9-final-test.log。
- [x] 独立文档审核已读 spec、全部改动目录指南与父链，更新产品 / 根架构 / owning 文档与 manual QA；主 agent 确认返回后完成提交门槛。
- [x] 以固定基准进行 Standards / Spec 独立并行审核，修复后复核无代码阻断。
- [x] 主 agent 已确认独立文档审核返回、manual QA 更新与全部门槛；本记录随 Issue #9 实现提交。

## 独立审核结论

- **规范审核**：图片保存可绕过导入校验、重复变更广播和根架构过期三项发现已修复；图片最终写入 / 恢复校验与单一广播复核通过。
- **规格审核**：首轮迟到确认覆盖安排、右键召唤工作区与 Permission 终态重复召回三项发现已修复；补充显式安排等待期间拒绝被动绑定，最终复核无阻断。
- **文档审核**：无上下文独立 agent 阅读完整 Issue、所有修改目录指南及父链，核对代码并更新根架构、产品、surface、ADR、模块与 manual QA；无文档阻断。
- **实机边界**：本轮自动化与窗口替身不证明完整宿主、多屏、picker、中文 IME、透明命中或非抢焦点体验；待验项保留在 manual QA。
