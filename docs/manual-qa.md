# 手工验收清单

本文记录已实现、自动化测试不足以证明真实系统行为的回归项。仍未修复的缺陷放 [bugs.md](/Users/mu9/proj/handAgent/docs/bugs.md)。

## 验收前提

- 已完成依赖安装。
- 已通过 `bash ./scripts/test.sh`。
- 已通过 `bash ./scripts/swiftw test`。
- 已通过 `bash ./scripts/swiftw build`。

## 待验收项

### 文档卫生回归

- **范围**：`AGENTS.md`、`README.md`、`DESIGN.md`、`docs/docs.md`、`docs/bugs.md`、`docs/manual-qa.md`。
- **验收步骤**：
  1. 按 `AGENTS.md -> handAgent.md -> docs/docs.md` 阅读，确认 `docs/` 入口只列直接子节点和放置规则。
  2. 打开 `README.md`，确认不再引用缺失的截图资源。
  3. 打开 `DESIGN.md`，确认它只说明设计边界，并把 token 源指向 `design/tokens.json`。
  4. 打开 Settings 相关文档，确认 `SettingsTextField` / `SettingsPage`、dark theme 可读性和 `SwiftLint` 约束仍在模块文档或本文中可追踪。
  5. 打开 `bugs.md`，确认只保留未修复缺陷；已实现待验收项在本文。

### ThreadWindow Radix UI 弹出层迁移

- **状态**：已实现，待实机 QA。
- **自动化验证**：`pnpm --filter handagent-thread-window-web exec vitest run tests/composerInputItems.test.ts`、`pnpm --filter handagent-thread-window-web test`、`pnpm --filter handagent-thread-window-web build`、`bash ./scripts/test.sh`。
- **验收步骤**：
  1. 打开 Electron ThreadWindow，在 Composer 输入 `/`，确认 slash popover 在输入框附近显示且不被裁剪。
  2. 用过滤词、`ArrowUp`、`ArrowDown` 和 `Tab` 验证候选高亮、选择和 textarea 焦点。
  3. 用 `Escape` 和点击外部区域验证 popover 关闭并清除 `/` 前缀。
  4. 缩小窗口高度，确认 popover 自动避让或保持在视口内可滚动。
  5. 点击历史 thread 删除按钮，确认 Radix AlertDialog 居中、`Escape` / 取消不删除、确认后删除。

### AgentTrigger 设置二级菜单与默认内置触发器

- **状态**：已实现，待实机 QA。
- **自动化验证**：`bash ./scripts/swiftw test --filter AgentTriggerStoreTests`、`bash ./scripts/swiftw test --filter AgentTriggerSettingsViewModelTests`、`bash ./scripts/swiftw test`、`bash ./scripts/swiftw build`、`bash ./scripts/test.sh`。
- **验收步骤**：
  1. 备份并删除 `~/.spotAgent/agent-triggers/`，启动桌面 App，确认 Settings -> 触发器一级页直接显示 `Chrome Bookmarks` 与 `System Clock`。
  2. 进入 Chrome Bookmarks 二级页，确认顶部 name / description、空态、新增自动化和返回一级可用。
  3. 创建 Chrome Bookmarks 自动化，验证标题、收藏夹选择和提示词的必填校验；保存后确认列表和 `instances.json` 同步。
  4. 进入 System Clock 二级页连续创建两条自动化，确认列表和磁盘持久化都包含两条。
  5. 删除某条自动化，确认列表立即移除且 runtime reload。
  6. 删除内置 package 目录后重启，确认启动期恢复内置 manifest，且不覆盖用户已有实例。

### 默认 Websearch 与 Responses SSE 回归

- **状态**：已实现，待真实 provider 实机 QA；上次阻塞在本地 provider 返回 401 invalidated oauth token。
- **自动化验证**：`pnpm exec vitest run apps/agent-server/tests/thread/ThreadScopedToolRegistry.test.ts packages/core/tests/tools/websearch-use-cases.test.ts packages/core/tests/permission/security-use-cases.test.ts packages/core/tests/llm/vercel-client.test.ts`、`bash ./scripts/test.sh`。
- **验收步骤**：
  1. 在启动 agent-server 的环境提供有效 `TAVILY_API_KEY`，并配置可用的 OpenAI-compatible `responses` provider。
  2. 提交需要近期信息的问题，确认模型未先调用 `use_tools` 也能直接使用 `web_search`。
  3. 确认 `web_search` 返回 URL、snippet、source；随后让模型用 `fetch_page` 精读其中一个公共 URL。
  4. 确认 Responses SSE 中连续 JSON 事件不会再触发 `JSONParseError`，并能生成最终回答。
  5. 去掉 `TAVILY_API_KEY` 后重启，确认 `web_search` 返回明确缺 key 错误且 App 不崩溃。
  6. 请求抓取 localhost、127.0.0.1 或私网地址，确认 `fetch_page` 拒绝。

### Context History 与自进化 Automation 官方 plugin

- **状态**：已实现，待实机 QA。
- **自动化验证**：`bash ./scripts/swiftw test --filter PluginDynamicToolsTests`、`bash ./scripts/swiftw test --filter ContextHistoryPluginCoreTests`、`bash ./scripts/swiftw test --filter AutomationRuntimeTests`、`bash ./scripts/swiftw test`、`bash ./scripts/swiftw build`、`bash ./scripts/test.sh`。
- **验收步骤**：
  1. 启动桌面 App，确认官方 plugin manifest 写入 `~/.spotAgent/plugins/`；原子 plugin 默认 enabled，Context History 与 Automation runtime 默认 disabled。
  2. 启用 Context History 后重启，确认 dynamic tool 列表包含 activity index、sample details、thumbnails、original screenshot，并且 index 不返回完整 AX 树或原图。
  3. 切换前台 app/window 并等待采样 tick，确认 activity sample、周期 sample 和 60 秒截图记录按预期出现。
  4. 启用 Automation runtime 后重启，确认 record、policy、run、history、repair tools 暴露。
  5. 录制 click / setValue / typeText / hotkey / waitFor / assertion，确认每个 event 含 before/after app-window、AX、screenshot evidence。
  6. 用最小 policy 调用 `automation.run`，失败时确认 run 记录、repair request、fallback patch 和 `automation.history` 都可追踪。
  7. 调用 `automation.repair_apply`，确认 policy version 增加、repair request 变为 `applied`，重复 apply 会失败。
  8. 修改官方 manifest 的非 enabled 字段后重启，确认 installer 修复 manifest 且保留用户 enabled 选择。
