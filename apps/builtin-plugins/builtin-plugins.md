# builtin-plugins

`apps/builtin-plugins` 实现 [Host Automation](/Users/mu9/proj/handAgent/apps/builtin-plugins/CONTEXT.md) 的官方 Plugin。Swift Host 安装 manifest、管理进程，并把 enabled Plugin 的能力注册为 Dynamic Tool。

## 直接子节点

- [CONTEXT.md](/Users/mu9/proj/handAgent/apps/builtin-plugins/CONTEXT.md)：Host Automation glossary。
- `Sources/Support/`：Plugin RPC、Context History 与 Automation 的共享核心。
- `Sources/AtomicAppWindow/`：App/window 原子能力。
- `Sources/AtomicScreenshot/`：ScreenCaptureKit 截图与缩略图能力。
- `Sources/AtomicAX/`：AX snapshot 与 action 能力。
- `Sources/ContextHistory/`：Context History 查询入口。
- `Sources/Automation/`：Automation 录制、Policy、执行、历史与修复入口。
- `Tests/`：共享核心与各 Plugin 行为测试。

## 边界

- Plugin 只通过 line-delimited JSON RPC 与 Swift Host 通信，不连接 `/api/thread`。
- 原子 Plugin 默认 enabled；Context History 与 Automation 默认 disabled，启用后才注册相应 Dynamic Tool。
- Context History 数据归 `~/.spotAgent/context-history`；Automation Policy、Trace、Run 和 Repair 数据归 `~/.spotAgent/automation`。
- Context History 或 Automation 需要宿主状态时，通过 enabled Atomic Capability 获取，不复制底层实现。
- Automation Policy 是受限、可版本化的执行规则；当前 runtime 不自行驱动 LLM 或 computer use。失败时只产生 Repair Request，修复完成后再合入 Repair Patch。
