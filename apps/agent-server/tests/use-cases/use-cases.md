# use-cases

本目录从调用方入口验证 server 与 core 的组合边界，使用真实业务 owner 和持久化，不在测试中平行重建 Thread 状态。

## 直接文件

- `thread-lifecycle.test.ts`：socket 分派、通知、请求回流、Activity 与 Dynamic Tool 声明刷新。
- `thread-ownership.test.ts`：Thread 状态所有权、持久化、断连、删除、运行隔离及真实外部 Tool 等待的中断与晚到结果。
- `pet-conversation.test.ts`：真实 Thread/SQLite/Blob 与桌宠入口，覆盖首次文字、结构化原路径引用（无副本、重建保留）、普通回复、持久 pending、跨界面请求、删除及恢复。

- `workspace-conversation.test.ts`：公开 socket 验证同根项目复用、并发与创建去重、项目分页查询、Thread Workspace 归属、逐 Turn AGENTS.md，同时保留普通首轮提示、输入重试、Thread 隔离和重建覆盖；删除后的创建 ACK 重试跨重启保持幂等。
- `settings-api.test.ts`：公开 HTTP 保存模型/MCP、探测 Codex 可用状态、永久规则查询撤销，真实持久化与后续 Thread 模型请求，以及原生偏好交错修改。
- `codex-delegation.test.ts`：新增累计 3 条，用实际 CLI 夹具进程/文件验证首次委托、会话独立登记与重建后 resume、公开 Permission 和跨 Thread 归属、受限失败与补充输入后恢复。
- `default-reading.test.ts`：首轮结构化文件引用经 socket/SQLite 后按需读到最新内容、权限策略、真实文件/历史与工具结果进入模型。

## 验证边界

- system 与时间上下文沿 `thread-ownership` 的真实 Thread/SQLite 主路径验证：首轮模型前落盘、模型失败、写入期间中断后接续、规则替换/清除、重启后的整一小时及超过一小时、连续活跃轮次的注入基准，以及 snapshot/messageCount 排除内部上下文。`default-reading` 用真实 Swift 保存夹具验证 ISO/epoch 的相等端点和 Node 本地偏移输出；Swift 新写偏移格式另由 [真实 Store 用例](../../../host-automation/Tests/tests.md) 验证，静态夹具不伪造更新。
- 重启输入去重复用 `thread-ownership` 的既有历史恢复用例；存储故障与真实删除的区分复用其协议删除失败用例。轻量观察连接的 Permission 事实接收、结束清理、已解决请求不补发、回执资格与正文隔离复用 `pet-conversation` 的真实 CLI 授权流，避免另建仅检查内部调用的测试。
- 桌宠首次纯文字从 controller 经过共享输入控制器到真实 Thread 与 SQLite；打开空回复框不留历史，接收后可读到持久输入，角色 skill 保留并进入脚本模型；运行中真实 resume 返回一条用户记录，共享投影也只有一条。相同正文不同提交保留独立记录，SQLite 重建不重复注入；后续回复留在同一 Thread。原生点击、自动焦点和中文输入法仍由 renderer 与实机验收覆盖。
- 真实 CLI 授权流同时覆盖纯工具 assistant 的原始历史保留、两端 live / resume 后正文集合一致，以及 SQLite 重建后的 UI 投影；不以删除工具记录来消除空气泡。
- 只有建议的历史由真实 persistence 写入 SQLite，关闭重建后经历史翻译、socket 和桌宠 controller 恢复等待与最新项，再回复到同一 Thread；renderer 只以协议 DTO 验证呈现，不能替代这条持久恢复链路。
- Dynamic Tool 用例使用真实 `WebSocketDynamicToolBridge` 与 `DynamicToolAdapter`，以 socket 传输替身输入 hello/request/response。相同连接的声明刷新须保留在途调用并更新新 Thread 的默认集合，旧 Thread metadata 保持不变；显式空集合仍为空，旧连接不能刷新新身份的集合。默认长操作等待实际结果，真正关闭连接后才 offline。显式超时另由 bridge 边界测试覆盖。
- Thread 中断用例保留真实 ThreadTools 与 Runtime，以普通外部 Tool 等待替身验证旧结果隔离；Dynamic adapter/Bridge 的独立通道测试仍保留。中断返回后晚到的外部结果不得改写已保存历史、恢复旧 Turn 或触发下一次模型调用。它不证明宿主任务被远程取消。
- Codex 夹具仅替换外部 CLI 与模型，保留真实 Thread/Runtime/Permission/SQLite/进程适配；退出码、结构化任务结果与实际文件分别核对。CLI 和脚本模型的自动化通过不证明真实登录、模型理解、用户配置或 macOS 环境。
- 修改 Provider 身份语义时同时核对 [server](../../src/server/server.md) 和 Swift 的连接用例；传输测试不替代 Context History / Automation 的业务用例或 macOS 实机验收。

HTTP / socket 测试验证受支持的路由、静态资源与连接合约；已移除的 AgentTrigger HTTP 入口不保留专门的 404 回归。
