# thread

本目录把 ThreadCommand 路由到 core Thread，并适配持久化、通知与用户主动输入的读取。业务生命周期由 [core Thread](../../../../packages/core/src/thread/thread.md) 拥有，连接身份只留在 agent-server。

## 直接子节点

- `ThreadCommandRouter.ts`：命令、定向回复、错误关联与回答资格检查。
- `ThreadPersistence.ts`：输入与 Blob 转换、历史增量、残缺 Turn 恢复和存储句柄管理。
- `ThreadNotificationPublisher.ts`：连接订阅、交互式接收资格与通知分发。
- `DroppedInputReader.ts`：读取本次交付的网页、PDF 和图片副本。

## 命令与连接

- 创建、加载、查询和删除经同一 Registry；输入排队、中断、持久化确认和关闭规则在 Thread 内协调。
- `thread.start` 未指定 Dynamic Tool 集时使用当前在线 Provider 声明，显式空集合仍表示空集合。Swift 创建时显式提交工具集；两种 React 界面消费相同默认规则。声明随 Thread 保存，后续 hello 不更新既有 metadata。
- `thread.started` 向全部已连接客户端发布并建立订阅；snapshot、列表与命令错误只回发起连接。`workspace.list` 是不带 threadId 的连接级查询。
- 删除成功向全部 Thread 连接广播 `thread.deleted`，让各界面清理历史；目标不存在时只向发起连接回复 `not_found`。
- 公开 `op.submit` 只接受 UserInput 或 Interrupt。ClientResponse 经交互连接资格与 Thread 订阅检查后交给所属 Thread，请求是否仍有效由 core 判断。
- socket 断开仅解除订阅，不停止 Thread。桌宠和 ThreadWindow 可同时呈现同一请求；snapshot 恢复当前请求，`request.resolved` 同步清理两端展示。新连接本身不触发请求补发。

## 保存与读取

- `ThreadPersistence` 实现已有 `ThreadStorage` 端口，缓存顺序写入句柄，不拥有运行历史、输入队列或 Turn；SQLite 机制归 [thread-store](../../../../packages/thread-store/thread-store.md)。
- 每条输入在执行前落盘；附件先写 Blob，response item 与 live 通知均保存规范化 Input Item。原始图片/PDF 不依赖 renderer 内存或源文件路径。
- `mode: "inspect"` 在轮到该输入后调用读取适配器。URL 复用公共网页 `fetch_page` 的正文与网络限制；PDF 用 PDF.js 提取文本；图片经副本校验后进入多模态路径。
- 读取只覆盖本次 Input Item。网页/PDF 读取结果进入 Thread 历史，原链接沿 text 保存，不另建网页存档系统。
- 无正文、加密/损坏 PDF、损坏图片或外部读取失败都保留输入，生成具体障碍说明并等待普通回复。扫描 PDF 不承诺 OCR，图片仍要求模型支持多模态。
- 空图片/PDF 也先保存副本再报告读取障碍；接收前保存失败则按协议返回错误，不假报已保存。
- Blob 的只读 HTTP 入口见 [server](../server/server.md)；Input Item 转换见 [protocol](../protocol/protocol.md)。

## 恢复与故障

- rollout 区分“输入已保存”与 `turn.started`。重启后的未开始输入保持 pending；开始但没有完成的 Turn 修复为失败/中断并留下可见说明，不重放已开始输入。
- 运行结果按 base message count 追加生成增量、审计和通知，不覆盖并行接收的新输入。存储失败暂停执行，恢复以已落盘历史为准。
- Registry 在冷加载或保存失败恢复时调用重置及残缺 Turn 修复；运行中 snapshot 从 Thread 内存派生，重启不自动续跑。
- core 在中断、删除和关闭后隔离晚到结果，本目录只提供写入与协议适配。

## 修改边界

- Router/Publisher 的连接隔离与 Persistence 的转换、增量和恢复均有实际职责；减少跳转不能把连接身份下沉到 Registry 或绕过存储端口。
- 新 ThreadCommand 分支进入 router，runtime event 翻译进入 `protocol/`；验证沿 [tests](../../tests/tests.md) 进入。
