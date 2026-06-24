# thread-window-web

`apps/thread-window-web` 是 React ThreadWindow 前端。生产路径只由 Electron `BrowserWindow` 承载，并接收 PromptPanel submit、openHistory 和 focus。本文只记录修改本目录代码前必须知道的包内前提；整体调用链和 apps 层职责见上级文档。

## 目录职责

| 路径 | 职责 |
|------|------|
| `src/App.tsx` | ThreadWindow 根组件，创建 `ThreadSocketClient`，安装初始 prompt receiver，连接 store 与 UI。 |
| `src/protocol/threadProtocol.ts` | Web 侧协议编码、类型导出和入站类型守卫；类型来源是 `@handagent/core/protocol/*`。 |
| `src/thread/threadSocketClient.ts` | `/api/thread` WebSocket client，负责连接、发送队列、初始 prompt 首轮流程和入站消息分派；非主动断开只上报 `disconnected`，不做任何断线恢复。 |
| `src/store/threadWindowStore.ts` | `zustand + immer` store，是 `threadsById`、历史、消息、请求、workspace 列表和窗口错误的状态源；不保存当前右侧展示的 thread。 |
| `src/native/nativeConfig.ts` | 读取 host 注入的 thread WebSocket URL / `availableSkills`，安装 `window.handAgentReceiveInitialPrompt`。 |
| `src/native/themeConfig.ts` | 读取 host 注入的初始 theme，设置 `documentElement.dataset.theme`，订阅 `handAgentSubscribeThemeChange`。 |
| `src/components/` | ThreadWindow UI 组件：历史侧栏、固定右侧 thread 工作区、消息列表、composer、权限与 workspace 请求面板。 |
| `src/utils/` | 纯函数工具：workspace 分组、侧栏响应式布局、className 合并。 |
| `tests/` | Vitest 测试。`use-cases/` 覆盖 initial prompt、socket client、history 和 composer 队列主路径；`boundaries/` 覆盖协议 guard、native config 和 theme config；组件、滚动容器、持久化和 design token 保留少量边界测试。 |

`dist/` 与 `node_modules/` 是生成或安装产物，不作为文档索引维护对象。

## 运行边界

- React 直接持有 `/api/thread?subscribeNewThreads=1` WebSocket，负责完整 ThreadWindow UI 状态、历史、请求面板和 composer 输入。Swift 只在 PromptPanel 首轮路径发送 `thread.start` / `op.submit(UserInput)` 并等待 `thread.started` / `thread.error`，不处理持续 `ThreadNotification` 或 `ServerRequest`。
- Electron preload 注入 `window.handAgentThreadWindowConfig`、`window.handAgentTheme`、`window.handAgentSubscribeThemeChange` 和 `window.handAgentReceiveInitialPrompt`。其中 `handAgentThreadWindowConfig` 同时提供 `/api/thread?subscribeNewThreads=1` URL、宿主只读 `availableSkills` 与默认 `dynamicTools`；React 不持久化主题，只把宿主 resolved theme 写到 `data-theme`；thread 数据仍直接连接 `/api/thread`。host tool 由 thread metadata 中的 dynamic tools 激活后暴露。
- `ThreadSocketClient` 只处理收发、发送队列和通知副作用，不直接写 UI；UI 状态由 store action 更新。React 和 app-server 之间本次视为稳定长连接，非主动断开后只把连接状态置为 `disconnected`，不重连、不恢复订阅、不拉取 snapshot、不发送任何恢复命令。
- 组件只通过明确 props、store action 或根组件 callback 触发行为，不应绕过根组件直接操作 WebSocket。
- 当前不把 ThreadWindow thread 缓存、消息或历史同步给 Swift；StatusBubble 状态由 Electron ActivityWindow renderer 订阅 `/api/activity`。

## Thread 协议前提

Web 侧命令和通知类型以 `packages/core/src/protocol/` 为真相，`src/protocol/threadProtocol.ts` 只做本包需要的 encode / guard 封装。

当前 Web 包必须覆盖这些协议点：

- 出站 `ThreadCommand`：`thread.start`、`thread.resume`、`thread.list`、`thread.delete`、`op.submit(RuntimeOp)`、`workspace.list`。React 只构造 `UserInput | Interrupt`，不构造 app-server 内部的 `client_response` Op。
- 入站 `ThreadNotification`：消息流、tool 流、状态变化、`thread.listed`、`thread.deleted`、`thread.error`、`workspace.listed`。
- 入站 `ServerRequest`：`permission.requested` 与 `workspace.requested`。
- 出站 `ClientResponse`：`permission.answered` 与 `workspace.answered`；app-server 会把它们包装为 Agent `client_response` Op。

