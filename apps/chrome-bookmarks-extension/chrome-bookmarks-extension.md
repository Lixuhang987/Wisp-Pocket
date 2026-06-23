# chrome-bookmarks-extension

Chrome MV3 扩展，只负责把 Chrome 官方收藏夹事件转发给 HandAgent 本机 Native Messaging Host。

## 文件

| 文件 | 职责 |
|------|------|
| `manifest.json` | MV3 manifest，声明 `bookmarks` / `nativeMessaging` / `storage` 权限和 background service worker |
| `src/backgroundRuntime.ts` | 可测试的扩展运行时：连接 `com.handagent.chrome_bookmarks`、发送 hello、监听 `chrome.bookmarks.onCreated`、过滤非 URL 书签、转发新增书签事件 |
| `src/background.ts` | service worker 入口，只负责把全局 `chrome` 注入 runtime |
| `tests/backgroundRuntime.test.ts` | Vitest 覆盖 hello、URL 书签转发、非 URL 节点忽略和断线重连 |
| `scripts/copy-manifest.mjs` | build 后把 manifest 复制到 `dist/` |

## 协议边界

扩展只发送两类消息：

- `handagent.bookmarks.hello`：连接 native host 后发送，包含 extension version、extension instance id 和 profile id。
- `handagent.bookmarks.created`：Chrome 新增 URL 书签后发送，包含 bookmark id、parent folder id、title、url、profile id 和 occurredAt。

扩展不读取 `~/.spotAgent/agent-triggers/instances.json`，不判断 folder 是否命中实例；命中判断由 Swift `ChromeBookmarksAgentTriggerProvider` 完成。

## 验证命令

```bash
pnpm --filter handagent-chrome-bookmarks-extension test
pnpm --filter handagent-chrome-bookmarks-extension build
```
