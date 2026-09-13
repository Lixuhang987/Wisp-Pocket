# tests

`thread-window-web/tests` 验证 ThreadWindow 的用户流程和跨层边界。

## 直接子节点

- `use-cases/`：initial prompt、历史、Composer 提交与后端 pending 投影、socket 和请求生命周期。
- `boundaries/`：协议 guard、preload 配置和主题边界。
- 目录根测试：组件、布局、滚动、持久化和 design token 的局部回归。

## 约束

- 主流程优先写 use-case test，避免只断言组件内部实现。
- 协议 fixture 从 core DTO 语义出发，不复制另一套消息模型。
- 覆盖 live/snapshot 的图片/PDF Blob 引用、建议回复、输入 pending、`request.resolved` 与同一请求去重；两界面共用 store 合约，不能恢复 renderer 自有执行队列。
- Vitest 同时收集 `.test.ts` 与 `.test.tsx`，避免消息组件用例被遗漏。
- 涉及真实 Electron 窗口、焦点或视口避让的行为保留到 manual QA。
