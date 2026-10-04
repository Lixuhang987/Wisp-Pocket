# 数据与协议合约

本文保留[多桌宠规格](./multi-pet-pocket-dialogue.md)当时的数据验收合约。历史范围：Pet 替代 Workspace、权威 rootPath 与按宠分组已由 Issue #8 替代；Issue #9 的前端 Pet 与无后端角色快照是已确认、尚未实现的新目标。本文不是当前数据模型或下一轮规格，替代关系从主文档进入；原条款保留用于追溯，不能据此回退后续决定。

## Pet 替换 Workspace

| 目标 | 必须满足的约束 |
| --- | --- |
| `Pet` / `PetRegistry` | 直接承接旧 Workspace 的命名文件根、默认项与 Thread 容器职责，再加入角色与图片；不存在另一个 Workspace 实体或 defaultWorkspaceId 引用 |
| `id` | 服务端生成、不可变、持久；同名、同图、同 rootPath 创建均生成不同 id |
| `name` / `description` | name trim 后非空；description 可空，只描述工作方式；同名选择器以缩略图和短 ID 辅助区分 |
| `rolePrompt` / `revision` | rolePrompt trim 后非空；每次成功编辑 revision 递增；原始文本可编辑，revision 用于快照来源与并发检查 |
| `imageRef` | 必填，引用已成功导入的静态图片或现有内置八千代资源；不是易失的外部文件路径或远程 URL |
| `rootPath` | 每宠一个非空绝对目录；用户可选已有目录或创建目录，后端统一验证 / 创建失败返回错误；允许重复，不按路径去重或合并宠；创建后不可修改，后端拒绝 rootPath 更新 |
| `isDefault` | 始终恰有一个默认宠；初次空安装自动种入内置图、基础角色提示和既有应用默认文件根 |

不设三宠硬上限；所有列表、窗口与测试夹具使用集合，不依赖三个固定槽或枚举角色。空安装只播种一只默认宠，其他由用户自由创建；显示子集不限制已创建数量。

图片导入至少支持 PNG、JPEG、WebP 静态图，保持比例与透明度；自定义宠首版使用静态图；内置八千代沿用已有动画，不要求生成动画或新增图集协议。图片原始 bytes 上限 20 MiB，复用现有拖入大小限制并在后端强制执行；后端额外拒绝宽或高超过 4096px 的解码图片。导入成功前不保存悬空 imageRef，失败保留表单；媒体副本由后端管理，用受控本地只读资源入口显示，renderer 不能获得任意磁盘读取能力。换图不删除身份与历史；缺图用内置占位与错误提示，不能随机改成别宠。

## Thread 归属与快照

| 数据 / 操作 | 合约 |
| --- | --- |
| `petId` | Thread 创建时必填且只能指向存在的 Pet；永久不变，替代旧 workspaceId，不再保留未归属分组 |
| `petSnapshot` | 服务端在创建时保存 petId、revision、name、rolePrompt 的实际值（不保存 rootPath）；不信任客户端提交的快照；Thread 只能在快照可靠保存后对外确认创建 |
| 编辑提示词 / rootPath | 提示词仅影响新 Thread，已有 Thread 继续角色快照；rootPath 创建后不可修改，后端拒绝修改请求，编辑界面只展示固定目录。角色快照决定旧 Thread 的执行提示，当前对话不显示原角色提示；不移动文件 |
| 编辑名字 / 图片 | 即时用于桌宠和列表展示，petId 与 Thread 不变；角色快照仍保存创建时名称和角色版本，桌宠当前对话不展示；旧图片不需要逐 Thread 复制 |
| Runtime 创建 / 恢复 / 中断后重建 | 角色从 Thread 快照取得，文件根从 Thread 所属 Pet 的固定配置取得；不能用当前角色覆盖已有快照；角色段复用既有 system sections，不伪装成 UserInput 或 Append Prompt |
| 提示组合 | 共享后端工具与 Permission 规则仍生效；角色段描述习惯，用户明确任务可覆盖口吻与格式；资料作为材料，不提升为角色 / 授权指令 |
| 历史查询 | 后端按 petId 筛选，分页排序固定为 updatedAt + id，返回 nextCursor；默认每页 50、上限 100；下一页不重复已返回项，新变化通过刷新处理 |
| list / started / snapshot | 都有一致的 petId、角色 revision、实际 rootPath 等身份摘要；snapshot 另含完整实际角色快照，UI 不从通知时间或路径猜归属。列表提供轻量运行状态，由 Thread owner / 持久记录派生，不复制运行状态 owner；同宠其他 Thread 的请求不引入聚合提醒或自动导航 |
| `op.submit` | 所属宠及执行上下文从 threadId 解析；输入持久化、opId 去重、排队、建议普通回复继续沿用当前 Thread 机制 |

同宠多 Thread 也只加载当前 Thread 的历史上下文。共享文件根不自动注入目录全内容、另一个 Thread 的附件或其他宠的对话；用户明确调用文件工具读取共享文件时，读到它是共享磁盘效果。

## 文件工具与权限

删除 `workspace.list` / `workspace.askUser` 及 `workspace.requested` / `workspace.answered` 路径；宠归属在输入前由用户选定，不让模型选“别宠文件根”来替代用户导航。按桌宠分组的 UI 也不再提供 Thread 的 Workspace 选择器。

`file.read` 直接替换旧 Workspace 读取工具，沿 [ADR 0004](../../../adr/0004-context-history-default-tools.md) 默认开放且免 Permission；读取允许任意路径，绝对路径直接读取，相对路径以 Thread 所属 Pet 的固定 rootPath 解析。每次读取取得当前文件内容，不缓存替代真实读取。`file.write` 保留 relativePath / content，移除 workspaceId，不新增模型可自由指定的 petId / rootPath 参数；执行文件上下文从 Thread 所属 Pet 取得，不能复用另一 Thread 的绑定工具实例。

