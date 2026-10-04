# ThreadWindow：持续推进任务

- **模式**：Operate；阅读历史服务于继续处理任务。
- **范围**：历史侧栏、当前消息区、工具输出、建议、请求面板、Composer；入口 `apps/thread-window-web/src/App.tsx`，由 Electron 承载。
- **用户与频率**：需要完整查看过程、继续输入或找回历史的用户；在单个任务中持续使用，跨任务回访。
- **成功条件**：选中的任务稳定，进展和待决请求清楚，输入及中断作用于正确 Thread。

## 当前 surface 合约

- **THESIS**：把历史选择、任务过程与下一步输入放在一个可持续工作的界面中。
- **OWN-WORLD**：继承共享暖色亮暗主题和紧凑工具界面；用户消息气泡、Assistant 正文与可折叠工具内容分别呈现。
- **STORY**：从 PromptPanel 交接或打开历史 → 阅读进展 → 回答请求/继续输入 → 必要时中断或切换任务。
- **FIRST VIEWPORT**：左侧是新建、搜索和全部 Workspace 的一级项目历史列表，项目内展示全部 Thread；右侧顶部保留窗口错误区，中间消息滚动区，下方为请求面板与固定 Composer。无选择时提示“选择历史或创建新对话”；窄窗口隐藏历史侧栏。
- **FORM**：现有两栏任务窗口；候选弹层和删除确认是局部状态。未选择新结构，seed key 不适用。
- **FINISH**：本次核对结构、选择与输入约束；没有新增尺寸、亮暗主题或真实模型链路的实机验收。

## 状态与约束

| 状态 | 当前行为 |
| --- | --- |
| 历史为空/未选择 | 侧栏提示无历史；任务区显示选择或创建提示 |
| 任务运行 | 消息流式更新，工具内容可查看；可继续提交或按 Stop 中断 |
| 输入待处理 | 后端确认保存后展示 pending；对应 Turn 开始后解除 |
| 请求用户决定 | 固定区域展示权限请求；回复后两界面同步清理请求 |
| 切换任务 | 按 Thread 保留本次页面内的草稿；打开历史加载对应状态 |
| 后台新建 | 更新历史，不抢占用户当前选择；本窗口主动新建才自动选中 |
| 连接断开 | 禁用 Composer，当前不自动重连或恢复订阅 |
| 删除 | 通过确认弹窗执行，取消与 Escape 保留历史 |

文件引用附件与桌宠共用 `file_reference`，消息显示图标与文件名，不自动加载原文件预览或显示路径正文；选区截图仍显示图片副本。

消息类型与助手内容判断共用 [中立消息模块](../../apps/thread-window-web/src/messages/messages.md)。无正文且无当前有效建议的历史助手项不占空块；只有建议时保留可操作选项，运行占位继续显示，工具过程独立呈现。

通用新建先选择 Workspace，组内新建固定本组项目；只提交 workspaceId，同次创建重试保持原 Thread。ThreadWindow 不提供 Pet 选择或分配联动，历史仅按项目分组，不合并各 Thread 的模型上下文；打开旧历史只恢复当前状态，不重放输入。

权限请求可选择本次/永久允许或拒绝；永久决定的作用范围在请求中说明。建议回复是普通输入，不能与权限回执混用。只有消息区滚动不意味着历史侧栏没有独立列表滚动；请求与 Composer 保持固定。

## 证据与待确认

- [模块约定](../../apps/thread-window-web/thread-window-web.md)与[源码索引](../../apps/thread-window-web/src/src.md)。
- 已核对 [ThreadPetPane.tsx](../../apps/thread-window-web/src/components/ThreadPetPane.tsx)、[HistorySidebar.tsx](../../apps/thread-window-web/src/components/HistorySidebar.tsx)、[RequestPanels.tsx](../../apps/thread-window-web/src/components/RequestPanels.tsx)。
- [手工验收](../manual-qa.md)：选择隔离、输入队列、请求、历史、弹出层及连接边界。
- 待确认：窄窗口隐藏侧栏后的历史访问方案，以及首次使用和错误恢复需要多大程度的引导；未将这些问题写成已批准改版要求。