`workspace.listed` 已在协议守卫和 store 中覆盖：socket 连接成功后发送 `workspace.list`，store 收到后写入 `workspaces`，历史侧栏再按 `ThreadListEntry.workspaceId` 分组。修改 workspace 相关 UI 或协议时，必须同步检查 `src/protocol/threadProtocol.ts`、`src/store/threadWindowStore.ts`、`src/utils/groupThreads.ts` 和对应测试。

## Thread 创建流程

Electron preload 会在 renderer 启动早期注入：

- `window.handAgentThreadWindowConfig.threadWebSocketURL`
- 临时 `window.handAgentReceiveInitialPrompt`
- `window.handAgentPendingInitialPrompts`

生产 PromptPanel 提交流程由 Swift 直连 `/api/thread` 完成：Swift 发送带默认 `dynamicTools` 的 `thread.start`，收到 `thread.started.threadId` 后发送首轮 `op.submit(UserInput)`，再让 Electron open/focus 对应 React ThreadWindow。React 的预热连接使用 `subscribeNewThreads=1`，收到 `thread.started` 后创建本地 `ThreadState` 并切换右侧当前 thread，后续 live notification 继续由同一连接分发。

Electron `thread_window.open_initial_prompt` 和 preload receiver 仍保留给 fallback / 测试路径。React `App` 挂载后通过 `installInitialPromptReceiver` 替换正式 receiver，并 flush 早到的 pending prompt。

fallback initial prompt 流程仍是先建 thread，再提交首轮输入：

1. `App` 收到 `InitialPromptPayload` 后先写入 store 的 `pendingInitialPrompts`。
2. `ThreadSocketClient.startInitialPrompt` 发送 `thread.start`，`commandId` 使用 `clientRequestId`；action/skill 信息已经在后续首轮 `op.submit(UserInput)` 的 `items` 中。ThreadWindow composer 自己的 slash skill 候选只来自 preload 注入的 `availableSkills`，不通过 `/api/thread` 单独请求。
3. 收到匹配 `commandId` 的 `thread.started` 后，store 创建对应 `ThreadState`，`App` 把该 `threadId` 设为右侧当前展示 thread；socket client 发送 `thread.resume` 拉取初始 snapshot，再发送首轮 `op.submit(UserInput)`。
4. 若收到匹配 `commandId` 的 `thread.error`，socket client 清理 pending prompt，store 暴露窗口级错误，不再补发 `op.submit`。

这个顺序同时保护“先建 thread 再补首轮输入”和“WebSocket 未 open 时排队发送”的场景；相关测试在 `tests/use-cases/initial-prompt-flow.test.ts`、`tests/use-cases/history-and-composer.test.ts`、`tests/boundaries/protocol-native-theme.test.ts`。

## Store 与 UI 状态

`createThreadWindowStore` 管理以下用户可见状态：

- 连接状态：`disconnected`、`connecting`、`connected`。
- 历史：`history` 由 `thread.listed` 提供初始快照；当前连接内新建或继续运行的 thread 还会通过 `thread.started`、`user.message.recorded`、`turn.completed` 和 `thread.status.changed` 增量 upsert 到侧栏，避免完成后必须刷新页面才看到新 thread。
- thread 状态缓存：`threadsById` 中每个 `ThreadState` 持有 `threadId`、title、run status、messages、pending initial prompt、权限请求、workspace 请求、composer 队列和 thread 级错误。`thread.snapshot.messages[].inputItems` 与 `user.message.recorded.payload.items` 会落到 `ThreadMessage.userInputItems`，供用户消息结构化回显。右侧当前展示的 `activeThreadId` 是 `App` 本地 React state，不进入 store。
- 请求面板：`permission.requested` / `workspace.requested` 按 `threadId` 放到对应 `ThreadState`；用户回答后根组件发送 response 并调用显式 resolve action 移除请求。若 request 没有走到显式回答分支，store 也必须在 `turn.completed`、`thread.error` 或 `thread.status.changed` 收敛到非 `running` 状态时兜底清空失效 request，避免终态 thread 继续残留旧的允许/拒绝面板。
- composer 输入：`ThreadWorkspacePane` 按 thread 持有受控 `InputItem[]`，`Composer` 只通过 `inputItems` / `onInputItemsChange` 渲染和回写变化；提交后发送完整 `UserInput.items` 并重置为唯一空 text item。结构化输入和排队 op clone 使用 `structuredClone`，不要恢复按 item type 手写拷贝。目标 thread running 或已有 queued input 派发中时，`App` 不立即发送下一条 `op.submit(UserInput)`，而是写入对应 `ThreadState` 的 `queuedComposerInputs` 并在 Composer 上方展示队列；等对应 thread 离开 running 且连接可用后，每个 thread 一次只取一条 queued input 发送，防止多个 user message 连续插到当前 assistant 回复前。停止按钮发送 `op.submit(Interrupt)`。
- workspace：`workspaces` 来自 `workspace.listed`，`expandedWorkspaceIds` 和 `searchQuery` 驱动历史侧栏；`expandedWorkspaceIds` 通过 `zustand/middleware` 的 `persist` 写入 `localStorage`，刷新或重开同一 ThreadWindow 前端后保留展开状态，并兼容旧版裸数组存储格式。
- 去重：`processedNotificationIds` 防止重复处理同一 notification，特别是 streaming delta。

