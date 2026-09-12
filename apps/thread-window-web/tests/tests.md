# tests

`thread-window-web/tests` 验证 ThreadWindow 的用户流程和跨层边界。

## 直接子节点

- `use-cases/`：通过真实 store、输入控制器与 socket 验证 initial prompt、历史、Composer 队列、FIFO 与请求面板生命周期。
- `boundaries/`：协议 guard、preload 配置和主题边界。
- 目录根测试：组件、布局、滚动、持久化和 design token 的局部回归。

## 约束

- 主流程优先写 use-case test，避免只断言组件内部实现。
- 协议 fixture 从 core DTO 语义出发，不复制另一套消息模型。
- 涉及真实 Electron 窗口、焦点或视口避让的行为保留到 manual QA。
- 首轮创建验证状态/UI 回调先于 resume 与首轮提交；Composer 同时观察可见投影、实际发送顺序和跨 Thread 隔离，不测试内部集合或文件布局。
- 偏好 round-trip 只证明展开集合保存；草稿的切换、提交和页面重建行为保留人工 QA，不能用静态组件渲染代替实机验收。
