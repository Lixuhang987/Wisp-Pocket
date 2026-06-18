# activity-window

`tests/activity-window` 原本覆盖 Electron ActivityWindow renderer 的纯 browser/React 状态逻辑；当前主路径断言已合并到 `tests/use-cases/activity-window.test.ts`，本目录只保留索引说明。

## 文件

| 文件 | 覆盖对象 |
|------|------|
| `../use-cases/activity-window.test.ts` | `/api/activity` snapshot/change 解析、ActivityWindow 状态展示和 focusThread 回跳主路径 |

## 测试前提

- 测试只使用 fake WebSocket 和 fake timer，不启动真实 Electron、真实 WebSocket server 或 React renderer。
- fixture 只构造 `AgentActivityEvent`；不要把 `/api/thread` 的完整消息放进本目录。
- 新增 activity status 或 waiting request 时，这里必须和 `packages/core/src/protocol/AgentActivity.ts`、renderer parser/display 同步。
