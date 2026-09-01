# server

`server/` 拥有 agent-server 的进程入口、连接分派和默认依赖组合。业务语义下沉到相邻子模块。

## 直接文件

- `server.ts`：CLI 启动、ready 输出和 fatal error 处理。
- `startDefaultServer.ts`：默认依赖组合与 HTTP server 生命周期。
- `attachThreadSocketHandlers.ts`：`/api/thread` 连接适配。
- `attachActivitySocketHandlers.ts`：`/api/activity` 连接适配。
- `attachDynamicToolSocketHandlers.ts`：`/api/dynamic-tools` Provider 适配。

## 路径分派

- `/thread-window/*` 只提供构建后的静态资源。
- `/api/thread` 接受 Thread client；只有声明 `acceptServerRequests=1` 的连接可成为交互式 request owner。
- `/api/activity` 连接后先收到 snapshot，再接收状态变化。
- `/api/dynamic-tools` 要求首帧 `provider_hello`，后续调用按 `clientId` 路由。
- 未识别的 upgrade path 直接关闭，不回退到其他通道。

## 组合规则

- 启动时创建一次 Workspace、Permission、Blob、ThreadStore、Agent manager、Tool registry 和 publisher；关闭时按反向所有权释放。
- socket handler 只做 decode、身份绑定、路由和错误回写，不承载 runtime 业务。
- `ThreadNotificationPublisher` 持有订阅关系，不持有 WebSocket；发送函数由本目录注入。
- Provider 断线必须拒绝其 pending Dynamic Tool call，并从 registry 移除连接身份。

## 进程合约

- 默认监听 loopback `127.0.0.1:4317`；ready 后向 stdout 输出 Electron supervisor 可解析的事件。
- 正常日志走 stderr，stdout 保留机器协议。
- 环境变量解析集中在启动层；下游通过显式参数获取路径和配置。
