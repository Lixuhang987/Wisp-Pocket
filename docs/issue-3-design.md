# Issue #3 实施记录与当前边界

[前后端状态所有权收敛与中间层削减 #3](https://github.com/Lixuhang987/Wisp-Pocket/issues/3) 是原结构重构规格。事实投影、输入交接与偏好职责拆分已保留；合入 main 时，输入排队以已经落地的 [Issue #1](https://github.com/Lixuhang987/Wisp-Pocket/issues/1) 为准，后端拥有持久队列，前端立即提交。

## 阅读与基线

- 术语从 [Context Map](../CONTEXT-MAP.md) 路由；后端继续遵守 [ADR 0001](./adr/0001-backend-state-ownership.md) 的所有权与依赖边界。
- 原实现从 `main` 的 `a919901` 创建，包含 `ad9336d` 的 Issue #2 实现。本地不复制 Issue 规格正文；原实施与本次合并通过 [计划目录](./medium-powers/plans/plans.md) 定位。

## 当前所有权

- 两种 React 界面各自创建 store 和输入控制器；正式历史、Turn、待处理输入及待答请求归 core。UI 保存事实投影、首轮关联、草稿和窗口偏好，职责见 [Web store](../apps/thread-window-web/src/store/store.md)。
- 首轮 payload 只登记一次；创建通知先更新 store/UI，再 resume 和 submit。Composer 在忙碌或等待普通回复时都立即发送，pending 从后端通知投影，执行队列不回到 renderer。
- socket FIFO 只处理传输尚未就绪，不承担执行排队。ThreadWindow 与桌宠维持各自的连接恢复和选择规则，见 [Web thread](../apps/thread-window-web/src/thread/thread.md)。

## 后端保留理由

- Router/Publisher 承担连接订阅、定向 snapshot/list/error 回复、删除成功广播与回答资格检查；下沉到 Registry 会把连接身份引入 core。
- Persistence 承担 Input Item 与 Blob 转换、运行增量、残缺 Turn 恢复和 SQLite 顺序句柄；底层 ThreadStore 不能直接替代这些语义。
- Registry/Thread 已拥有唯一加载、删除、关闭入口，以及历史、输入、Turn、请求生命周期。Issue #3 原实现没有找到值得扩大职责边界的后端精简项，后端保持当时基线；后续 Issue #1 扩展的持久输入与请求恢复沿这些边界落地。

## 验证边界

- 原 Issue #3 的 Web/server/core、真实 SQLite、Swift test/build 与独立文档审核均通过；当时的 Swift 测试只校正 PromptPanel 隐藏与窗口回执的观察阶段，没有改变宿主生产行为。
- 本次合并的自动检查与双功能边界见 [manual-qa](./manual-qa.md) 和合并计划；原分支通过不等于合并产物经过新的桌面实机验收。
- 草稿、偏好、首轮、流式展示、请求与连接仍需实机回归；旧的前端队列派发/移除验收已由后端 pending 验收替代。
- ThreadWindow 收到后台 `thread.started` 会切换选中项的既有问题仍见 [bugs](./bugs.md)；它与桌宠按创建时间主动选择最新 Thread 的产品规则不同。
