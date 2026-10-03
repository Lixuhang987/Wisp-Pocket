# 文件引用 Input Item

用户已要求开始实现：将 `pdf` InputItem 替换为 `file_reference`，桌宠只交付原路径、不保存文件副本。

## 用例与合约

- 用户通过桌宠选择文件（仅暂存）或拖入本地原文件（沿既有松手目标提交）。选区截图继续使用 `image` 上传及 Blob 副本；文字、链接保持既有协议。
- `file_reference` 为 `{ type, id, path, name, mimeType? }`。`path` 是非空绝对路径，`name` 是非空文件名；不接受 `base64` / `blobId`，不检查文件存在性、不预读文件。不保留旧 `pdf` 输入兼容分支，不删除已有历史或 Blob。
- 数据流：桌宠入口 → ThreadInputController → socket 校验 → Thread/ThreadPersistence → SQLite 中的结构化 InputItem；翻译层仅将原路径、文件名和可选媒体类型转为模型文字。模型按需调用 `file.read`，读取当时的内容。
- 桌宠及 ThreadWindow 的 live、pending、恢复消息显示文件卡片和文件名，正文来自结构化 text/selection/skill，避免将路径摘要重复渲染为正文。文件卡片不加载原文件预览。
- 保持文件 ID、首次提交身份、ACK 清理、失败恢复、草稿与两处松手目标合约。

## 验证与实施顺序

1. 扩展 `default-reading.test.ts` 的既有真实 socket/SQLite 默认读取用例，提交结构化原路径并验证模型读到最新内容。
2. 修改 `pet-conversation.test.ts` 的既有两处 drop 参数化用例，验证结构化引用、无文件副本及重建后的附件身份。
3. 更新 `pet-interaction.test.tsx` 的既有选择、拖入、切换、失败重试用例；更新 Web 的 `composerInputItems.test.ts` 和 `messageBubble.test.tsx` 附件用例，并扩展 `initial-prompt-flow.test.ts` 的首轮关联用例验证 pending 的文件引用。
4. 实现类型、socket 校验、存储翻译、两端 guard/摘要/附件展示与桌宠路径入口。
5. 执行专项及全套 TS/Web 检查、Swift test/build、Electron build；自行核对所有 owning 文档、spec、manual QA，最后提交到独立分支。

本轮新增测试为 0，仅扩展已有测试。承接 Issue #6/#7 的累计预算（#6 已新增 3、#7 已新增 4），不重置预算。不为移除旧 pdf 协议单独增加负向测试。

侧聊天禁止子 agent，因此本轮文档审核由本 agent 完成，不能分发独立审核；不合并或重启主聊天工作区。

## 完成与验证

- 在独立 `codex/pet-file-reference` 分支实施，以 `codex/issues-6-7-pets-reading` 的 `2be612a` 为基点；worktree 基线通过。先扩展 socket 真实用例复现校验失败，再完成协议、翻译、持久化及展示。
- 全套 `bash ./scripts/test.sh`、`bash ./scripts/swiftw test`、`bash ./scripts/swiftw build` 与 Electron build 均通过；日志为 `/tmp/file-reference-{check,swift-test,swift-build,electron-build}.log`。renderer 126 项通过，本轮新增 0 项；真实用例证明不预读、不创建输入副本、按需读取最新内容以及恢复附件身份。
- 受控真实 Electron 文件卡片截图与 DOM/几何证据在本 worktree `.cache/file-reference{.png,-geometry.json}`，五次 hover 输入 / composer / 角色位移为 0；模型路径未出现在附件历史 DOM。后端、屏幕 / 光标、选择器为 fixture，完整宿主实机仍待验。
- 自行审核修改文件目录文档链、spec、代码及交叉引用，更新协议 / 存储 / renderer / 产品 / ADR 的过期描述；已迁移 TODO 到 manual QA。本侧聊天禁止子 agent，未执行独立 agent 审核，不宣称已完成该独立流程。

## 合入 Markdown 后的独立文档审核（2026-10-03）

原侧聊天禁止子 agent 的记录继续作为历史事实保留。本次合并由不继承主 agent 上下文的独立审核者阅读本规格、Markdown 规格、所有修改文件的 owning 目录文档及父级链，核对协议校验、翻译、持久化、pending 投影和两端 renderer / 用例。合并后的助手正文继续 Markdown / GFM；用户正文从结构化文字项提取并保持原文，用户主动输入的路径不被隐藏，附件路径仅供模型和工具使用，不重复进入文件卡片正文。已更新过期的服务入口、renderer / 测试指南和 surface；[manual QA](../../manual-qa.md) 已增加两项能力共同出现的合并回归，未发现阻断的规格或文档不一致。此审核不增加完整宿主、系统浏览器或真实模型的实机通过结论；合并检查结果由主 agent 记录。
