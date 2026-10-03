# 桌宠 Markdown 消息渲染

## 规格与边界

用户要求桌宠支持 Markdown，并说明潜在问题。助手正文支持标题、强调、列表、引用、代码、分隔线及 GFM 表格、删除线、任务列表；用户文字（含原文件路径）、状态、错误、建议和 Permission 仍按原有方式显示。原始消息仍是字符串，不改变协议或持久化。

保留约 210px 对话列、最新非空助手消息常态约三行高度预览、hover 完整历史、统一纵向滚动、输入节点/焦点/草稿及窗口底部锚点。块间距也占用预览预算，列表或代码可能仅显示部分块。代码保留缩进并允许长行折行，表格在单元格内折行；不增加内嵌纵向滚动，任务复选框只读。流式语法未闭合时允许暂时按解析器的当前结果显示，最终增量闭合后自然恢复。

原始 HTML 显示为普通文字，不挂载为 DOM；图片仅显示替代文字，不自动读取本地文件或请求网络。仅绝对 HTTP/HTTPS 链接可点击，点击交给系统浏览器；相对地址、锚点、其他协议仅保留可读标签。main 再校验外部 URL，拒绝创建新 Electron 窗口和页面内导航；不新增 renderer 宿主权限。

## 用例与调用链

1. `assistant.delta → Thread store → PetConversation → PetMessage → Markdown`：实时 Markdown 进入最新气泡；未闭合代码围栏继续接收同一 item 的增量后显示完整代码。
2. `thread.snapshot → Thread store → hover → PetMessage`：历史助手正文按同一规则解析；用户正文保留原文。hover 移出继续显示最新正文，输入节点和草稿不变。
3. Markdown 链接 → `target=_blank` → ActivityWindow `setWindowOpenHandler` → main 注入的 `shell.openExternal`；仅 HTTP/HTTPS，始终 deny 新窗口。原始 HTML / 图片不能建立隐式执行或网络链路。

核心契约复用 `AssistantMessageItem.text`、`ThreadItem` 和现有 `latest/expanded` 选择；增加 memoized Markdown 正文组件，稳定插件和组件映射，避免无关输入更新重解析历史正文。

## 实施与测试预算

- 基线：仓库脚本创建 `.worktrees/pet-markdown`，独立 CodeGraph 索引；`scripts/test.sh` 与 `scripts/swiftw build` 均通过。
- 扩展 `apps/electron-shell/tests/activity-window/pet-interaction.test.tsx` 的“悬停时最新回复和全部建议进入历史的同一滚动区，回复框保持固定节点”，验证 snapshot、增量、格式化正文、用户原文、安全展示和草稿保持。
- 扩展 `apps/electron-shell/tests/use-cases/pet-window.test.ts` 的“非激活显示后展开、接收点击滚动与外部 drop，并从透明空白恢复命中”，验证外部链接在系统边界打开与原窗继续可用。
- 本规格累计新增测试：0；复用以上 2 个完整流程，不为单个语法逐项新建 case。
- 实现桌宠专用 Markdown 正文和 token 样式，声明解析器依赖；增加 main 的链接处理，更新已有窗口替身。
- 执行专项测试、Electron build 和三项提交前检查；更新 owning 文档与 surface、manual QA，清除已完成 TODO。
- 独立子 agent 不继承上下文，审核本文及所有改动目录文档链；确认结论后提交。

## 验证状态

实现已完成。`scripts/test.sh`、`scripts/swiftw test`、`scripts/swiftw build` 与 Electron build 均通过；上述两套专项共 29 项通过，新增 0 项。受控 Electron 使用真实 renderer / CSS / preload / 原生控制器与协议 snapshot：长代码、表格无横向溢出，hover 前后角色与 composer 屏幕位移均为 0；链接仅交给外部打开回调，原页面未导航。截图、几何及临时夹具在 worktree `.cache/pet-markdown-*`。

独立文档审核已完成：审核者未继承主 agent 上下文，阅读本规格、全部改动文件的 owning 目录文档及父级链（`use-cases/` 无独立指南，使用 `tests/tests.md`），核对源码、测试、受控夹具与几何证据。助手与用户正文边界、HTML/图片限制、绝对 HTTP/HTTPS 外部打开与阻止页面导航、紧凑裁剪和流式/窄栏约束均与实现一致；已补齐 renderer / 测试指南、surface 和 [manual QA](../../manual-qa.md)，未发现阻断的文档或实现不一致。真实系统浏览器、中文输入法、多屏、透明命中和长流式内容仍需人工验收，受控夹具不等于完整宿主实机通过。

2026-10-03 文件引用合入后的边界补充：原文件从普通文字交付更新为结构化 `file_reference`，文件名卡片与用户正文分开；用户主动输入的路径和 Markdown 符号仍按原文显示，助手保持 Markdown / GFM。合并已由独立审核者核对修改目录文档链、协议、渲染与既有 hover 用例，详细记录见 [文件引用计划](./2026-10-03-file-reference-input.md)；既有实机证据仍只在原验证范围内有效。
