# 时间上下文与系统提示持久化实施计划

状态：2026-10-04 已实现，独立文档审核完成；后续 Issue #9 已将角色改为前端首轮普通输入，其余 system 与时间合同保留；真实宿主与模型回归列入 [manual QA](../../manual-qa.md)。

用户 2026-10-04 已要求直接修改后端：临时 system 提示未进入 Thread 历史属于缺陷，须与首轮时间注入、距最近注入超过一小时再注入一起修复。沿原请求补齐 Context History 本地时间和活动时间过滤；第一版不增加时钟工具、相对窗口参数或额外刷新条件。

## 用例、数据与接口

- 新 Thread 首个实际 Turn：Thread 固定本轮开始时间 → Runtime 解析工具策略、项目规则与时间上下文 → 通过 Thread 回调先保存 system response item → 模型读取已持久的上下文 → 生成增量保存。存储失败时不能先发送模型请求。
- 后续 Turn：按 system section 的结构化名称保存变更版本；模型投影只使用各 section 最新有效值，删除规则保存空版本。避免重复注入相同规则，也避免旧项目规则继续生效。时间消息按独立结构化 timestamp 恢复，只有当前开始时间减最近注入时间严格大于 3600 秒才新增。
- system AgentMessage 增加可识别的 section 名称或时间上下文 metadata。这些仍保存为 response_item；不增加 SQLite schema。系统消息进入持久历史，用户可见投影与 messageCount 排除 system，标题按用户消息判断。
- Runtime 保留完整内部消息；模型请求投影将最新规则前置，时间提示保持上下文顺序。Thread 回调持久化 system 后调整生成增量起点，失败/中断保留已保存提示，后续完成不重复保存。
- 时间提示包含带偏移本地时刻、宿主 IANA 时区，以及距上次基准的实际时间。每轮在开始执行时固定，工具循环中不刷新。
- Context History 的 Swift encoder 和工具 formatter 输出宿主本地带偏移 ISO8601，秒粒度；Node 使用 Date.parse 比较绝对时刻，工具结果统一转换为后端本地带偏移时间，不依赖既有索引是否已经重写。第一版不增加采集时区历史管理或既有数据迁移。
- activity_index 新增 start/end，格式复用 thumbnails：带偏移 ISO8601 或 epoch 秒，端点包含，start>end 失败；先过滤再倒序和 limit。样本详情与原图仍按 ID 读取，不增加分页。

## 测试预算与实施顺序

本需求累计新增测试上限 4，本轮新增 3；优先扩展现有测试。

1. 修改 `runtime-use-cases.test.ts` 的默认 system 提示用例，证明结果保留 section 且后续调用不重复；扩展已有流式用例保留其工具循环覆盖。
2. 在既有延迟持久化参数化用例增加 context case（计一个新增），证明中断期间已确认写入的 system 留在内存与磁盘、接续不重复。扩展 `thread-ownership.test.ts` 的重启恢复用例，固定时钟，覆盖首轮、整一小时、超过一小时、恢复、输入去重、内部上下文隔离与消息数；扩展其中中断用例证明保存过的 system 不会被丢弃。
3. 新增一个真实 Thread/SQLite 故障与项目规则变更用例，证明 system 在模型调用前已落盘、失败后可恢复、最新规则替换及清除生效。
4. 新增一个 Swift 真 Store 用例，验证带偏移落盘、重建读取及 activity_index 范围过滤。使用隔离目录与注入时区，不写用户数据。
5. 扩展 `default-reading.test.ts` 的真实协议主路径，给活动/截图查询提供范围参数并核对边界；静态 Swift fixture 保持原始来源，偏移格式由新增 Swift Store 用例验证。
6. 实现 SystemPrompt / Runtime / Thread、持久化与投影，随后实现 Swift / Node 格式和时间过滤。更新受 system 持久化影响的原测试预期，不扩张独立测试数量。
7. 完成专项与三项检查；同步 owning 文档、规格和 manual QA。按 AGENTS.md 委派不继承上下文的独立文档审核，收到结论且文档一致后提交。

## 验证边界

worktree：`.worktrees/time-context-persistence`；CodeGraph projectPath 必须显式使用 `/Users/mu9/proj/handAgent/.worktrees/time-context-persistence`。初始化成功，TypeScript/Web 基线与 Swift build 均输出 success。

小时内的提示是最近一次注入时的基准，不能承诺分钟级实时准确；时间范围由模型显式传入，本期不新增自动相对范围解析。采样空档、查询截断和系统权限仍需用户在回答或实机 QA 中辨识，不能宣称完整操作日志。


## 完成与检查

- [x] 阅读根架构、领域路由、产品及全部改动目录文档链，核对已确认简版；主 checkout 创建 worktree，CodeGraph 独立索引与分层基线成功。
- [x] 完成 system 规则版本/模型投影、首轮及小时阈值、持久恢复、Swift 本地时间与 Node 显式范围过滤。
- [x] 更新 owning 模块文档、索引与测试指南，并将完成 TODO 移入 manual QA；独立文档审核确认 spec、代码与当前文档一致，未发现阻断问题。
- [x] 最终 `bash ./scripts/test.sh`、隔离 Foundation home 的 `bash ./scripts/swiftw test`、`bash ./scripts/swiftw build` 均 success。专项 35 项通过，前置 system 标题回归所在 ThreadPersistence 9 项通过；此前 core/server/thread-store 集合 283 passed、1 skipped。本 spec 累计新增 3 项测试，其余扩展既有用例。

自动化使用真实 Thread/SQLite、Swift Store 和真实保存夹具，在模型网络与宿主系统边界使用可控输入；本轮未执行完整宿主与真实模型验收。小时内时间基准、采集空档和 limit 截断的限制继续保留，不能把本轮检查当作“最近十分钟”自然语言回答已经正确的证据。

合并后复验：时间实现与共享消息投影一并合入后，TypeScript/Web、隔离 Foundation home 的 Swift test、Swift build 均通过，内部 system 隐藏与纯建议等待恢复同时保留。后续 PRODUCT 最终意图的纯文档提交已同步时间合约，生产代码与已验合并版本一致；本轮只核对文档和链接，不新增真实宿主 / 模型验收结论。
