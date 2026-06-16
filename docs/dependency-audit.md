## 依赖收敛审核报告

审核范围：`thread-window-web`、`electron-shell`、`agent-server`、`packages/core` 全部 TypeScript 源码。

审核目标：识别"已有依赖未使用"和"可以用现有/知名依赖替代的自造轮子"两类问题。

---

### 一、已有依赖但未使用（最高优先级）

这类问题最严重：项目已经引入了某个依赖，但对应代码仍在手写等价逻辑，既增加维护成本又造成行为不一致。

#### 1. `zod` 已在依赖中，多处仍手写 runtime 校验

`zod` 同时出现在根 `package.json`（`^4.4.3`）和 `agent-server/package.json`（`^4.4.3`），但以下位置仍使用手写 type guard 和逐字段校验：

| 文件 | 行数 | 说明 |
|------|------|------|
| `agent-server/src/server/server.ts` L150-185 | ~35行 | `isThreadCommand`、`isClientResponse`、`isPlatformBridgeMessage`、`isRecord` 等手写 guard，只检查 `type` 字段，不校验 payload 形状 |
| `core/src/mcp/MCPConfig.ts` L34-155 | ~120行 | `parseMCPConfig` 及 `requiredString`、`optionalString`、`stringArray` 等一整套手写校验器，项目其他位置（如 `defineTool.ts`）已经在用 zod schema |
| `core/src/config/ModelSettings.ts` L39-97 | ~58行 | `loadModelSettings` 手写 normalize/validate 链 |
| `electron-shell/src/main/protocol/electronShellProtocol.ts` L115-191 | ~76行 | 6 种 command + 7 种 event 的手写 type guard |

**建议：** 统一用 zod schema 替代。好处是 schema 即类型、错误信息更友好、和代码库其他校验风格一致。

#### 2. `zustand` 的 `persist` 中间件未使用，手写 localStorage 管理

| 文件 | 说明 |
|------|------|
| `thread-window-web/src/store/threadWindowStore.ts` L14-61 | 手写 `getLocalStorage`、`loadExpandedWorkspaceIds`、`persistExpandedWorkspaceIds` 三个函数管理一个 `Set<string>` 的序列化/反序列化，且 `toggleWorkspaceExpanded` 每次手动调用持久化 |

项目已依赖 `zustand ^5.0.8`，其内置 `persist` 中间件可直接处理 localStorage 序列化、hydration、versioning。

**建议：** 用 `zustand/middleware` 的 `persist` + `partialize` 替代。

#### 3. `clsx` + `tailwind-merge` 已正确使用（正面确认）

`thread-window-web/src/utils/cn.ts` 正确使用了 `clsx` + `tailwind-merge`，这是标准做法，无需修改。

#### 4. `@radix-ui` 已引入部分组件，但弹窗/对话框仍手写

项目已依赖 `@radix-ui/react-dropdown-menu`、`@radix-ui/react-accordion`、`@radix-ui/react-scroll-area`，但以下 UI 仍手写：

| 文件 | 说明 | 可用替代 |
|------|------|----------|
| `thread-window-web/src/components/Composer.tsx` L136-170 | slash-command 弹出菜单：`absolute bottom-full` 定位，无碰撞检测、无 focus trap、无 portal | `@radix-ui/react-popover` 或 `@floating-ui/react` |
| `thread-window-web/src/App.tsx` L197-232 | 删除确认对话框：手写 modal overlay，缺 focus trap、scroll lock | `@radix-ui/react-alert-dialog` |

**建议：** 既然已经在用 Radix 系列，再补两个 Radix primitive 即可保持风格统一。

#### 5. `node:timers/promises` 内置未使用，手写 `sleep`

| 文件 | 说明 |
|------|------|
| `electron-shell/src/main/serverSupervisor/nodeAgentServerSupervisor.ts` L258-262 | 手写 `function sleep(delayMs: number): Promise<void>` |

Node.js 16+ 内置 `import { setTimeout as sleep } from 'node:timers/promises'`，无需自定义。

**建议：** 直接替换为一行 import。

