# activity-window

本目录是[桌宠](../../../desktop/CONTEXT.md)的 React renderer。每窗永久绑定一个 `petId`，独立创建 Thread store、输入控制器与 socket；Pet 资料、关联与几何由 Electron main 的前端 store 拥有，消息类型及内容判断共用 [messages](../../../thread-window-web/src/messages/messages.md)，正式历史仍由共享后端拥有。

## 直接子节点

- `App.tsx`：角色点击、hover、两处 drop、当前回复、历史弹层与原生窗口桥接。
- `PetManager.tsx`：接入 [共享伙伴表单](../../../thread-window-web/src/src.md)，与 Electron 设置使用同一资料、受管图片、显示隐藏、工作区分配与 revision 规则。
- `PetConversation.tsx`：紧凑最新正文/建议、hover 全部当前 Thread 消息与 Permission。
- `PetMarkdown.tsx`：助手 Markdown 正文与资源/链接展示边界。
- `PetReply.tsx`：固定输入、文件 chip、底部图标行、发送/停止与 IME Enter 边界。
- `petThreadController.ts`：本宠导航、首轮关联、持久接收确认、重连及界面偏好恢复。
- `readDroppedItems.ts`：同步捕获拖入文本/本地路径；模型资料输入不读取 bytes。
- `PetSizeControl.tsx`、`PetSprite.tsx`：逐宠大小偏好与内置动画。
- `PetContextMenu.tsx`：角色右键菜单，承载伙伴、对话、大小调节与隐藏入口。
- [assets/assets.md](./assets/assets.md)：内置角色图集来源及播放合约。
- `styles.css`、`main.tsx`、`index.html`：共享主题、透明布局与 renderer 入口。

## 身份、导航和接收

- Pet 配置和当前 workspaceId / threadId 从 [前端伙伴桥](../../../thread-window-web/src/src.md) 查询与订阅；renderer 不再接收后端 Pet 协议，也不持久化当前 Thread 选择。null 表示准备新话题，不能自动选择项目最近历史。
- 历史按当前 Workspace 查询；切项目更新 socket 查询作用域而不关闭连接，旧 Thread 的在途输入与执行继续。明确选历史、新话题与首发创建确认均经过 main 的唯一分配入口；失败显示错误并保留原关联。首发使用 expected 原关联与 activate:false，main 在异步检查后拒绝较新导航 / 显隐操作已替换的分配，避免旧确认覆盖用户选择。后台新建不自动切换当前 Thread。
- 文字与待发送文件路径按 `(petId, threadId 或 new)` 保存，点击对话显隐也按 petId 隔离；伙伴大小与实际显示由 main 保存。保存失败显示原因并保留内存输入；这些偏好不是后端消息或执行队列。
- 打开空回复框不创建历史，第一次发送才创建 Thread。`thread.started` 仅确认创建；`user.message.recorded` 或 snapshot 中相同 opId 的真实记录才确认接收。创建/接收失败保留输入，确认不清除后来编辑的草稿。
- 未确认提交的 commandId/opId、路径、已创建 Thread 关系与导航代次随界面偏好保存；初始化不推进代次，用户导航在分配前保存新代次，确保重建不会使已撤销的旧确认重新匹配；重试相同输入沿用身份，不新建重复 Thread。后端仍负责执行去重、持久化和排队。
- 角色 drop 新建本宠 Thread，对话区 drop 追加松手时的 Thread；App 在异步处理前捕获目标和提交身份，切历史/收起不能改投。没有当前 Thread 的追加明确失败。
- 原文件只通过 `file_reference` Input Item 交付绝对路径及文件名，preload 使用 Electron `webUtils.getPathForFile` 取得真实路径。无路径图片明确失败；模型读取由默认 `file.read` 决定，不自动预读、上传或复制用户资料。用户附件消息按结构化项显示图标和文件名，不显示完整路径或翻译后的模型文字；pending、live 与恢复一致。协议与转换见 [core](../../../../packages/core/src/protocol/protocol.md) 和 [agent-server](../../../agent-server/src/protocol/protocol.md)。
- 角色图片导入是另一条管理流程：PNG/JPEG/WebP bytes 交付前端导入桥，main 保存受管副本；renderer 使用返回的只读 URL 展示，不调用后端 Pet API。
- Permission 回答使用 ClientResponse，建议和回复使用普通 UserInput；后端仲裁首个有效回执。当前已关联 Thread 的有效 Permission 可揭示对话而不聚焦；跨入口或其他 Thread 的伙伴承接由 main 统一分配，renderer 不按整个项目历史自行召回。

