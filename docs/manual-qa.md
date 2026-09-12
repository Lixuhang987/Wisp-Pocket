# 手工验收清单

本文记录已实现、自动化测试不足以证明真实系统行为的回归项。仍未修复的缺陷放 [bugs.md](/Users/mu9/proj/handAgent/docs/bugs.md)。

## 验收前提

先完成依赖安装，并通过 `bash ./scripts/test.sh`、`bash ./scripts/swiftw test` 和 `bash ./scripts/swiftw build`。

## Wisp Pocket 品牌与桌宠命名

- **状态**：已实现，待打包与实机确认。
- **自动化验证**：`bash ./scripts/test.sh`、`bash ./scripts/package-app.test.sh`、`bash ./scripts/swiftw build`。
- **验收步骤**：
  1. 打包后确认产物名称为 `dist/Wisp Pocket.app`，Finder、Dock 和菜单栏显示名为 `Wisp Pocket`。
  2. 打开 PromptPanel、ThreadWindow、权限错误提示和 Chrome Bookmarks 扩展相关界面，确认用户可见产品名统一为 `Wisp Pocket`。
  3. 确认桌宠相关文案使用“桌宠”或“月见八千代”，不把桌宠称为“Wisp”。
  4. 确认 Swift target、npm package、环境变量和协议事件等内部构建标识仍可正常工作。

## 文档卫生回归

- **范围**：`AGENTS.md`、`CONTEXT-MAP.md`、三个 `CONTEXT.md`、`handAgent.md`、`README.md`、`DESIGN.md`、各级目录指南与 `docs/*.md`。
- **验收步骤**：
  1. 按 `AGENTS.md -> CONTEXT-MAP.md -> 相关 CONTEXT.md -> handAgent.md -> apps/packages/docs` 阅读，确认每级索引只列直接子节点。
  2. 检查三个 `CONTEXT.md`：每个术语只有一个 owner，定义不包含类名、路径或实现步骤，并明确必要的 Avoid 同义词。
  3. 抽查 Thread、Append Prompt、AgentTrigger 与 Automation 文档，确认使用 glossary 规范词，没有重新复制术语定义。
  4. 打开 `README.md`，确认产品术语一致且不引用缺失资源；打开 `DESIGN.md`，确认 token 源只指向 `design/tokens.json`，不再链接已删除过程稿。
  5. 打开 Settings 相关文档，确认 `SettingsTextField` / `SettingsPage`、dark theme 可读性和 `SwiftLint` 约束仍可追踪。
  6. 打开 `bugs.md`，确认只保留未修复缺陷；已实现待验收项在本文。
  7. 从 `AGENTS.md` 的 `Agent skills` 区块进入 `docs/agents/`，确认 GitHub Issues、默认 triage 标签和 multi-context 消费规则仍一致。

## ThreadWindow Radix UI 弹出层迁移

- **状态**：已实现，待实机 QA。
- **自动化验证**：`pnpm --filter handagent-thread-window-web exec vitest run tests/composerInputItems.test.ts`、`pnpm --filter handagent-thread-window-web test`、`pnpm --filter handagent-thread-window-web build`、`bash ./scripts/test.sh`。
- **验收步骤**：
  1. 打开 Electron ThreadWindow，在 Composer 输入 `/`，确认 slash popover 在输入框附近显示且不被裁剪。
  2. 用过滤词、`ArrowUp`、`ArrowDown` 和 `Tab` 验证候选高亮、选择和 textarea 焦点。
  3. 用 `Escape` 和点击外部区域验证 popover 关闭并清除 `/` 前缀。
  4. 缩小窗口高度，确认 popover 自动避让或保持在视口内可滚动。
  5. 点击历史 thread 删除按钮，确认 Radix AlertDialog 居中、`Escape` / 取消不删除、确认后删除。

## AgentTrigger 设置二级菜单与默认 Package

- **状态**：已实现，待实机 QA。
- **自动化验证**：`bash ./scripts/swiftw test --filter AgentTriggerStoreTests`、`bash ./scripts/swiftw test --filter AgentTriggerSettingsViewModelTests`、`bash ./scripts/swiftw test`、`bash ./scripts/swiftw build`、`bash ./scripts/test.sh`。
- **验收步骤**：
  1. 备份并删除 `~/.spotAgent/agent-triggers/`，启动桌面 App，确认 Settings -> 触发器一级页直接显示 `Chrome Bookmarks` 与 `System Clock`。
  2. 进入 Chrome Bookmarks 二级页，确认顶部 name / description、空态、新增自动化和返回一级可用。
  3. 创建 Chrome Bookmarks AgentTrigger Instance，验证标题、收藏夹选择和提示词的必填校验；保存后确认列表和 `instances.json` 同步。
  4. 进入 System Clock 二级页连续创建两条 AgentTrigger Instance，确认列表和磁盘持久化都包含两条。
  5. 删除某条 Instance，确认列表立即移除且 runtime reload。
  6. 删除内置 package 目录后重启，确认启动期恢复内置 manifest，且不覆盖用户已有实例。

## 默认 Websearch 与 Responses SSE 回归

