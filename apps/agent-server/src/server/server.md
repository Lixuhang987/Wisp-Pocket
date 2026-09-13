# server

本目录拥有 agent-server 的连接分派、输入校验和默认依赖组合。Thread 业务语义归 core 与相邻 adapter。

## 直接子节点

- `server.ts`：默认组合根、HTTP/WebSocket 生命周期、三种 socket handler 与协议校验。

## 路径分派

- `/thread-window/*` 提供构建后的静态资源。
- `/api/thread` 接受 Thread client；`acceptServerRequests=1` 允许已订阅连接接收并回答 Permission/Workspace。桌宠与 ThreadWindow 使用同一入口。
- `/api/activity` 先发 snapshot，再发轻量状态变化；桌宠完整内容走 Thread 通道。
- `/api/dynamic-tools` 要求首帧 provider_hello，保存声明的 Tool spec，后续调用按 clientId 与 token 路由。
- `GET /api/blobs/{blobId}` 只读取图片/PDF 副本，校验 Blob ID 并从 BlobStore 查找；不接受文件路径。该入口与两种 renderer 共用的 [attachment URL](../../../thread-window-web/src/src.md) 对应。
- 未识别的 upgrade path 直接关闭，不回退到其他通道。

## 组合边界

- 默认监听 loopback `127.0.0.1:4317`，创建一次 Workspace、Permission、Blob、ThreadStore、ThreadRegistry、Tool registry 与 publisher；关闭时先停止 ThreadRegistry，再释放共享服务。
- 将 `DroppedInputReader` 注入 Thread 的 prepareInput 端口；原始输入先落盘，读取与模型循环才开始。
- 二进制输入源只接受 base64 或 blobId 之一；具体 DTO 由 [core protocol](../../../../packages/core/src/protocol/protocol.md)拥有。
- socket handler 只负责 decode、身份/资格校验、路由和错误回写；publisher 持有订阅而非 WebSocket 或请求真源。
- Provider 断开必须拒绝其 pending call 并移除连接身份；Thread 的已保存历史不随 UI 连接关闭。
- ready 输出是 Electron supervisor 的机器协议，普通诊断日志走既有日志通道。
