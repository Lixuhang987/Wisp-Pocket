# 产品 surface 索引

本目录按用户任务记录 Wisp Pocket 的界面现状，作为后续设计的 surface brief。共享产品背景见 [PRODUCT.md](../PRODUCT.md)，视觉权威为根目录 [DESIGN.md](../../DESIGN.md) 与其引用的 token 源。

## 直接子节点

| Surface | 用户任务 | 文档 |
| --- | --- | --- |
| PromptPanel | 随手组织请求、确认资料并发起任务 | [prompt-panel.md](./prompt-panel.md) |
| 桌宠 | 点击输入或拖入资料、查看当前回复并轻量接续 | [desktop-pet.md](./desktop-pet.md) |
| ThreadWindow | 查看完整过程、继续任务、处理请求和找回历史 | [thread-window.md](./thread-window.md) |
| Settings | 配置模型、能力、触发规则与个人偏好 | [settings.md](./settings.md) |

## 拆分与使用边界

- 四个主要 surface 都属于同一个桌面产品；Electron 的 AI / Agent / Pets / Workspaces 与原生宿主设置在 Settings brief 内展开，不按工程包拆分产品。
- 附件 chip、预览、候选弹层、删除确认与权限请求属于宿主 surface 的组件或状态；共享组件不单独建立视觉身份。
- 系统快捷键、截图与选区采集接入 PromptPanel；系统菜单“设置…”接入 Settings。系统权限弹窗由 macOS 管理，不是产品自有页面。
- Chrome 扩展目前只有后台 service worker，未声明 popup 或 options 页面；其连接与规则配置属于原生 Settings → 触发器。
- Context History 通过默认历史读取工具与设置状态接入，Automation 通过工具和独立开关接入；未建立独立时间线、录制编辑器或流程管理页面。后端服务和存储包不构成 surface。
- README 与开发文档是阅读资料，未作为本轮桌面界面拆分对象；未发现需要记录为已实现 surface 的独立营销站或 onboarding 向导。

## 状态记录方法

2026-10-04 按 Issue #9 更新前端伙伴所有权、Workspace 管理与历史、独占分配和任意来源 Permission 承接；ThreadWindow 只面向 Workspace，PromptPanel / AgentTrigger 独立选择目标。Issue #8 的模型、工具与设置保存边界继续保留；完整宿主实机验收仍待进行。

2026-10-02 已按 Issue #6/#7 更新多宠管理、历史选择、路径交付和常驻采集事实，原生及真实模型未复验；2026-10-03 按用户修订更新桌宠右键菜单、身份标题与目录隐藏、文件草稿工具行及悬停定位，逐宠对话显隐恢复继续保留。初始记录以提交 `ad9e731` 的代码及现有文档为基线；2026-09-15 合入 `codex/pet-compact-hover-20260914` 的 `f54d09f` 后更新桌宠记录，点击输入、常态收紧与悬停统一滚动属于当前实现。按 new-work 的“确认既有事实 → 识别 surface 任务 → 继承既有视觉世界 → 写 brief”记录，保留 THESIS、OWN-WORLD、STORY、FIRST VIEWPORT、FORM、FINISH 六块，明确这是现状描述，不是新设计审批。

初始文档整理没有实现或替换界面，因此未进行概念抽签或视觉 finish review；本次合并只更新已实现的桌宠现状，构建检查与实机验收各自记录，不新增 seed key 或已批准 comp。各 brief 的模式只在各自文档记录；共同产品事实与 token 不复制进去。

证据分为代码支持、既有实机记录和待验证三层：初始 brief 整理只核对入口代码、主要布局和模块约定，未启动 App 或新增截图。2026-10-03 新增独立 Electron 受控空对话坐标与菜单截图证据，仅覆盖该布局链路，不宣称完整宿主或全产品视觉验收。仓库内未建立当前界面的完整截图基线；现有角色图集不是界面截图。[manual-qa.md](../manual-qa.md) 中各项结论只在原记录范围内有效。

## 后续修改入口

编写或修订涉及界面的 spec、筛选调研结论、进入具体 surface 设计前，都先读取对应 brief 的交互合约与源码目录指南，核对记录是否仍与代码一致；局部增加或调整继承现有视觉系统。未经用户明确要求改变的交互作为保留基线，研究推荐不能默认覆盖。只有用户要求新建完整 surface 或替换视觉世界时，才继续 new-work 的方案选择和构建流程。

本次 brief 集中放在 `docs/surfaces/`，通过文档树发现。Impeccable helper 当前按源码 target 分配各子 app 的 `.impeccable/surfaces/`；本轮未生成另一份自动加载副本，使用 helper 前应显式读入本目录对应 brief。
