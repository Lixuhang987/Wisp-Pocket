# Use-Case Driven Test Consolidation Spec

## Background

HandAgent 的开发流程已经转向 use-case 驱动，但仓库里仍保留大量按实现细节拆开的 TDD 单测。当前测试分布覆盖 `packages/core`、`packages/thread-store`、`apps/agent-server`、`apps/electron-shell` 和 `apps/thread-window-web`。其中一部分测试已经接近真实路径，例如 runtime、MCP、SQLite thread 生命周期、agent-server socket handler 和 ThreadWindow 初始 prompt 流；另一部分测试主要锁定内部 helper、fake 状态机或局部纯函数，维护成本高，且会阻碍后续重构。

## Goal

将测试体系收敛为按模块真实用例驱动的集成测试。收敛顺序按依赖链从底到顶推进：先处理 `packages/core` 与 `packages/thread-store`，再处理 `apps/agent-server`，然后处理 `apps/electron-shell`，最后处理 `apps/thread-window-web`。

每个阶段都应删除大部分低价值实现细节单测，保留少量能保护核心合约的边界单测，并用更接近产品入口的集成测试覆盖真实用户路径、跨模块协作和关键副作用。

## Non-Goals

本次不新增产品能力。

本次不以重构产品代码为目标；只有测试收敛确实需要稳定测试入口或复用现有测试 harness 时，才允许做小范围支撑性调整。

本次不追求删除全部单测。协议 guard、数据持久化边界、外部 SDK adapter、权限与安全策略等高风险边界可以保留单测。

本次不改变对外协议语义、桌面启动链路、运行时行为或用户可见 UI。

## Use Cases

- Trigger: 开发者修改 `packages/core` 的 runtime、tool、permission/workspace、LLM adapter 或 MCP 相关代码。
  Expected result/effect: 测试从真实 runtime 或 adapter 入口验证消息流、tool 调用、权限决策、MCP 协议和 LLM 配置行为，而不是只验证内部 helper。

- Trigger: 开发者修改 `packages/thread-store` 的 thread 创建、恢复、追加、持久化、删除或历史派生逻辑。
  Expected result/effect: 测试使用真实 SQLite 临时库验证 thread 生命周期和派生视图，确保 agent-server 和 ThreadWindow 依赖的持久化结果仍正确。

- Trigger: 开发者修改 `apps/agent-server` 的 thread socket、activity socket、platform bridge、AgentManager、runtime orchestration 或 persistence 相关代码。
  Expected result/effect: 测试从 `/api/thread`、`/api/activity`、`/api/platform` 或最接近的 socket handler 入口验证 `ThreadCommand`、`ClientResponse`、runtime 事件、notification、activity 状态和持久化副作用，而不是分别锁死 router、publisher、broker 等内部类实现。

- Trigger: 开发者修改 `apps/electron-shell` 的 supervisor、Swift command bridge、ThreadWindow prewarm、initial prompt/history/focus 或 ActivityWindow 行为。
  Expected result/effect: 测试从 Electron main 层用例验证 agent-server ready 后预热、命令 ack、窗口展示、主题同步、ActivityWindow 点击回跳和 shutdown 行为，只保留会影响桌面启动链路的关键边界测试。

- Trigger: 开发者修改 `apps/thread-window-web` 的初始 prompt、历史加载、composer、permission/workspace 请求、状态 store、协议 guard 或 ThreadWindow UI。
  Expected result/effect: 测试以用户流为中心验证初始 prompt 建 thread 并提交、打开历史 thread、running 时 composer 排队、停止、请求面板响应、历史分组和 host 配置/主题注入。局部纯函数和组件细节测试只在能保护重要协议或布局约束时保留。
