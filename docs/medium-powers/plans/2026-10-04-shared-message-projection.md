# 共享消息投影与空气泡修复

## 已确认合同

用户确认两端共用消息类型与语义，仅渲染不同。截图中的空块来自正文为空、只携带工具调用的 assistant：实时没有正文增量，恢复历史却创建空助手气泡。

- 触发：工具执行后打开 / 恢复历史，再悬停桌宠对话区。
- 结果：两端同用 `ThreadItem`；纯工具助手不形成正文项或气泡，工具仍在 ThreadWindow 展示，Pet 继续隐藏工具。
- 原始 `AgentMessage`、工具调用 / 结果、SQLite 与协议 DTO 保留；共享 UI 投影负责选择展示项。
- 正文空白但有有效建议的助手项保留；附件 / pending 用户消息、错误及 ThreadWindow 运行占位保持可见。流式前导空白保留，以免破坏 Markdown 缩进。
- 点击、hover、草稿、焦点、Markdown 和 Permission 继续现有 surface 合同。

## 现有链路与接口

`AgentMessage → MessageTranslator → ConversationMessage → threadProjection → ThreadItem → ThreadItemBubble / PetMessage`。

实时走 `assistant.delta` / `tool.started` / `tool.finished`，历史走 `thread.snapshot`。两端各持 store 实例，复用同一投影。

新增中立的 `src/messages/`，迁入现有 `ThreadItem` 联合类型与共享助手内容判断；所有消费者直接更新 import，不保留旧路径兼容层。共享投影过滤无正文且无有效建议的历史助手项，渲染器共用正文 / 建议判断。Pet 的最新项选择接纳只有建议的当前助手；建议继续独立呈现，正文容器只在有正文时创建。建议列表与等待标记分片到达时先保留元数据，组合完成后再展示；历史翻译也将只有有效建议的项纳入最新助手选择，避免恢复时丢失等待标记。

## 测试预算与实施顺序

累计新增测试上限 4，本轮新增 2，其余扩展既有用例：

- `apps/agent-server/tests/use-cases/pet-conversation.test.ts`：扩展真实 Thread/Runtime/SQLite 的纯工具调用用例，保存并重建后经桌宠共享 store 检查 user / tool / assistant 消息语义与原始工具历史保留；新增 1 个集成用例，将只有建议的 `AgentMessage` 保存到真实 SQLite，关闭重建后沿真实历史翻译、socket 与 Pet controller 恢复并提交建议。
- `apps/electron-shell/tests/activity-window/pet-interaction.test.tsx` 的“悬停时最新回复和全部建议进入历史的同一滚动区，回复框保持固定节点”：加入空 / 空白助手和工具 snapshot 项，验证正文及附件可见、无空助手气泡；扩展仅建议分片增量与协议 DTO 恢复，并验证按钮可提交。renderer 用例不静态 import 服务端历史翻译，避免服务端依赖进入 Electron 类型检查范围。
- `apps/thread-window-web/tests/messageBubble.test.tsx`：新增 1 个助手流程用例，覆盖空白正文、运行占位、只有建议的回复与工具项显示。

先更新测试观察失败，再实现共享投影；通过后移动类型 / 内容判断并更新所有消费者。检查：`scripts/test.sh`、`scripts/swiftw test`、`scripts/swiftw build`、Electron build。读取并更新修改目录的文档链，独立子 agent 使用空上下文审核；人工验收迁入 `manual-qa.md`。不增加真实模型、系统焦点或完整宿主已验结论。

## 验证与交付状态

- Worktree 与 CodeGraph 已初始化，TypeScript/Web 基线通过。
- 修复前既有 hover 用例复现两个无正文容器，ThreadWindow 助手用例复现纯空白正文；真实 CLI / SQLite 用例复现 resume 后多出空助手项。分片建议元数据与只有建议的历史恢复已补齐；新增后端恢复用例在临时回退旧助手选择规则时实际失败，说明它覆盖等待标记丢失，而非只验证构造后的 DTO。
- 最终后端 `pet-conversation` 15 项、Pet 交互单文件 22 项与消息渲染 4 项通过；本轮新增测试 2。最终 `scripts/test.sh`、Electron build 与 Swift test/build 均通过；Swift 最后一轮后仅改测试。
- 原始工具调用 / 结果保留；两端仍分别渲染，类型已移到中立消息模块。人工验收见 [manual QA](../../manual-qa.md#共享消息投影与空气泡2026-10-04)。没有新增完整宿主或主题几何已验结论。
- 独立文档审核已完成，核对了全部改动目录父链、合同、生产代码与最终测试分工：消息类型迁移、历史过滤、建议分片 / SQLite 等待恢复、Pet 常态 / hover 与工具保留一致；owning 文档及两端 surface 已更新，本轮完成项已移出 TODO，人工验收仍在 manual QA。文档本地链接及 `git diff --check` 通过，未发现阻断不一致。
