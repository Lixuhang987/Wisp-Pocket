# thread

本目录把 ThreadCommand 路由到 core Thread，并适配持久化、通知与用户主动输入的读取；业务生命周期由 [core Thread](../../../../packages/core/src/thread/thread.md)拥有。

## 直接子节点

- `ThreadCommandRouter.ts`：生命周期、查询、Op 与 ClientResponse 路由。
- `ThreadPersistence.ts`：thread-store 顺序写入、Blob 引用和残缺 Turn 修复。
- `ThreadNotificationPublisher.ts`：连接订阅、交互式接收资格与定向发布。
- `DroppedInputReader.ts`：读取本次交付的网页、PDF 和图片副本。

## 命令与连接

- `thread.start` 创建 Thread；`thread.resume` 返回 snapshot；list/delete 管理既有历史。未指定 Dynamic Tool 集的新 Thread 使用当前在线 Provider 声明的能力，声明空集合仍表示空集合。
- 删除成功向全部 Thread 连接广播 `thread.deleted`，让各界面清理历史；目标不存在时只向发起连接回复 `not_found`，不广播失败结果。
- 公开运行输入统一经 `op.submit`；ClientResponse 校验连接资格后包装为内部 Op，不能伪装成建议回复。
- socket 断开仅解除订阅，不停止 Thread。桌宠和 ThreadWindow 可同时接收同一请求，core 发出 `request.resolved` 后两端清理。
- `workspace.list` 是连接级查询，不带 threadId，只回发起连接。

## 保存与读取

- 每条输入在执行前落盘；附件先写 Blob，response item 与 live 通知均保存规范化 Input Item。原始图片/PDF 不依赖 renderer 内存或源文件路径。
- `mode: "inspect"` 在轮到该输入后调用读取适配器。URL 复用公共网页 `fetch_page` 的正文与网络限制；PDF 用 PDF.js 提取文本；图片经副本校验后进入现有多模态路径。
- 读取只覆盖本次 Input Item。网页/PDF 读取结果进入 Thread 历史，原链接仍沿 text 保存，不另建网页存档系统。
- 无正文、加密/损坏 PDF、损坏图片或外部读取失败都保留输入，生成具体障碍说明并等待普通回复。扫描 PDF 不承诺 OCR，图片仍要求模型支持多模态。
- 空图片/PDF 也先保存副本再报告读取障碍，不能在传输校验时静默丢弃；接收前保存失败则按协议返回错误，不假报已保存。
- Blob 的只读 HTTP 入口见 [server](../server/server.md)；Input Item 转换见 [protocol](../protocol/protocol.md)。

## 恢复与故障

- rollout 区分“输入已保存”与 `turn.started`。重启后的未开始输入保持 pending；开始但没有完成的 Turn 修复为失败/中断并留下可见说明，不重放已开始输入。
- 运行结果只追加本轮生成内容，不覆盖并行接收的新输入。存储失败暂停执行，恢复以已落盘历史为准。
- core 在中断、删除和关闭后隔离晚到结果；本目录只提供写入与协议适配，不另维护运行队列或请求表。

验证入口见 [tests](../../tests/tests.md)，SQLite 派生规则见 [thread-store](../../../../packages/thread-store/thread-store.md)。
