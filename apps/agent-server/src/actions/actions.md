# actions

本目录提供 Tool 的外部适配。ThreadTools 拥有每个 Thread 的可见工具集合；本目录不拥有对话状态、导航或请求。

## 直接子节点

- `CodexCLI.ts`：用户 CLI 的可用状态、非交互进程与 JSONL/最终结果适配。
- `CodexExecuteTool.ts`：当前 Thread 的委托工具、会话归属校验与登记。
- `codex-result-schema.json`：Codex 最终任务结果的固定输出契约。
- `MCPServerRegistry.ts`：保留按 serverId 复用 client 与工具的实现。
- `DefaultReadTools.ts`：组合 file.read 与四个 context_history 普通工具，独立于 Swift Provider 和 builtin 设置。
- `LocalFileReader.ts`：调用时读取原路径的文本、PDF、PNG/JPEG/WebP；不创建用户文件副本。
- `ReadImage.ts`：完整解码、实际 MIME、尺寸与 PNG 完整性校验。
- `ContextHistoryReader.ts`：读取 Swift 已发布的本地活动、AX、PNG 证据。

## 默认读取与模型内容

默认读取、Web、codex.execute 和 Runtime 的 user.ask 首轮可见。文件与历史读取免 Permission，不依赖在线 Swift Provider；复杂任务与全部文件修改委托 Codex。没有 use_tools 或内置写入设置。

文件每次调用读取当前路径；不存在、无权限、非普通文件、坏图片与不支持二进制明确失败。UTF-8 文本可为空；读取最大 20 MiB，不静默截断。PDF 复用 PDF.js，最多 200 页、8 万字，扫描/加密/坏 PDF 明确失败，不提供 OCR。

图片用 success / contentItems 返回真实内容和关联元数据，普通工具不伪造 Dynamic callId；三类 Provider 的实际图片承载见 [Provider adapters](../../../../packages/core/src/adapters/providers/providers.md)。桌宠输入只是路径文字，只有模型调用读取后才提供内容；PromptPanel 既有直接图片输入不经过此读取器。

## Swift / Node 历史存储合约

写入方是 [Context History](../../../host-automation/Sources/sources.md)，Node 只读 `~/.spotAgent/context-history`。`activities.json` / `screenshots.json` 是各自原子替换的数组索引；AX 为 `ax/<id>.json`；截图索引记录 originalPath / thumbnailPath，文件为完整 PNG 的 base64 文本。Swift 新写时间为宿主本地带偏移 ISO8601、秒粒度；Node 对活动、详情与图片元数据统一转为后端本地带偏移时间，旧 Z 记录也按绝对时刻读取，无需重写索引。两端不维护采集时区历史；Activity app/window 的值为字符串，AX 保留原始类型；目标 pid、window id/title 归一化核对。

单文件原子替换不是跨文件事务：Swift 先保存 AX 再发布活动，先保存图片再发布截图索引，最后更新活动 thumbnailId。新截图已发布而活动尚未关联属于正常过渡；不能因此报损坏或伪造一致快照。已发布索引引用的缺失/损坏证据、错误尺寸或目标关联必须失败。

索引文件不存在表示空历史，损坏或访问错误不是空历史。activity_index 与 thumbnails 均接受可选 start/end（带偏移 ISO8601 或 epoch 秒），包含端点，反向范围明确失败；按绝对时刻先过滤、再倒序、最后 limit。详情与原图按 ID 读取，详情保持请求 ID 顺序；limit 默认20、范围1–200。不自动把“最近十分钟”转为范围，不增加分页或截断元数据。activity_index 不推断实时 collection 状态；采集失败与恢复由 Swift 设置状态源展示。

跨语言共享验证使用 [真实 Swift 保存夹具](../../tests/fixtures/context-history/context-history.md)，不能用两端各自手写的格式宣称兼容。

## Codex 委托合约

- 工具只接受完整任务 prompt 与可选明确 sessionId；后端工厂绑定 Thread ID，执行目录来自 Workspace，模型不能传目录、CLI 命令或启动参数。prompt 由主 Agent 整理必要背景、约束、验收要求与文件路径，不自动转交整个 Wisp 历史；resume 也交付新增要求。
- 可执行文件搜索所需 PATH/home 由 server 显式注入，actions 不自行读取环境或建立默认运行依赖；设置探测与工具执行复用同一 adapter。
- 非交互 exec 与明确 ID 的 resume 使用 stdin 传任务，支持非 Git Workspace，普通 Tool 等进程退出再返回。沿用用户已有登录、模型、配置与权限，不添加权限覆盖，也不复用服务 supervisor 自动重启任务。
- 会话仅可接续当前 Thread 已登记的 ID。收到有效 CLI 会话身份就独立登记，晚到身份不能复活已删除 Thread；每轮目录描述包含已关联 ID 与摘要，同轮新 ID 从工具结果取得。持久归属见 [thread-store](../../../../packages/thread-store/src/src.md)。
- 外层使用 Wisp 本次/永久 Permission，拒绝不启动；内部权限由 Codex 处理，Wisp 不接管逐命令审批。Workspace 只决定工作目录，不是沙箱，已完成修改不回滚。
- 最终结果保存状态、已知会话 ID、正文、可取得的文件变更摘要、退出码、错误和截断说明。固定 codex-result-schema.json 通过 --output-schema 约束最终 success/reply/error，结合有效会话、Turn 完成与退出码判断任务成功。裸 error、配置警告与已恢复的中间失败项作为 diagnostics 保留，不能单独覆盖有效任务终态；任务未完成或受限不伪装成功。schema 必须随适配模块交付，未来改为构建产物时也不能漏复制。JSONL 单行超过上限导致无法核对完整执行状态时明确失败并标记截断；最终输出有界，不直接作为实时子步骤或日志流进入 UI。
- UI 关闭或断连不停止任务，新增输入继续排队。本期不转发 AbortSignal、不添加执行超时或 Codex 专用取消；Turn 中断只停止旧投影，Codex 可能继续执行。统一 Tool 终止机制另见 [TODO](../../../../docs/TODO.md)。

## 保留的扩展连接

MCP client、Dynamic Provider 通道与 Swift/macOS/Automation 实现及配置保留，但不进入主 Agent 目录，不自动复制到 Codex。动态工具的 metadata 与在线 bridge 仍承担原通道合约；保留实现和 adapter 测试不能作为宿主迁移已完成的证据。
