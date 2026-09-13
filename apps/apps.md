# apps

`apps/` 放可执行入口、用户界面与宿主适配。产品术语见 [Desktop Experience](./desktop/CONTEXT.md) 和 [Host Automation](./host-automation/CONTEXT.md)。

## 直接子节点

- [desktop/desktop.md](/Users/mu9/proj/handAgent/apps/desktop/desktop.md)：Swift Host，拥有 macOS 生命周期、PromptPanel、Settings 和宿主能力。
- [electron-shell/electron-shell.md](/Users/mu9/proj/handAgent/apps/electron-shell/electron-shell.md)：Electron UI Shell、桌宠与 agent-server supervisor。
- [thread-window-web/thread-window-web.md](/Users/mu9/proj/handAgent/apps/thread-window-web/thread-window-web.md)：React ThreadWindow 与两界面共用的 Thread 客户端。
- [agent-server/agent-server.md](/Users/mu9/proj/handAgent/apps/agent-server/agent-server.md)：Conversation Runtime 的本地服务组合根。
- [host-automation/host-automation.md](./host-automation/host-automation.md)：应用内 Context History、Automation 与业务持久化。
- [chrome-bookmarks-extension/chrome-bookmarks-extension.md](/Users/mu9/proj/handAgent/apps/chrome-bookmarks-extension/chrome-bookmarks-extension.md)：Chrome 书签事件采集端。
- [chrome-bookmarks-native-host/chrome-bookmarks-native-host.md](/Users/mu9/proj/handAgent/apps/chrome-bookmarks-native-host/chrome-bookmarks-native-host.md)：Chrome Native Messaging 到 Swift Host 的转发器。

## 层级边界

- apps 可以组合 packages；packages 不反向依赖 apps。
- Swift Host 拥有系统集成和瞬时原生 UI；Electron UI Shell 拥有常驻 UI 和后台服务生命周期。
- React ThreadWindow 与桌宠直接消费 `/api/thread`，各持 UI 投影；Electron main 与 Swift 不保存消息状态。
- agent-server 负责适配协议、持久化和 provider，不把 Node 或 WebSocket 细节下沉到 core。