file.write 继续拒绝绝对 relativePath、`..` 越界、符号链接越界和写入目标符号链接，保留大小限制与临时文件原子替换；缺失 Thread 上下文或旧归属参数明确失败。rootPath 是相对路径基准和内置写入边界，不能描述成读取或整个进程 / OS 的沙箱。桌宠原文件路径作为 `file_reference` Input Item 交付（字段真相见 [core protocol](../../../../packages/core/src/protocol/protocol.md)），模型只收到路径文字，不自动预读、不复制原文件、不增加文件变更监控或失效恢复；实际读取失败由工具如实返回。MCP / Dynamic Tool 仍遵守各自策略。

同进程 file.write 对规范化真实目标路径串行化，同一文件根的不同 petId 不得获得不同的文件锁。先完成的内容可以被后一个已授权写入按既有覆盖语义替换；不承诺版本合并或检测 App 外部修改。两个不同文件的写入不受彼此阻塞。等待锁的调用在实际写入前检查 Turn 中断；已完成的磁盘写入不能声称回滚。

Permission 继续只有 once / always，全局永久规则按完整工具名称匹配、跨宠生效，不因人设或 rootPath 改变范围。file.read 不产生 Permission 请求，也不查询其旧永久规则；其他需审批工具的 UI 在 always 处明确“对所有桌宠的此工具生效”，保留撤销入口。file.write 的归属检查独立于 Permission，永久允许不能改换写入文件根。取消 UserInput.mode 与 inspect/reply，首轮沿统一后端规则执行，user.ask 仅按需追问。

## 命令与通知

所有业务命令复用 `/api/thread` 和 commandId 关联；Pet 配置的通知仍是后端事实，Activity 不装历史，Dynamic Tool 不装管理命令。

pet.listed / pet.error 只回发起连接，成功变更通知广播相关 UI 连接并带新 revision；列表刷新与通知不能自动切换用户导航。图片导入复用服务端 Blob 保存与只读 HTTP 资源边界，通过新管理命令接收内容；保存命令只能引用已验证的图片 ID，不能将任意附件 blobId 当图片。传输上限需覆盖 base64 编码膨胀，不能让图片 bytes 进入配置通知。

| 命令 / 通知 | 必须表达的语义 |
| --- | --- |
| `pet.list` → `pet.listed` | 返回全部配置和唯一默认项，供选择器 / Settings 使用，不把原始角色提示广播进每条 Activity |
| `pet.image.import` → `pet.image.imported` | 接收 PNG / JPEG / WebP 的 MIME 与 base64，后端验证原始大小、实际图片格式与解码尺寸后保存副本，定向返回 imageRef；不创建 Thread，不将图片作为 UserInput 发送给模型 |
| `pet.create` → `pet.created` | 图片导入和配置持久成功后返回稳定 Pet；同一次 commandId 重投只产生一个宠，失败不留下可见半成品 |
| `pet.update` → `pet.updated` | 指定 id、expectedRevision、patch（不接受 rootPath）；过期返回 conflict 和最新 revision，保留客户端表单；设置 isDefault 时原子切换唯一默认项 |
| `pet.error` | 定向返回 commandId、错误 code 和可读原因；至少区别 invalid_input / not_found / conflict / storage_failed |
| `thread.start` → `thread.started` | 用必填 petId 替代 workspaceId；未知宠失败；只创建不执行，后续首轮仍经 op.submit；commandId 重投返回同一 Thread |
| `thread.list` → `thread.listed` | 可选 petId、limit、cursor；省略 petId 表示完整管理入口查询全部，但每项始终带 petId，不能表示无主 Thread。状态 / 请求变化沿已有通知更新该 Thread 轻量摘要，打开详情时才用 snapshot 恢复完整消息与请求 |
| `thread.resume` → `thread.snapshot` | 沿用 threadId，恢复真实快照与待答请求 |
| `thread.delete` / `op.submit` / Permission 回执 | 保留既有身份与唯一回执；删除 Thread 不删除 Pet / rootPath / 用户文件；不存在宠的新提交返回明确错误 |

本期不提供 Pet 归档 / 恢复或物理删除入口，不定义 archivedAt、includeArchived 或归档命令。隐藏角色只是界面可见状态，Pet 和 Thread 仍有效。创建、更新与 Thread 创建由同一后端入口协调，快照可靠持久化后才确认创建。

## 持久化与破坏性替换

PetRegistry 的持久 adapter 复用现有 SQLite 存储包与事务，不新增第二套数据库 / 消息库。Pet 记录、revision、默认项、Thread petId 与快照由同一个数据库承接；图片副本沿既有媒体存储方式管理。core 定义业务类型与端口，agent-server 组合，存储包不拥有运行队列。

Swift Settings 改为查询 / 发送 Pet 管理命令，不继续直写 workspaces.json，也不另写 pets.json；renderer localStorage 只用于可恢复的界面偏好 / 草稿，不存业务配置。

直接采用 Pet 目标模型与新 schema，不保留旧 Workspace API、配置读取或旧数据迁移 / 转换器，不保证旧开发 Thread 与触发器配置可继续使用。旧格式不进入新运行路径；旧 schema 明确拒绝打开，不自动迁移或清除；本次不修改用户数据，也不删除用户 rootPath 下的文件。

角色版本不需要完整编辑历史表：当前配置加每 Thread 自足快照即可恢复。模型凭据、其他工具的 Permission 和用户文件不复制到 Pet 记录。排队消息在应用重启后的处理策略见 [TODO](../../../TODO.md)，本期不新增继续 / 放弃队列协议。