打开历史 thread 时，`HistorySidebar` 触发根组件调用 `ensureThreadState(threadId)` 创建后台缓存，并由 `App` 本地 state 切换右侧 `activeThreadId`；随后根组件调用 `resumeThread(threadId)` 等待 `thread.snapshot` 回填消息。这里的 `thread.resume` 是用户打开历史 thread 的加载入口，不是断线恢复机制。

## 布局与组件约束

- 左侧历史侧栏宽度由 `getThreadWindowSidebarLayout` 计算：窗口宽度 `< 760px` 时隐藏；否则取窗口宽度 30%，限制在 220px 到 320px。
- 全局 `html/body/#root` 固定为 `100%` 高宽并隐藏页面级 overflow；不要在 `body` 上设置最小宽度，否则窄窗口会回到页面横向滚动。
- 左侧历史侧栏自身固定为视口高度；Header、新建按钮和搜索框保持固定，只有 workspace/thread 列表区域使用 `overflow-y-auto`。
- 历史侧栏使用 `groupThreadsByWorkspace` 将 `workspaceId: null` 的 thread 归入”默认对话”，并固定放在 workspace 分组之后。
- 右侧 workspace 是固定高度 grid：窗口错误提示和 Composer 不参与主滚动；只有 `MessageList` 是对话纵向滚动容器。
- 窗口错误提示行由常驻 slot 占位，错误为空时高度为 0，避免 active content 与 Composer 因 grid 自动放置而前移。
- 页面级横向滚动必须保持关闭；右侧不再有 tab 横向滚动容器，消息区、Composer、请求面板均使用 `min-w-0` / `overflow-x-hidden` 或换行布局避免撑宽窗口。
- `WorkspaceGroup` 使用 Radix `Accordion.Item/Header/Trigger/Content`，父级 `HistorySidebar` 的滚动列表必须由 `Accordion.Root type="multiple"` 包裹，并以 `expandedWorkspaceIds` 作为受控 `value`，否则 workspace 分组渲染时会因缺少 Radix 上下文导致 React 挂载失败。
- `WorkspaceGroup` 头部布局：文件夹图标（lucide-react `Folder` / `FolderOpen` 按展开状态切换）+ workspace 名称 + 操作按钮组（更多选项 `MoreHorizontal` + 删除 `X`）。操作按钮默认 `opacity-0`，`group-hover` 时显示。子项使用 `pl-6` 缩进，与文件夹图标右侧对齐。
- `ThreadItem` 是 `HistorySidebar` 默认分组和 `WorkspaceGroup` 子项共用的组件；preview 和 updatedAt 在同一行显示，preview 使用 `truncate` 截断，时间使用 `flex-shrink-0` 保持可见。相对时间格式化为“刚刚”、“N小时”、“N天”或“M月D日”。
- `ThreadItem` 运行状态指示器：从 store 读取 `threadsById[thread.id]?.status`，当 `status === 'running'` 时在删除按钮之前显示 accent 脉冲圆点。
- `ThreadItem` 选中状态使用整行 `bg-app-accent-subtle` 高亮，并保留 `aria-current="page"` 语义标记；禁止使用会被误读为图片描边的 `border`、`shadow` 或点击后常驻 focus ring。键盘导航仅在 `focus-visible` 时显示焦点 ring，hover 背景只用于未选中项。
- `Composer` 以受控 `InputItem[]` 作为真实输入状态，渲染输入框内 prefix chips 和唯一 editable text item；提交时发送完整 `UserInput.items`。开头输入 `/` 时会基于宿主注入的 `availableSkills` 在输入框上方显示 Popover 形式的 slash 菜单（Portal 渲染，自动碰撞检测）。菜单必须使用 Radix `--radix-popover-trigger-width` 匹配输入框宽度，并用 `--radix-popover-content-available-height` 约束最大高度；窄高窗口中即使没有翻转到下方，也必须完整留在视口内且可滚动。`ArrowUp`/`ArrowDown` 在候选列表中导航，`Tab` 选择当前高亮 skill：追加一个 `skill` item、清空唯一 text item，并保持焦点留在 textarea。`Escape` 清除 `/` 前缀文本并关闭菜单。没有匹配 skill 时必须显示可见空态，不能留下无内容的空白菜单。不要恢复 `createUserInputFromText` 这类产品级纯文本构造 helper。running 时提交由 `App`/store 排队，附件按钮、编辑和重新生成仍是 UI 占位，不能在文档或代码中当作已完成能力。
- `MessageBubble` 对 user role 不再只显示扁平 `text`：若存在 `userInputItems`，图片作为独立 strip 显示在 user 气泡上方，`skill` / `text_selection` chip row 和 text block 显示在气泡内；旧快照或旧通知没有 `userInputItems` 时，继续回退到纯文本气泡。