- **状态**：已实现，待真实 provider 实机 QA；上次阻塞在本地 provider 返回 401 invalidated oauth token。
- **自动化验证**：`pnpm exec vitest run packages/core/tests/tools/websearch-use-cases.test.ts packages/core/tests/permission/security-use-cases.test.ts packages/core/tests/llm/vercel-client.test.ts`、`bash ./scripts/test.sh`。
- **验收步骤**：
  1. 在启动 agent-server 的环境提供有效 `TAVILY_API_KEY`，并配置可用的 OpenAI-compatible `responses` provider。
  2. 提交需要近期信息的问题，确认模型未先调用 `use_tools` 也能直接使用 `web_search`。
  3. 确认 `web_search` 返回 URL、snippet、source；随后让模型用 `fetch_page` 精读其中一个公共 URL。
  4. 确认 Responses SSE 中连续 JSON 事件不会再触发 `JSONParseError`，并能生成最终回答。
  5. 去掉 `TAVILY_API_KEY` 后重启，确认 `web_search` 返回明确缺 key 错误且 App 不崩溃。
  6. 请求抓取 localhost、127.0.0.1 或私网地址，确认 `fetch_page` 拒绝。

## Context History 与自进化 Automation 官方 Plugin

- **状态**：已实现，待实机 QA。
- **自动化验证**：`bash ./scripts/swiftw test --filter PluginDynamicToolsTests`、`bash ./scripts/swiftw test --filter ContextHistoryPluginCoreTests`、`bash ./scripts/swiftw test --filter AutomationRuntimeTests`、`bash ./scripts/swiftw test`、`bash ./scripts/swiftw build`、`bash ./scripts/test.sh`。
- **验收步骤**：
  1. 启动桌面 App，确认官方 Plugin Manifest 写入 `~/.spotAgent/plugins/`；Atomic Capability Plugin 默认 enabled，Context History 与 Automation 默认 disabled。
  2. 启用 Context History 后重启，确认 Dynamic Tool 列表包含 activity index、sample details、thumbnails、original screenshot，并且 index 不返回完整 AX 树或原图。
  3. 切换前台 app/window 并等待采样 tick，确认 activity sample、周期 sample 和 60 秒截图记录按预期出现。
  4. 启用 Automation runtime 后重启，确认 record、policy、run、history、repair tools 暴露。
  5. 录制 click / setValue / typeText / hotkey / waitFor / assertion，确认每个 event 含 before/after app-window、AX、screenshot evidence。
  6. 用最小 policy 调用 `automation.run`，失败时确认 run 记录、repair request、fallback patch 和 `automation.history` 都可追踪。
  7. 调用 `automation.repair_apply`，确认 policy version 增加、repair request 变为 `applied`，重复 apply 会失败。
  8. 修改官方 manifest 的非 enabled 字段后重启，确认 installer 修复 manifest 且保留用户 enabled 选择。

## Issue #3 前后端状态所有权收敛

- **状态**：前端职责拆分与后端保留核查已完成，尚未进行桌面实机回归；自动化与提交前检查结果见 [规格入口](./issue-3-design.md)。构建、store 测试与静态组件渲染不计作以下验收。
- [ ] **草稿隔离与提交**：在 Thread A、B 分别编辑含文本和 Input Item 的草稿，来回切换确认各自保留；分别提交后只清空本 Thread 的草稿，运行中提交仍进入等待队列。
- [ ] **页面重建与偏好**：调整 Workspace 分组展开，编辑草稿并展开消息或工具详情后重载 Web 页面；草稿与组件临时展开恢复初始状态，Workspace 分组展开保留，搜索词清空。
- [ ] **派发与等待**：空闲时提交一条，运行时继续提交多条并移除中间等待项；配合可控后端延迟 `turn.started`，确认每 Thread 只交接一条，收到开始并结束后按剩余顺序继续，A、B 互不影响。
- [ ] **首轮关联与占位**：经 preload initial-prompt fallback 连续创建两个 Thread，交错返回创建通知；核对各自先加载再提交首轮，snapshot 保留待确认占位，正式输入记录替换原占位且内容不串线。
- [ ] **历史与流式展示**：显式打开历史 Thread，核对文本、图片、Append Prompt 和文本选区内容；连续回复更新同一消息，重复 assistant delta 不重复显示。后台创建导致选中项切换仍按 [既有缺陷](./bugs.md) 单独复现，不记为本轮已修复。
- [ ] **请求面板**：在不同 Thread 触发 Permission / Workspace 请求，回答后确认只清理对应面板；分别检查完成、中断、失败和 Thread error 后的请求清理及另一 Thread 的面板保留。
- [ ] **连接与缓冲**：延迟 socket open，核对已缓冲命令和 ClientResponse 的发送顺序；意外断连后显示 disconnected 并禁用 Composer，保持无自动重连、订阅恢复或待答请求补发的现状。
- [ ] **宿主窗口回执**：关闭 Settings 后从 PromptPanel 提交，确认隐藏面板时 Swift Host 回落到 accessory；ThreadWindow 打开回执和关闭均不再次改变 Swift Host 的 Dock / Cmd+Tab 可见性。本轮只校正相关测试的观察阶段。

## Issue #2 后端 Thread 所有权重构

- **自动化状态**：实现与自动化回归已提交；以下项目保留为真实 agent-server / UI 环境的人工验收。
- [ ] 启动 agent-server，创建两个 Thread；分别连续提交两轮输入，确认历史和流式通知不串线。
- [ ] 执行期间关闭全部 Thread UI 连接，确认 Turn 继续运行；重新连接后用 `thread.resume` 读取结果。
- [ ] 在权限请求中分别选择“本次允许”和“永久允许”，确认永久规则在另一 Thread、不同参数和重启后仍按完整工具名称命中。
- [ ] 在执行中删除 Thread，确认后端报告删除成功且晚到模型 / Tool 结果不会重新创建历史。
- [ ] 人工注入数据库写入失败，确认 Thread 暂停后续输入，恢复后只基于已保存历史继续。