#### 6. `AbortSignal.throwIfAborted()` 内置未使用

| 文件 | 说明 |
|------|------|
| `core/src/llm/LLMClient.ts` L155-164 | 手写 `throwIfAborted` + `createAbortError` |
| `core/src/llm/MockLLMClient.ts` L532-541 | 同上，复制粘贴 |

Node.js 17.3+ / 18+ 内置 `signal.throwIfAborted()`。

**建议：** 直接调用 `signal?.throwIfAborted()`，删除两处重复代码。

#### 7. `structuredClone()` 内置未使用，手写 discriminated union clone

| 文件 | 说明 |
|------|------|
| `agent-server/src/protocol/MessageTranslator.ts` L282-301 | `cloneInputItems` 手写 switch-case 逐个 variant 重建对象 |
| `thread-window-web/src/App.tsx` L238-253 | `cloneUserInput` 同上 |
| `thread-window-web/src/components/Composer.tsx` L399-410 | `cloneInputItem` 同上 |
| `thread-window-web/src/store/threadWindowStore.ts` L451-488 | `cloneOp` + `cloneInputItem` 同上 |

这四处是同一个 `InputItem` discriminated union 的深拷贝逻辑的复制粘贴。新增一个 variant 时四处都要改。

**建议：** `structuredClone(items)` 可替代全部手写 clone。如果只想统一一处，至少抽到 `packages/core` 导出一个共享工具函数。

---

### 二、跨文件代码重复（DRY 违反）

这类问题不涉及外部依赖，但同一函数在仓库内被复制多次，应收敛到一个共享模块。

#### packages/core 内部重复

| 函数 | 重复位置 | 说明 |
|------|----------|------|
| `isRecord` | `MCPConfig.ts`、`StdioMCPClient.ts`、`StreamableHttpMCPClient.ts` | 三处完全相同 |
| `toError` | `LLMClientFactory.ts` L271-275、`VercelClient.ts` L143-147 | 两处完全相同 |
| `throwIfAborted` + `createAbortError` | `LLMClient.ts`、`MockLLMClient.ts` | 两处完全相同 |
| `stampsEqual` | `FileWorkspaceRegistry.ts`、`FilePermissionPolicy.ts` | 两处完全相同 |
| `parseToolDescription` / `parsePromptDescription` / `parseResourceDescription` | `StdioMCPClient.ts` L240-274、`StreamableHttpMCPClient.ts` L175-209 | 三个函数完全相同 |
| stream 迭代逻辑 | `VercelClient.ts` L97-140、`LLMClientFactory.ts` L229-268 | 近乎相同的 `fullStream` 遍历 + `text-delta` / `tool-call` 累积 |

#### electron-shell 内部重复

| 函数/常量 | 重复次数 | 说明 |
|-----------|----------|------|
| `fallbackTheme` 常量 | 5处 | `initialHostTheme.ts`、`activityWindowController.ts`、`threadWindowPrewarmer.ts`、两个 preload |
| `isHostTheme` 验证器 | 4处 | `electronShellProtocol.ts`、`App.tsx`、两个 preload |
| `HostTheme` 类型定义 | 4处 | 同上 |
| `errorMessage` | 2处 | `electronShellRuntime.ts`、`utilityProcessAgentServerSupervisor.ts` |
| `isRecord` | 2处 | `activitySocketClient.ts`、`electronShellProtocol.ts` |
| `isPromiseLike` | 2处 | `activityWindowController.ts`、`threadWindowPrewarmer.ts` |
| `formatOutput` / `formatChildOutput` | 2处 | 两个 supervisor，名字不同但实现相同 |
| NDJSON 换行分割解析 | 2处 | `jsonLineBridge.ts` L21-39、`commandSocketServer.ts` L48-65，逐字相同 |
| 进程监督逻辑 | 2处 | `nodeAgentServerSupervisor.ts`（268行）和 `utilityProcessAgentServerSupervisor.ts`（200行），约 80% 逻辑相同（指数退避、generation 计数、readiness polling） |

#### agent-server 内部重复