## 样式前提

- 样式系统是 Tailwind CSS v4 CSS-first，主题 token 由 `design/tokens.json` 生成到 `src/styles/generated-theme.css`。
- `tailwind.config.js` 已删除；新增 token 必须先改 `design/tokens.json`，再运行 `pnpm generate:theme-tokens`。
- React 组件使用 `bg-app-*` / `text-app-*` / `border-app-*` 等生成语义 class。
- `tests/designTokens.test.ts` 会校验生成 CSS，避免手写 CSS 或旧配置回流。
- 新 UI 应优先复用现有 token 和组件密度，不在组件内散落协议状态字符串或重复色值。
- 页面视觉层在 `src/styles/tailwind.css` 追加少量 `--thread-window-*` 运行时 CSS 变量，用于 light/dark 成对的 glow、floating shadow 和 inset line；组件仍通过生成的 app 语义 token 取色，不单独持久化或推导主题。
- ThreadWindow 滚动条统一在 `src/styles/tailwind.css` 的 base layer 定义：标准属性使用 `scrollbar-width` / `scrollbar-color`，Electron/Chromium 兼容使用 `::-webkit-scrollbar*`；track 和 corner 必须保持透明，避免滚动容器出现白色 gutter。不要在组件内重复定义局部滚动条样式。

## 实现约束

- **弹出层**：Composer slash 菜单使用 `@radix-ui/react-popover`（Portal 渲染、碰撞检测、focus 管理），App 删除确认对话框使用 `@radix-ui/react-alert-dialog`（Portal 渲染、focus trap、scroll lock、Escape 关闭）。项目已引入 Radix UI（dropdown-menu、accordion、scroll-area、popover、alert-dialog）。
- **图标**：通用图标使用 `lucide-react`（X、Trash2、Plus、Square、ArrowUp、MoreHorizontal、Folder/FolderOpen、Copy）；运行状态脉冲圆点（ThreadItem RunningThreadIcon）仍为自定义实现。
- **`id()` / `now()` 小型工具函数**：`App.tsx`、`Composer.tsx`、`threadSocketClient.ts` 中各自定义，调用点少，未做统一抽象。

## 常用命令

```bash
pnpm --filter handagent-thread-window-web test
pnpm --filter handagent-thread-window-web build
```

仓库级 TypeScript 验证仍可用：

```bash
bash ./scripts/test.sh
```

## 相关文档

- Electron UI shell：[electron-shell](/Users/mu9/proj/handAgent/apps/electron-shell/electron-shell.md)
- agent-server socket：[server](/Users/mu9/proj/handAgent/apps/agent-server/src/server/server.md)
- protocol DTO：[protocol](/Users/mu9/proj/handAgent/packages/core/src/protocol/protocol.md)
