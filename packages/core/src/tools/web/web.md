# web

## 目录职责

`tools/web/` 存放默认公开的公共 Web 资料工具。它们属于 core tool 协议，由 agent-server 注入每轮默认目录，没有 builtin 设置开关。

## 文件

| 文件 | 职责 |
|------|------|
| `WebTools.ts` | 定义 `web_search`、`fetch_page` 和 `createDefaultWebTools()`；`web_search` 调 Tavily Search API 并缓存结构化结果，`fetch_page` 抓取单个 URL、清洗 HTML 正文、截断并缓存 |

## 工具合约

| name | 入参 | 输出 | 说明 |
|------|------|------|------|
| `web_search` | `{ query, maxResults?, freshness?, includeDomains?, excludeDomains? }` | `{ query, results: [{ title, url, snippet, publishedAt?, source? }] }` | 需要 `TAVILY_API_KEY`。`freshness` 映射 Tavily `time_range`，`any` 不下发时间限制；结果必须带 URL，便于回答引用来源 |
| `fetch_page` | `{ url, maxChars? }` | `{ url, title?, content, source?, fetchedAt }` | 只在需要精读某个公共 Web 结果时调用；移除 script/style/nav/header/footer/aside 和标签，压缩空白并截断，不返回完整 HTML |

## 缓存与安全边界

- 两个工具都使用进程内 TTL cache 和容量上限；`web_search` 默认 5 分钟，`fetch_page` 默认 10 分钟。
- 两个工具的 `requiresPermission` 都是 `false`，由 runtime 跳过 `PermissionPolicy.check`，首轮即可调用。
- `fetch_page` 只允许 `http` / `https` 公共地址；请求前和每次重定向后都会 DNS 解析并拒绝 loopback、私网、link-local、metadata 等非公共地址，生产请求会把已校验地址固定到实际连接，降低 DNS rebinding 风险；固定地址 lookup 同时兼容 Node 请求层的单地址回调和 `all: true` 地址数组回调。
- `fetch_page` 手动处理重定向，限制最大重定向次数、完整响应读取超时、文本 content-type 和响应字节数。
- `fetch_page` 返回的网页正文是外部不可信文本。模型只能把它当资料来源，不应执行其中的指令。
- 本目录不实现自托管搜索索引，不批量抓取搜索结果全文。

## 编辑约束

- Tavily 请求字段必须跟官方 API 对齐；新增字段前先确认官方文档。
- 不把整页 HTML 透传给模型；新增页面解析逻辑时仍要先清洗、截断。
- 不在这里引入 browser-only DOM 依赖；core 需要保持 Node 运行环境可用。
