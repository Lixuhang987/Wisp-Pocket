# actions

本目录提供 Tool 的外部适配。ThreadTools 拥有每个 Thread 的可见工具集合；本目录不拥有对话状态、导航或请求。

## 直接子节点

- `MCPServerRegistry.ts`：按 serverId 复用 client 与适配后的工具。
- `DefaultReadTools.ts`：组合 file.read 与四个 context_history 普通工具，独立于 Swift Provider 和 builtin 设置。
- `LocalFileReader.ts`：调用时读取原路径的文本、PDF、PNG/JPEG/WebP；不创建用户文件副本。
- `ReadImage.ts`：完整解码、实际 MIME、尺寸与 PNG 完整性校验。
- `ContextHistoryReader.ts`：读取 Swift 已发布的本地活动、AX、PNG 证据。

## 默认读取与模型内容

默认工具、Web 工具和 user.ask 首轮可见，激活其他工具后继续保留。文件与历史读取免 Permission，不依赖 Workspace 或在线 Swift Provider；file.write 与其他工具保留原设置/Permission。

文件每次调用读取当前路径；不存在、无权限、非普通文件、坏图片与不支持二进制明确失败。UTF-8 文本可为空；读取最大 20 MiB，不静默截断。PDF 复用 PDF.js，最多 200 页、8 万字，扫描/加密/坏 PDF 明确失败，不提供 OCR。

图片用 success / contentItems 返回真实内容和关联元数据，普通工具不伪造 Dynamic callId；三类 Provider 的实际图片承载见 [Provider adapters](../../../../packages/core/src/adapters/providers/providers.md)。桌宠输入只是路径文字，只有模型调用读取后才提供内容；PromptPanel 既有直接图片输入不经过此读取器。

## Swift / Node 历史存储合约

写入方是 [Context History](../../../host-automation/Sources/sources.md)，Node 只读 `~/.spotAgent/context-history`。`activities.json` / `screenshots.json` 是各自原子替换的数组索引；AX 为 `ax/<id>.json`；截图索引记录 originalPath / thumbnailPath，文件为完整 PNG 的 base64 文本。时间采用 ISO8601，Activity app/window 的值为字符串，AX 保留原始类型；目标 pid、window id/title 归一化核对。

单文件原子替换不是跨文件事务：Swift 先保存 AX 再发布活动，先保存图片再发布截图索引，最后更新活动 thumbnailId。新截图已发布而活动尚未关联属于正常过渡；不能因此报损坏或伪造一致快照。已发布索引引用的缺失/损坏证据、错误尺寸或目标关联必须失败。

索引文件不存在表示空历史，损坏或访问错误不是空历史。活动按时间倒序，详情保持请求 ID 顺序；limit 默认20、范围1–200，时间范围含端点。activity_index 不推断实时 collection 状态；采集失败与恢复由 Swift 设置状态源展示。

跨语言共享验证使用 [真实 Swift 保存夹具](../../tests/fixtures/context-history/context-history.md)，不能用两端各自手写的格式宣称兼容。

## 激活与连接

MCP server id 来自上游配置；失败记录 skip 而不阻断 builtin。动态工具按持久 metadata 适配，实时执行通过 bridge 找在线 Provider；不借此通道承载前端管理。默认读取、MCP 与动态工具统一由 [core ThreadTools](../../../../packages/core/src/thread/thread.md) 组合。
