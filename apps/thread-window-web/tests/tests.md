# tests

`thread-window-web/tests` 验证 ThreadWindow 的用户流程和跨层边界。

## 直接子节点

- `use-cases/`：通过真实 App、store、输入控制器与 socket 验证选择、首轮、历史、Composer 立即提交、后端 pending 投影、传输 FIFO 和请求生命周期；设置用例从可见控件验证显式保存、失败保留草稿和后端隐含模型字段保存边界；连接列表用例包含自动分页合并与第 51 条打开。
- `boundaries/`：协议 guard、preload 配置和主题边界。
- 目录根测试：结构化输入、消息正文 / 建议 / 附件呈现与运行占位、工具独立展示、项目一级历史分组 / 运行指示及展开偏好的持久化。

## 约束

- 主流程优先写 use-case test，避免只断言组件内部实现。
- Thread 选择回归用 JSDOM 挂载真实 App，仅隔离 WebSocket、布局和 preload 边界；观察正文、结构化草稿、选中行和实际提交目标。后台广播、本窗口创建与原生目标打开必须分别验证，store 单测不能证明 App 本地选择行为。
- 协议 fixture 从 core DTO 语义出发，不复制另一套消息模型。
- 覆盖 live/snapshot 的图片 Blob 与原路径文件引用、建议回复、输入 pending、`request.resolved` 与同一请求去重；两界面共用 store 合约，不能恢复 renderer 自有执行队列。
- Vitest 同时收集 `.test.ts` 与 `.test.tsx`，避免消息组件用例被遗漏。
- 涉及真实 Electron 窗口、焦点或视口避让的行为保留到 manual QA。
- 首轮创建验证状态/UI 回调先于 resume 与首轮提交；Composer 同时观察忙碌/等待回复时的实际发送、服务端确认后的 pending 投影与跨 Thread 隔离，不测试内部集合或文件布局。
- 原生目标打开须覆盖 React 安装前的请求、resume 的传输缓冲及 receiver 清理；[Electron 测试](../../electron-shell/tests/tests.md) 负责 command 的目标交付、preload 缓冲与回执，双方合起来仍不证明 macOS 焦点。
- 偏好 round-trip 只证明展开集合保存；JSDOM 交互覆盖选择、草稿切换与提交，页面重建和原生窗口行为仍需人工 QA，静态组件渲染不代替实机验收。

历史选择的目标、草稿与消息由真实 App 用例验证，不重复测试 helper 的 mock 调用。主题生成与文件同步由根 `scripts/generate-theme-tokens.test.mjs` 负责；滚动、样式和图标的视觉结果以实机 QA 为准，不以 class 或源码字符串代替。
