# 角色附件与首轮重复气泡

## 用例与边界

用户在桌宠新话题发送首条文字：正文只显示主动文字，角色提示显示独立的一行附件，超宽省略，完整内容可通过 title 查看。首轮注入仍使用 `skill/actionId=initial-role`，不新增后端 Pet 身份或改变模型提示优先级。Append Prompt 保留既有展示语义。桌宠和完整 ThreadWindow 都识别同一角色附件。

一次提交只显示一条用户消息；ACK、Turn 开始和 snapshot 都按稳定 opId 对应，不按正文去重，主动提交相同文字仍是两条消息。角色提示原文和结构化输入继续保存并进入模型。

## 调用链检查点

`PetReply → PetThreadController.submit → ThreadInputController → socket op.submit → Thread/SQLite → user.message.recorded / turn.started / thread.snapshot → inputHandoff + threadProjection → PetMessage / ThreadItemBubble`。

- 提交：真实 renderer 用例观察一个 thread.start 和一个 op.submit、稳定 commandId/opId、角色 Input Item。
- 接收/执行：真实 server 用例观察 SQLite 用户记录数与脚本模型请求，确认不是双执行。
- 确认/恢复：renderer 和真实 server 用例比较 ACK、Turn 开始、运行中 resume 后用户项身份、数量和 pending。
- 呈现：两端实际组件核对角色附件与正文分离，受控 Electron 核对一行裁剪；不把 fixture 当真实模型验收。

## 测试预算与顺序

优先扩展 `pet-interaction.test.tsx` 既有“首条文字只创建一个 Thread…”用例，覆盖 ACK 后运行 snapshot 和重复同文独立提交；扩展 `pet-conversation.test.ts` 既有“空白回复框首次文字…”真实 SQLite 流程，加入 role、运行中 resume 与重建；扩展 `messageBubble.test.tsx` 既有附件用例验证角色新附件。总新增上限 4，最终新增 1，覆盖快照早于 ACK 与同文不同 opId。

先跑红色复现，再根据首个失败节点修复首轮摘要生命周期；共享消息模块识别角色附件，两端用一行卡片呈现。保持现有草稿、导航、ACK 与排队语义。检查 `scripts/test.sh`、Swift test/build、Electron build；同步 owning 文档和 manual QA，完成空上下文独立文档审核后提交。

## 证据与交付状态

- Worktree 独立索引、TypeScript/Web 与 Swift build 基线通过；首次 Web 基线受并发负载出现既有选择测试超时，复跑通过。
- 两条用户气泡已在既有 renderer 用例及真实 Thread/SQLite 用例稳定复现：一次 op.submit、SQLite 一个用户记录、真实运行 snapshot 一个用户记录，但 store 投影两条。首轮摘要原本只到 Turn 完成才清除；运行 snapshot 按“没有任意 pending 用户项”判断，又补出本地摘要。
- 按首轮 clientRequestId/opId 在持久 ACK、匹配 Turn 和 snapshot 正式用户记录处收敛；只清理匹配占位，不按文字或其他 pending 判断。原角色 skill 不改协议，共享模块生成 `role_prompt` 展示附件，两端单行省略，title 保留提示全文。
- 本 spec 累计新增测试 1（Web 快照早于 ACK 与同文不同 opId）；其余扩展既有流程。专项 Web 43、Pet renderer 22、真实后端 15 项通过。既有首轮 / Turn 终态 fixture 已校正为真实 opId 对应合同。
- 当前 worktree 的 Electron build 成功；受控 socket / 前端桥运行真实桌宠产物，CUA 确认文件 URL 与 worktree 一致。单次发送后一个气泡、正文独立；长角色标签宽 144px、内容宽 648px、高 21.45px（一行），nowrap/ellipsis 生效，证据在 `.cache/role-qa/evidence.json` 与 `preview.png`。应用已退出。不据此宣称生产数据库、真实模型、完整宿主或两端全部视觉已验。
- 最终 `bash ./scripts/test.sh`、Swift test/build 与 Electron build 均通过；全量检查发现的三个既有 Turn 终态 fixture 已按真实首轮 opId 校正，专项 39 项和全量复跑通过。
- 独立空上下文文档审核完成：核对本计划、生产代码、测试及全部修改目录到根的指南；角色附件仅为 UI 投影、原始模型输入 / 存储与同文不同 opId 均一致。已修正旧角色隐藏要求、snapshot 无条件保留摘要的表述和测试新增数，并复读成功 Electron 测量证据；范围内未留文档不一致。完整宿主、真实模型、两端主题与队列实机验收仍见 [manual QA](../../manual-qa.md)。
