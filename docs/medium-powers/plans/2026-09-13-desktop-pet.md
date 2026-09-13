# Issue #1 桌宠实施记录

规格以 [Wisp Pocket #1](https://github.com/Lixuhang987/Wisp-Pocket/issues/1) 为准；当前实现合约已收敛到 owning 模块文档，本记录只保留实施状态与待验证边界。

## 已完成范围

- 从 main `a919901` 创建 `.worktrees/issue-1-pet-main-20260913`，分支 `codex/issue-1-pet-main-20260913`；仓库脚本完成依赖与 CodeGraph 初始化，修改前 TypeScript/Web、Swift build 基线通过。
- 桌宠通过现有 Thread 连接接收四类拖入、展示历史与普通回复；最终松手区域决定创建或追加，按 Thread 创建时间选择展示。
- 图片/PDF 先保存 Blob 副本，网页与 PDF 读取实际正文，图片进入多模态模型路径。读取阶段限制执行工具，建议通过普通用户消息继续。
- core Thread 接收时持久化输入，独占执行队列；`user.ask` 完成 Turn 后持续等普通消息；Permission/Workspace 保持类型回执并同步两端解决状态。
- 原生窗口负责位置恢复、屏幕限制与透明命中；renderer 负责显隐、悬停/焦点、受限历史和回复。已移除旧 Activity renderer 与桌宠打开完整窗口的废弃窄桥。
- 桌宠沿共享设计 token；主题生成器同时输出普通 CSS 变量。空附件仍保存并报告读取障碍，Thread 级与连接级保存错误均有可见反馈。
- 删除成功广播两种界面；桌宠在线及重连后均按仍存在的历史选择最新 Thread，不继续展示已删除的当前项。

## 当前事实入口

- 桌宠 UI、图集和窗口路由：[Electron UI Shell](../../../apps/electron-shell/electron-shell.md)。
- 输入读取与协议适配：[agent-server](../../../apps/agent-server/agent-server.md)。
- 持久队列、运行阶段与请求：[core](../../../packages/core/core.md)；SQLite 恢复：[thread-store](../../../packages/thread-store/thread-store.md)。

## 流程与验收

- [x] 读取改动目录及父级架构，初始化独立 worktree 并确认分层基线。
- [x] 实现完整用户用例、持久化与原生窗口边界测试。
- [x] 主任务执行 TypeScript/Web、Swift test/build、Electron build 与 mock 打包检查。
- [x] 独立无上下文文档审核；同步 owning 文档、术语、TODO 与 manual QA。
- [ ] 主任务完成独立代码审查反馈、最终回归和提交。
- [ ] macOS 实机验收；逐项状态以 [manual-qa.md](../../manual-qa.md) 为准，自动测试不代表实机通过。

记忆系统、桌宠内切换 Thread 与工具可视化继续留在 [TODO](../../TODO.md)，不属于本次实现。
