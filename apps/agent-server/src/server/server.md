# server

本目录拥有 agent-server 的连接分派、输入校验和默认依赖组合。Thread 业务语义归 core 与相邻 adapter。

## 直接子节点

- `server.ts`：默认组合根、HTTP/WebSocket 生命周期、三种 socket handler 与协议校验。

## 路径分派

- `/thread-window/*` 提供构建后的静态资源。
- `/api/thread` 接受 Thread client；`acceptServerRequests=1` 允许已订阅连接接收并回答 Permission。桌宠与 ThreadWindow 使用同一入口，请求生命周期归 core Thread。
- `/api/activity` 先发 snapshot，再发轻量状态变化；桌宠完整内容走 Thread 通道。
- `/api/dynamic-tools` 要求首帧 `provider_hello`，保存声明的 Tool spec，后续调用按 `clientId` 与 token 路由。
- `GET /api/blobs/{blobId}` 只读取图片/PDF 副本，校验 Blob ID 并从 BlobStore 查找，不接受文件路径。`file_reference` 不经过该入口或 BlobStore；新图片附件仍使用副本。该入口与两种 renderer 共用的 [attachment URL](../../../thread-window-web/src/thread/thread.md) 对应。
- 未识别的 upgrade path 直接关闭，不回退到其他通道。

## 组合边界

- 默认监听 loopback `127.0.0.1:4317`，创建一次 PetRegistry、Permission、Blob、ThreadStore、ThreadRegistry、Tool registry 与 publisher；关闭时先停止 ThreadRegistry，再释放共享服务。
- `ThreadPersistence` 和协议转换函数注入 core 已有端口；组合根不平行持有历史或 Turn 状态。
- 默认 file.read 和四个历史读取工具直接注入 ThreadTools，不依赖 use_tools 或 Swift Provider 在线；Context History 从已保存记录读取，宿主继续负责采集。输入不自动预读，图片 Item 仍沿既有 Blob 合约；`file_reference` 校验绝对路径、非空文件名并拒绝额外字段，不按存在性预读。协议字段以 [core](../../../../packages/core/src/protocol/protocol.md) 为准。
- `/api/thread?observeRequests=1` 用于 [Electron 窗口集合](../../../electron-shell/src/main/windows/windows.md) 的隐藏宠召回，仅消费身份/列表与有效 Permission；不订阅消息正文、不获得回执资格。每页列表后从已加载 Thread 请求表补发当前请求，不 resume 全量历史。
- Pet 创建后文件根不可更改，启动空库播种唯一默认宠；Pet 配置与角色快照由同一 ThreadStore 持久化，旧开发 schema 明确报错且不自动清理。
- socket handler 只负责 decode、身份/资格校验、订阅与路由；命令错误由 router 定向回写。publisher 持有订阅而非 WebSocket 或请求真源。
- Provider 断开必须拒绝其 pending call 并移除连接身份；Thread 的已保存历史不随 UI 连接关闭。
- 同一 socket、相同 `clientId` 再次 hello 只刷新当前 token 的工具声明，保留在途调用；新连接或身份变化才替换/解绑。旧 token 不能刷新新连接的声明。双端合约见 [宿主连接](../../../desktop/Sources/AppServices/AgentServer/agent-server.md) 与 [bridge](../bridges/bridges.md)。
- 桌宠与 ThreadWindow 新建 Thread 不携带工具集时，使用当前在线 Provider 声明；Swift 在创建时显式提交集合。声明刷新不重写已有 Thread metadata，默认选择规则见 [thread](../thread/thread.md)。

## 进程合约

- ready 输出是 Electron supervisor 的机器协议；普通日志与诊断走 stderr。
- 环境变量解析集中在启动层，下游通过显式参数获取路径和配置。
