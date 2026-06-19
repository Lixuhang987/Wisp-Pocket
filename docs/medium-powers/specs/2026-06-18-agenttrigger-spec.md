# AgentTrigger Spec

## Background
现有系统里的 `trigger` 只是 PromptPanel 的手动 action 入口，和自动化触发没有产品关系。现在需要一套独立的 `AgentTrigger` 平台，用来把外部事件源转换成后台 agent 工作流：用户安装某个 Trigger 包后，为每个实例配置独立参数，命中条件后自动启动一次可回看的后台 thread，默认不唤起 ThreadWindow。

## Goal
支持一个通用的 `AgentTrigger` 接口，允许第三方开发者实现不同事件源的适配，例如 Chrome 指定书签文件夹、系统时间点、QQ 会话消息、GitHub PR 变化等。第一版内置两个可用 Trigger：Chrome 书签 Trigger，以及系统时间 Trigger。每个 Trigger 实例都可以定义自己的动态参数配置、过滤条件、prompt 模板、落库策略和通知策略；命中后以等效于一次 prompt 提交的方式交给 `agent-server`，创建后台 thread 并保留历史，供后续在 ThreadWindow 中查看。

## Non-Goals
不把它做成现有手动 `trigger` 的扩展或别名。不要求所有事件源都在第一版内建实现；第一版只要求通用平台边界、Chrome 书签 Trigger 和系统时间 Trigger 的产品形态。不在本 spec 中展开具体代码结构、协议字段或第三方打包细节。

## Use Cases
- 用户从 Trigger 市场安装一个 Chrome 书签 Trigger，并为该实例选择要监听的书签文件夹。
- 某个书签文件夹新增/变化后，系统自动命中该 Trigger，后台启动一次 agent thread，结果可在 ThreadWindow 历史里查看。
- 用户从 Trigger 市场安装一个系统时间 Trigger，并为该实例配置触发时间点；当本机时间到达该时刻时，系统自动后台启动一次 agent thread。
- 第三方开发者实现一个新的 Trigger 适配器，把 QQ 消息或 GitHub PR 事件映射到统一的 `AgentTrigger` 接口。
- 某个 Trigger 需要人工介入时，系统只在必要时通知用户，其余情况保持静默运行。
