# Thread Recovery Regression Implementation Plan

## 历史 thread 打开并恢复右侧消息 use case

### Existing Flow Inventory
- 现有入口在 `apps/thread-window-web/src/App.tsx`：`HistorySidebar.onOpenThread` 内联调用 `ensureThreadState(threadId)`、`setActiveThreadId(threadId)`、`clientRef.current?.resumeThread(threadId)`。
- 现有协议入口在 `apps/thread-window-web/src/thread/threadSocketClient.ts`：`resumeThread(threadId)` 发送 `thread.resume`。
- 现有状态回填在 `apps/thread-window-web/src/store/threadWindowStore.ts`：收到 `thread.snapshot` 后把消息写入 `threadsById[threadId].messages`。
- 现有右侧渲染在 `apps/thread-window-web/src/components/ThreadWorkspacePane.tsx`：根据 `threadId` 读取 `threadsById[threadId]` 并渲染 `MessageList`。
- 当前缺口：这条“历史点击 -> 右侧切换 -> resume -> snapshot 渲染”的 React 级联动没有单独回归测试，live QA 需要依赖 Electron/AX 点击，证据不稳定。

### Core structure
- 新增一个仅负责历史 thread 打开副作用的 helper，例如：
```ts
export type HistoryThreadOpener = {
  ensureThreadState(threadId: string): void;
  setActiveThreadId(threadId: string): void;
  resumeThread(threadId: string): void;
};

export function openHistoryThread(threadId: string, deps: HistoryThreadOpener): void;
```
- `App.tsx` 继续持有 React state 与 socket client，只把现有内联三步委托给 helper。
- 新增测试文件覆盖 helper，不引入新 UI 框架或 DOM 依赖。

### Use case map
```mermaid
flowchart LR
    A[HistorySidebar 触发 threadId] --> B[openHistoryThread(threadId, deps)]
    B --> C[deps.ensureThreadState(threadId)]
    C --> D[store 为目标 thread 建立后台缓存]
    D --> E[deps.setActiveThreadId(threadId)]
    E --> F[右侧工作区切换到目标 threadId]
    F --> G[deps.resumeThread(threadId)]
    G --> H[/api/thread 发送 thread.resume]
    H --> I[后续 thread.snapshot 回填消息并由 ThreadWorkspacePane 渲染]
```

- Integration test need to create when exceeding: `apps/thread-window-web/tests/historyThreadSelection.test.ts`
  - 验证 `openHistoryThread` 按顺序调用 `ensureThreadState`、`setActiveThreadId`、`resumeThread`。
  - 验证同一个 `threadId` 原样透传，不被默认值或其他状态污染。
  - `App.tsx` 改为复用 helper，避免历史选择逻辑再次内联漂移。
