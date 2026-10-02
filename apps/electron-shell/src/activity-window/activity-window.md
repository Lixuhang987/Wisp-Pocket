# activity-window

本目录是[桌宠](../../../desktop/CONTEXT.md)的 React renderer。每窗永久绑定一个 `petId`，独立创建 Thread store、输入控制器与 socket；业务配置和正式历史仍由共享后端拥有。

## 直接子节点

- `App.tsx`：角色点击、hover、两处 drop、当前回复、历史弹层与原生窗口桥接。
- `PetManager.tsx`：伙伴列表、添加/编辑表单与角色图片导入；复用 `/api/thread` Pet 管理命令。
- `PetConversation.tsx`：紧凑最新正文/建议、hover 全部当前 Thread 消息与 Permission。
- `PetReply.tsx`：固定回复节点与 IME Enter 边界。
- `petThreadController.ts`：本宠导航、首轮关联、持久接收确认、重连及界面偏好恢复。
- `readDroppedItems.ts`：同步捕获拖入文本/本地路径；模型资料输入不读取 bytes。
- `PetSizeControl.tsx`、`PetSprite.tsx`：逐宠大小偏好与内置动画。
- [assets/assets.md](./assets/assets.md)：内置角色图集来源及播放合约。
- `styles.css`、`main.tsx`、`index.html`：共享主题、透明布局与 renderer 入口。

## 身份、导航和接收

- 配置从 `pet.listed/created/updated` 投影；不把业务配置写入 localStorage。Pet 根创建后固定，Thread 保留角色快照；实际目录消费后端身份字段，不能从前端路径猜归属。
- 启动恢复本宠上次选择，首次无偏好时选本宠最近更新的历史且仅显示角色；后续只有明确选择、新话题或本界面主动创建确认能改变选择。后台 Thread 不抢草稿/焦点。选择可能在后续分页中，第一页缺失不能视为删除；resume 明确返回 not_found 后才清理其草稿并回到本宠历史或空态。
- 草稿按 `(petId, threadId 或 new)` 保存，大小、选择与点击显隐也按 petId 隔离。保存失败显示原因并保留内存输入；这些偏好不是后端消息或执行队列。
- 打开空回复框不创建历史，第一次发送才创建 Thread。`thread.started` 仅确认创建；`user.message.recorded` 或 snapshot 中相同 opId 的真实记录才确认接收。创建/接收失败保留输入，确认不清除后来编辑的草稿。
- 未确认提交的 commandId/opId、路径与已创建 Thread 关系随界面偏好保存；重试相同输入沿用身份，不新建重复 Thread。后端仍负责执行去重、持久化和排队。
- 角色 drop 新建本宠 Thread，对话区 drop 追加松手时的 Thread；App 在异步处理前捕获目标和提交身份，切历史/收起不能改投。没有当前 Thread 的追加明确失败。
- 原文件只通过文本 Input Item 交付绝对路径，preload 使用 Electron `webUtils.getPathForFile` 取得真实路径。无路径图片明确失败；模型读取由默认 `file.read` 决定，不自动预读、上传或复制用户资料。
- 角色图片导入是另一条管理流程：PNG/JPEG/WebP bytes 发送 `pet.image.import`，后端验证后保存受管副本；renderer 经 Blob 只读 URL 展示。
- Permission 回答使用 ClientResponse，建议和回复使用普通 UserInput；后端仲裁首个有效回执。隐藏宠收到有效 Permission 可以显示，但不切换当前 Thread、不聚焦。

## Surface 和原生边界

- 点击角色显示并聚焦输入，再点隐藏；仅 hover 对话区展开全部当前 Thread 历史，移出立即收起，输入节点/焦点/草稿保持。历史与伙伴弹层只管理选择/配置，不锁定消息浏览。
- 常态显示最新非空 assistant 正文与当前建议；工具过程保持在完整 ThreadWindow。标题/目录来自当前身份；同时展示 Thread 创建时的宠名与角色版本，角色变化时提示旧 Thread 使用原角色。
- 逐窗命中使用实际 DOM 矩形，上方历史按浏览视口裁剪；角色、回复框和弹层各自上报。布局槽位和锚点来自 [共享布局](../src.md)，透明空白穿透仍由 main 决定。
- `setReceiving` 覆盖文件选择、drop 和等待持久 ACK；main 在接收完成前隐藏但延后回收 renderer。隐藏不是中断；“停止本轮”发送当前 Thread 的 Interrupt。
- 自定义静态图保持比例；缺图显示内置占位及错误，不改变身份。主题和气泡继续遵守 [DESIGN](../../../../DESIGN.md)。

## 验证

[renderer 测试](../../tests/activity-window/activity-window.md)验证交互与偏好；真实 SQLite/Runtime 接收见 agent-server `pet-conversation`。跨应用 drop、多屏、原生焦点、透明命中仍须 [manual QA](../../../../docs/manual-qa.md)。