## Surface 和原生边界

- 点击角色显示并聚焦输入，再点隐藏；仅 hover 对话区展开全部当前 Thread 历史，移出立即收起，输入节点/焦点/草稿保持。历史与伙伴弹层只管理选择/配置，不锁定消息浏览。回复框聚焦不绘制轮廓，仍保留光标与输入焦点；按钮键盘焦点提示和 drop 高亮独立保留。
- 选择文件只添加到选择开始时的草稿，不创建 Thread 或提交；文件名 chip 可移除。发送将文字和结构化文件引用一次提交，持久 ACK 按提交文件 id 清理，期间新增资料和新编辑文字保留；失败可重试，建议文字不消耗待发送资料。新建对话图标只导航 new 并聚焦。
- 角色周围不设常驻管理入口；伙伴、工作区对话、选择工作区、当前工作区唤出新伙伴、隐藏与大小调节在角色右键菜单中提供，菜单支持方向键、Escape、外部点击及失焦关闭。菜单显隐不改变逐宠对话显隐恢复与角色点击语义。当前对话不设常驻身份标题气泡或名字/版本。角色提示只在新话题首发作为普通 skill Input Item 注入，并随稳定 submission 保存以支持重建重试；旧话题不重新注入，首轮消息中的角色附件遵循下文展示规则。不展示根目录或路径 title，项目目录在 Workspaces 中查看。
- 显示对话后常态呈现最新有可见内容的 assistant 正文与当前建议；只有建议时独立显示按钮，不创建空正文气泡。消息保持底部对齐、统一滚动；整个 composer 留在其外，底部工具行固定，文件 chip 限高滚动；紧凑高度测量包括所有 composer 内容。工具过程保持在完整 ThreadWindow。
- 助手正文按 Markdown / GFM 呈现，常态限制为约三行正文的高度预算（块间距也占用预算），hover 查看全文；用户正文优先从结构化 text / text_selection / 非角色 skill 提取并按原文显示，其中用户主动输入的路径仍是文字；首轮角色 skill 使用共享 `role_prompt` 展示附件，单行省略且 title 保留全文，不作为正文；`file_reference` 仅显示文件卡片，不拼入模型路径摘要。没有结构化项时保留原 text 回显；状态、错误、建议和 Permission 不参与 Markdown 解析。代码长行及表格单元格折行，不增加内嵌纵向滚动；任务复选框只读，流式未闭合语法按当前增量解析。原始 HTML 只显示文字，Markdown 图片只显示替代文字（无替代文字时显示“图片”），不自动加载资源；此限制不改变用户主动交付的图片附件展示。仅绝对 HTTP/HTTPS 链接可点击，由 [窗口控制器](../main/windows/windows.md) 再校验并交给系统浏览器，不能导航桌宠页面。
- 逐窗命中使用实际 DOM 矩形，上方历史按浏览视口裁剪；角色、回复框和弹层各自上报。布局槽位和锚点来自 [共享布局](../src.md)，透明空白穿透仍由 main 决定。
- `setReceiving` 覆盖文件选择、drop 和等待持久 ACK；main 在接收完成前隐藏但延后回收 renderer。隐藏不是中断；发送按钮在当前 Thread 运行时切换为停止并发送 Interrupt，不清草稿。Enter 仍可提交补充输入到后端队列，IME 组合不提交。
- 自定义静态图保持比例；缺图显示内置占位及错误，不改变身份。主题和气泡继续遵守 [DESIGN](../../../../DESIGN.md)。

## 验证

[renderer 测试](../../tests/activity-window/activity-window.md)验证交互与偏好；真实 SQLite/Runtime 接收见 agent-server `pet-conversation`。跨应用 drop、多屏、原生焦点、透明命中仍须 [manual QA](../../../../docs/manual-qa.md)。
