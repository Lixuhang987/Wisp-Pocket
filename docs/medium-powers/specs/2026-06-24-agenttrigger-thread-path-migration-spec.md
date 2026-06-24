# AgentTrigger Thread Path Migration Spec

## Background
当前目标架构中，AgentTrigger 应当只是 Swift 桌面宿主里的自动输入来源：它监听外部事件，把命中的事件渲染为普通用户输入，再创建一个可回看的后台 thread。

现有实现仍残留一条特殊后台启动链路：Swift 把 trigger fire command 交给 Electron，Electron 再 POST 到 agent-server 的 `/api/agent-trigger/fire`，由 agent-server 自己创建 thread、注入默认 dynamic tools 并提交首轮输入。这让 agent-server 和 core 知道了 AgentTrigger 概念，也迫使 core 保存默认 host dynamic tool 列表。该边界不成立：core 只应知道通用 thread、runtime、tool 与 dynamic tool 协议，不应知道宿主有哪些默认工具，也不应知道某个 thread 来自 trigger。

## Goal
把 AgentTrigger 迁移为纯 Swift 宿主侧输入来源。Trigger 命中后，Swift `AgentTriggerRuntime` 将事件渲染成普通 `UserInput`，并复用 `SwiftThreadClient` 的 `/api/thread` `thread.start(dynamicTools)` + 首轮 `op.submit(UserInput)` 流程创建后台 thread。

迁移完成后，agent-server、core、thread-store 和 React ThreadWindow 看到的 trigger thread 与普通 PromptPanel thread 没有协议差异。dynamic tools 只由 `thread.start.payload.dynamicTools` 携带；core 不保存 host 默认工具列表，不包含 AgentTrigger fire 或 attention 专用协议。

这是一次破坏性架构迁移，不保留旧 `/api/agent-trigger/fire` 特殊启动路径，不为旧 AgentTrigger DTO 增加兼容层。

## Non-Goals
- 不改变 Chrome Bookmarks、System Clock 等 trigger provider 的用户配置模型。
- 不把 trigger 重新定义成 agent-server 或 core 监听的后台任务系统。
- 不为 trigger thread 引入新的 thread 类型、专用 runtime、专用持久化表或专用 tool scope。
- 不保留 `/api/agent-trigger/fire`、Electron `agent_trigger.fire` command 或 agent-server `AgentTriggerLaunchService` 作为兼容入口。
- 不让 core 保存或导出默认 `host_macos` dynamic tool 列表。
- 不要求 trigger 命中时自动打开 ThreadWindow；后台静默创建仍是默认体验。

## Use Cases
- Trigger：Chrome Bookmarks provider 在 Swift 中收到命中的新增书签事件。  
  Expected result/effect：Swift 将事件渲染成普通 `UserInput`，通过 `/api/thread` 创建后台 thread 并提交首轮输入；agent-server 不知道该 thread 来自 Chrome Bookmarks trigger。

- Trigger：System Clock provider 在 Swift 中到达配置时间点。  
  Expected result/effect：Swift 复用同一条 `/api/thread` 提交流程创建后台 thread；该 thread 出现在普通 ThreadWindow 历史里，可按普通 thread 打开和恢复。

- Trigger：trigger 创建 thread 时需要 host dynamic tools。  
  Expected result/effect：Swift 在 `thread.start.payload.dynamicTools` 中携带当前 host / plugin dynamic tool specs；core 和 agent-server 不提供默认 host tool fallback。

- Trigger：trigger thread 运行中请求权限或 workspace 选择。  
  Expected result/effect：请求按普通 `/api/thread` `ServerRequest` 分发给 React ThreadWindow 的交互式 owner；不走 trigger 专用 attention 协议。

- Trigger：用户打开由 trigger 创建的历史 thread。  
  Expected result/effect：React ThreadWindow 使用普通 `thread.resume` 获取 snapshot 并展示消息；UI 不依赖任何 AgentTrigger 专用协议才能恢复该 thread。

- Trigger：旧 Electron 或 agent-server 代码尝试调用 `/api/agent-trigger/fire`。  
  Expected result/effect：该入口不存在或不可用；系统不为旧特殊链路提供兼容行为。
