# server

`server/` 拥有 agent-server 的进程入口、连接分派和默认依赖组合。业务语义下沉到相邻子模块。

## 直接文件

- `server.ts`：默认依赖组合、HTTP/WebSocket 分派、三条通道的连接适配及进程启停。

## 路径分派

- `/thread-window/*` 只提供构建后的静态资源。
- `/api/thread` 接受 Thread client；只有声明 `acceptServerRequests=1` 且订阅所属 Thread 的连接可接收和回答交互请求，请求生命周期由 core Thread 拥有。
- `/api/activity` 连接后先收到 snapshot，再接收状态变化。
- `/api/dynamic-tools` 要求首帧 `provider_hello`，后续调用按 `clientId` 路由。
- 未识别的 upgrade path 直接关闭，不回退到其他通道。

## 组合规则

- 启动时创建一次 Workspace、Permission、Blob、ThreadStore、ThreadRegistry、Tool registry 和 publisher；关闭时先关闭 ThreadRegistry，再按反向所有权释放共享服务。
- socket handler 只做 decode、身份绑定、订阅与路由；命令错误由 router 定向回写，runtime 业务由 core Thread 承接。
- `ThreadPersistence` 和协议转换函数注入 core 已有端口；组合根不为每次输入重建运行历史或平行持有 Turn 状态。
- `ThreadNotificationPublisher` 持有订阅关系，不持有 WebSocket；发送函数由本目录注入。
- Provider 断线必须拒绝其 pending Dynamic Tool call，并从 registry 移除连接身份。

## 进程合约

- 默认监听 loopback `127.0.0.1:4317`；ready 后向 stdout 输出 Electron supervisor 可解析的事件。
- 正常日志走 stderr，stdout 保留机器协议。
- 环境变量解析集中在启动层；下游通过显式参数获取路径和配置。