| 函数 | 重复位置 | 说明 |
|------|----------|------|
| `isNotFoundError` | `server.ts`、`SettingsBackedLLMClient.ts`、`SettingsBackedToolRegistry.ts` | 三处完全相同 |

#### thread-window-web 内部重复

| 函数 | 重复位置 | 说明 |
|------|----------|------|
| `cloneInputItem` / `cloneOp` / `cloneUserInput` | `App.tsx`、`Composer.tsx`、`threadWindowStore.ts` | 见上文"structuredClone" |
| `id()` / `newId()` | `App.tsx` L21-23、`Composer.tsx` L423-425 | 都是 `${prefix}-${crypto.randomUUID()}` |
| `now()` | `App.tsx` L17-19、`threadSocketClient.ts` L194-196 | 都是 `new Date().toISOString()` |

---

### 三、可用知名依赖替代的自造轮子

以下手写逻辑有对应的成熟库，是否引入需要权衡依赖体积和维护成本。

#### 高影响

| 发现 | 文件 | 手写代码量 | 推荐替代 | 理由 |
|------|------|-----------|----------|------|
| MCP JSON-RPC 客户端 | `core/src/mcp/StdioMCPClient.ts`（~287行）+ `StreamableHttpMCPClient.ts`（~213行） | ~500行 | `@modelcontextprotocol/sdk` | 官方 SDK，覆盖协议版本、错误恢复、elicitation 等，避免手写 transport 维护协议演进 |
| 手写 async mutex | `agent-server/src/thread/ThreadRuntimeOrchestrator.ts` L247-268 | ~20行 | `async-mutex` | Promise 链式 mutex 虽巧妙但缺乏 tryLock / 死锁检测，且可读性差 |
| 手写 polling wait | `agent-server/src/thread/ThreadRuntimeOrchestrator.ts` L136-167 | ~30行 | 重构为 await idle waiter | 同文件已有 `idleWaiters` 机制，busy-wait polling 是反模式 |

#### 中等影响

| 发现 | 文件 | 推荐替代 | 理由 |
|------|------|----------|------|
| 手写 SSE 解析（2处） | `core/src/llm/VercelAdapters.ts` L28-102、`core/src/mcp/StreamableHttpMCPClient.ts` L166-173 | `eventsource-parser` | SSE 分块边界、多字节字符、CRLF 处理容易出错 |
| 手写 stable stringify | `core/src/permission/FilePermissionPolicy.ts` L166-178 | `fast-json-stable-stringify` | 手写版本缺少循环引用、BigInt 等边界处理 |
| 手写 chunked Promise.all 并发 | `core/src/runtime/TurnSummarizer.ts` L29-38 | `p-limit` | chunk 模式在最后一批可能浪费并发槽位 |
| 手写 MIME 类型映射（2处） | `agent-server/src/server/server.ts` L701-724、`MessageTranslator.ts` L359-365 | `mime-types` 或 `mime` | 手写仅覆盖 ~13 种扩展名 |
| 手写 WebSocket 重连 | `electron-shell/src/activity-window/activitySocketClient.ts`（~164行） | `reconnecting-websocket` | 缺指数退避、heartbeat、超时处理 |
| 手写静态文件服务 | `agent-server/src/server/server.ts` L640-685 | `sirv` 或 `serve-static` | 缺 cache headers、range requests、ETag |
| `Math.random()` ID 生成 | `agent-server/src/thread/ThreadCommandRouter.ts` L257、`ThreadPersistence.ts` L308 | `crypto.randomUUID()`（同项目已在用） | 不一致且碰撞抗性差 |

|                            |                                              |                                                              |
|------|------|------|
|                            |                                              |                                                              |
|                            |                                              |                                                              |
|                            |                                              |                                                              |
| ~12 个手写 inline SVG 图标 | 多个 thread-window-web 组件 | 可考虑 `lucide-react` 统一图标管理 |
|                            |                                              |                                                              |
| WebSocket path 路由 | `agent-server/src/server/server.ts` L233-257 | `ws` 库本身支持 `path` 选项自动路由，无需手写 upgrade handler |

