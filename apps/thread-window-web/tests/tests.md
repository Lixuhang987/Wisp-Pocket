# tests

`thread-window-web/tests` 验证 ThreadWindow 的用户流程和跨层边界。

## 直接子节点

- `use-cases/`：initial prompt、历史、Composer 队列、socket 与请求生命周期。
- `boundaries/`：协议 guard、preload 配置和主题边界。
- 目录根测试：组件、布局、滚动、持久化和 design token 的局部回归。

## 约束

- 主流程优先写 use-case test，避免只断言组件内部实现。
- 协议 fixture 从 core DTO 语义出发，不复制另一套消息模型。
- 涉及真实 Electron 窗口、焦点或视口避让的行为保留到 manual QA。
