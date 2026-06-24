# Context History Plugin Spec

## Background

HandAgent 当前已经有 dynamic tool 机制：Swift desktop 作为默认 provider 连接 `/api/dynamic-tools`，把 `host_macos.*` 能力和 `~/.spotAgent/plugins/<id>/plugin.json` 声明的 plugin tools 合并后暴露给 core。agent-server 只负责保存 tool spec、路由 tool call request、等待 provider response；plugin 生命周期归 Swift 管理。

现有 plugin 形态仍偏被动 tool provider。`alwaysOn` plugin 可以由 Swift 启动并保活，但当前 tool 调用仍通过 stdin/stdout 另起进程执行；还没有通用的常驻 plugin RPC，也没有 plugin 主动调用 Swift host capability 的协议。

用户需要一个默认关闭、显式启用后持续运行的官方 plugin，用来长期收集最近桌面上下文。它不改变 thread 初始上下文协议：PromptPanel 提交时仍只包含用户主动输入和主动附件；采集到的 app、截图和 AX 信息只有在 LLM 主动调用该 plugin 的 dynamic tools 后才返回。

## Goal

提供一个内置官方 Context History plugin，随 HandAgent 发布，并自动安装或修复到 `~/.spotAgent/plugins`。用户在设置中显式启用后，后台采集服务开始运行；禁用后停止采集，但已保存历史按保留策略继续存在。

采集内容包括：前台 app / 前台窗口变化记录；当前 app / window 未变化但持续 30 秒时的周期性采样记录；每分钟全屏原图截图和对应缩略图；每次 app / window 变化或 30 秒周期采样时的前台 app AX/UI 树摘要。

Context History plugin 通过分层 dynamic tools 从轻到重暴露历史上下文：先返回 activity index 和采集 id，再按 id 批量读取 app / window / AX 样本，再按时间范围读取缩略图，最后按单个截图 id 读取原图。

第一版允许 Swift 宿主实现默认采集服务和本地存储；官方 plugin 作为产品边界、设置边界和 tool namespace 边界。后续可以为第三方 plugin 设计 host capability RPC，让外部 plugin 自己实现采集或复用 Swift 提供的采集能力。

## Non-Goals

- 不让采集内容自动进入 thread 初始上下文。
- 不在第一版实现通用常驻 plugin RPC。
- 不在第一版实现 plugin 主动调用 Swift host capability 的通用协议。
- 不让 AI 自动生成后台采集器、权限策略、磁盘保留策略或截图写入逻辑。
- 不采集全局窗口列表作为默认上下文，避免无关窗口污染当前任务上下文。
- 不在第一版实现日总结；长期保留为后续总结能力预留数据基础。
- 不把 Context History 和自进化自动化合并成一个系统；它们可以共享 Swift AX / screenshot / app 信息能力，但产品目标独立。

## Use Cases

- 触发：用户在设置中启用 Context History plugin。
- 预期结果：Swift 启动后台采集服务，按规则写入 `~/.spotAgent/context-history`，并让该 plugin 的 dynamic tools 在新 thread 中可用。

- 触发：前台 app 或前台窗口发生变化，或同一 app / window 连续 30 秒未变化。
- 预期结果：系统写入一次 activity sample，包含采集 id、时间戳、前台 app 信息、前台窗口信息和 AX/UI 树摘要引用。

- 触发：后台采集服务运行满一分钟。
- 预期结果：系统保存一张全屏原图和一张缩略图，记录截图 id、时间戳、文件路径、尺寸和关联的活动样本。

- 触发：LLM 调用轻量 activity index tool，查询最近一段时间的活动。
- 预期结果：tool 返回 app/window 活动片段和采集 id，不返回完整 AX 树或图片原文。

- 触发：LLM 根据采集 id 调用样本详情 tool。
- 预期结果：tool 批量返回对应 app 信息、窗口信息和 AX/UI 树摘要。

- 触发：LLM 调用缩略图查询 tool。
- 预期结果：tool 返回指定时间范围内的缩略图 id、时间戳和缩略图内容或引用。

- 触发：LLM 根据单个截图 id 调用原图读取 tool。
- 预期结果：tool 返回对应全屏原图，供模型在必要时获取高保真视觉上下文。
