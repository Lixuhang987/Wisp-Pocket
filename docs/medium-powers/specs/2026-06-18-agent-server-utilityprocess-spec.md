# agent-server 统一守护 Spec

## Background
当前桌面端已经以 Electron main 作为 agent-server 的监督者，但运行时仍保留源码直跑回退。仓库脚本也还没有把 `agent-server` 的构建产物当成统一前置条件。新的约束还需要明确：`utilityProcess` 只是 Electron main 拉起的独立子进程形态，不是把 `agent-server` 内联到 main 线程执行。

## Goal
让 `agent-server` 以独立 build 产物运行，并且只由 Electron main 在 `app.ready` 之后通过 `utilityProcess` 统一拉起、守护和维持后台常驻。运行时必须删除现有 fallback，缺少构建产物时直接报错。仓库 `scripts/` 中与桌面运行链路相关的脚本，也要统一覆盖 `agent-server` 的构建产物检查或构建动作，避免每个脚本重复判断。用于采集 `agent-server` 输出的 stdio 配置也必须保持显式可控，保证日志仍能被 supervisor 接管。

## Non-Goals
不改变 `agent-server` 的业务协议、线程路由、runtime 行为或对外职责。不把 `agent-server` 改造成 Electron main 进程内模块，也不新增新的运行模式。不继续保留源码直跑作为正式路径，不重做桌面 UI 或 Electron/Swift 的交互协议。

## Use Cases
- 启动桌面应用时，Electron main 只会在 `app.ready` 之后基于 `agent-server` 的 build 产物拉起后台服务，并在异常退出后继续守护。
- 关闭 Electron 窗口时，`agent-server` 仍保持后台常驻，不因 UI 关闭而退出。
- 运行仓库脚本时，凡是会触碰桌面运行链路的脚本，都能自动包含 `agent-server` 构建产物的准备或校验。
- 打包或本地验证时，缺少 `agent-server` 产物会给出明确失败原因，而不是静默回退到源码直跑。
- 运行中的 `agent-server` stdout/stderr 会继续被 supervisor 显式接管，用于统一日志输出和排障。
