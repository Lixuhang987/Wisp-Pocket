# Context History Plugin Spec
> 历史方案，已被 [Issue #4](https://github.com/Lixuhang987/Wisp-Pocket/issues/4) 替代。本文保留当时设计用于追溯；Context History 的 Plugin 安装、原子进程、生命周期和 RPC 要求不再是当前约束，也不能作为功能通过实机验证的证据。当前所有权与行为从 [Host Automation](../../../apps/host-automation/host-automation.md) 进入。

> 后续 [Issue #6](https://github.com/Lixuhang987/Wisp-Pocket/issues/6) 又明确常驻采集、删除采集开关与服务端普通历史工具；下文默认关闭、显式启用及动态历史查询也不再是当前要求。

## Background

Wisp Pocket 当前已经有 dynamic tool 机制：Swift desktop 作为默认 provider 连接 `/api/dynamic-tools`，把 `host_macos.*` 能力和 `~/.spotAgent/plugins/<id>/plugin.json` 声明的 plugin tools 合并后暴露给 core。agent-server 只负责保存 tool spec、路由 tool call request、等待 provider response；plugin 生命周期归 Swift desktop 管理。

现有 plugin 形态仍偏被动 tool provider。`alwaysOn` plugin 可以由 Swift desktop 启动并保活，但当前 tool 调用仍通过 stdin/stdout 另起进程执行。Context History 需要走向真正的独立 plugin 进程：plugin 本身是 Swift 可执行进程，通过 plugin RPC 响应 tool 查询，并调用 AX、screenshot、app/window 等原子 plugin 完成采集。

用户需要一个默认关闭、显式启用后持续运行的官方 plugin，用来长期收集最近桌面上下文。它不改变 thread 初始上下文协议：PromptPanel 提交时仍只包含用户主动输入和主动附件；采集到的 app、截图和 AX 信息只有在 LLM 主动调用该 plugin 的 dynamic tools 后才返回。

## Goal

提供一个内置官方 Context History plugin，随 Wisp Pocket 发布，并自动安装或修复到 `~/.spotAgent/plugins`。用户在设置中显式启用后，Swift desktop 启动该 always-on Swift plugin 进程；禁用后停止 plugin，但已保存历史按保留策略继续存在。

Context History 依赖一组必做的原子化 Swift plugin：AX plugin、screenshot plugin 和 app/window plugin。它们分别负责 AX/UI 树快照、截图/缩略图、前台 app/window 信息和必要的权限状态查询。Swift desktop 只负责安装、启停、健康状态和 dynamic tool provider 桥接，不承载 Context History 的采集能力实现。

Context History plugin 负责调度采集、调用原子 plugin、写入 `~/.spotAgent/context-history`、维护保留策略，并实现查询类 dynamic tools。采集内容包括：前台 app / 前台窗口变化记录；当前 app / window 未变化但持续 30 秒时的周期性采样记录；每分钟全屏原图截图和对应缩略图；每次 app / window 变化或 30 秒周期采样时的前台 app AX/UI 树摘要。

Context History plugin 通过分层 dynamic tools 从轻到重暴露历史上下文：先返回 activity index 和采集 id，再按 id 批量读取 app / window / AX 样本，再按时间范围读取缩略图，最后按单个截图 id 读取原图。

AX、screenshot、app/window 原子 plugin 是实现 Context History 的必做依赖，不是后期选做增强。原子 plugin 既可以作为 dynamic tools 暴露给 core，也可以通过 plugin-to-plugin RPC 被 Context History、自进化自动化或第三方 plugin 调用。Swift desktop 中重复的 `host_macos.*` capability 可以在这些原子 plugin 稳定后逐步删除。

## Non-Goals

- 不让采集内容自动进入 thread 初始上下文。
- 不把 Context History 的业务采集循环写进 Swift desktop。
- 不要求 Swift desktop 长期保留 `host_macos.*` 的全部能力实现；这些能力后续可以迁移为原子化 plugin。
- 不要求一次性迁移所有 `host_macos.*` 能力；第一阶段只要求 AX、screenshot、app/window 这些 Context History 依赖的原子 plugin。
- 不让 Context History 直接内置 AX / screenshot / app/window 的 macOS 能力实现；它通过原子 plugin 调用这些能力。
- 不让 AI 自动生成后台采集器、权限策略、磁盘保留策略或截图写入逻辑。
- 不采集全局窗口列表作为默认上下文，避免无关窗口污染当前任务上下文。
- 不在第一版实现日总结；长期保留为后续总结能力预留数据基础。
- 不把 Context History 和自进化自动化合并成一个系统；它们可以共享 plugin 化后的 AX / screenshot / app 原子能力，但产品目标独立。

## Use Cases

- 触发：用户在设置中启用 Context History plugin。
- 预期结果：Swift desktop 启动 AX、screenshot、app/window 原子 plugin 和 always-on Context History Swift plugin 进程；Context History plugin 开始调度采集，按规则写入 `~/.spotAgent/context-history`，并让该 plugin 的 dynamic tools 在新 thread 中可用。

- 触发：前台 app 或前台窗口发生变化，或同一 app / window 连续 30 秒未变化。
- 预期结果：Context History plugin 通过 app/window 与 AX 原子 plugin 读取前台 app、前台窗口和 AX/UI 树摘要，写入一次 activity sample，包含采集 id、时间戳、前台 app 信息、前台窗口信息和 AX/UI 树摘要引用。

- 触发：Context History plugin 的采集循环运行满一分钟。
- 预期结果：Context History plugin 通过 screenshot 原子 plugin 获取全屏原图和缩略图，保存文件并记录截图 id、时间戳、文件路径、尺寸和关联的活动样本。

- 触发：LLM 调用轻量 activity index tool，查询最近一段时间的活动。
- 预期结果：tool 返回 app/window 活动片段和采集 id，不返回完整 AX 树或图片原文。

- 触发：LLM 根据采集 id 调用样本详情 tool。
- 预期结果：tool 批量返回对应 app 信息、窗口信息和 AX/UI 树摘要。

- 触发：LLM 调用缩略图查询 tool。
- 预期结果：tool 返回指定时间范围内的缩略图 id、时间戳和缩略图内容或引用。

- 触发：LLM 根据单个截图 id 调用原图读取 tool。
- 预期结果：tool 返回对应全屏原图，供模型在必要时获取高保真视觉上下文。
