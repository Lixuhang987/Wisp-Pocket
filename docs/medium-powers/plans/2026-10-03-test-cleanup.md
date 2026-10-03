# 测试清理计划

用户要求删除低价值测试、合并重复测试。只调整验证方式，不修改产品接口、数据结构或行为；新增测试预算为 0。

## 保留的主要链路

历史选择沿真实 App → 选择状态 / 草稿 → socket resume → snapshot → 消息呈现验证；桌宠交互、Electron 窗口和真实 Thread/Runtime/SQLite 分别保留独有边界，不因名称相似合并。

## 删除与合并依据

| 对象 | 处理及保留验证 |
| --- | --- |
| Swift 文档措辞与源码结构扫描 | 删除；文档由目录约定维护，Settings 裸控件 / 按钮 / 颜色由现有 SwiftLint 检查 |
| Swift 控件枚举自比较与仅初始化 hosting view 的 smoke | 删除；设置代理、真实表单操作与主题值测试保留；真实颜色 / 布局继续实机 QA |
| Electron 空 smoke | 删除；现有窗口、preload、supervisor 用例已实际加载运行环境 |
| 旧 AgentTrigger HTTP 入口返回 404 | 删除已移除功能的否定测试；支持的 Thread / Provider 路径测试保留 |
| 历史选择 helper 的两份 mock 调用断言 | 收敛到现有真实 App 的历史选择用例，核对目标 ID、草稿和可见消息 |
| CSS class 与图标形状断言 | 删除；内容、选中语义和运行指示保留；静态 markup 不证明滚动或视觉 |
| 生成主题文件的重复断言 | 合并到现有生成器测试；产物与源 tokens 一致性断言保留 |
| Workspace 展开偏好加载与 round-trip | 合并到已有 round-trip，保留旧格式加载、当前格式保存和瞬态状态清空 |

## 执行与验证

1. 从主 checkout 创建 worktree，确认 CodeGraph 索引；先运行仓库 TypeScript/Web 与 Swift build 基线，补充 Swift test 基线。
2. 沿测试目录到根架构读取文档，核对每项删除依据；对保留用例添加必要断言，新增测试数保持 0。
3. 运行 `bash ./scripts/test.sh`、`bash ./scripts/swiftw test`、`bash ./scripts/swiftw build`，核对差异、删除引用及测试数量。
4. 同步测试目录文档与 manual QA，完成 TODO 迁移并提交。此任务不实现 Issue #6/#7 或其他产品 spec，无产品实机通过结论。

## 结果

已完成：新增测试 0，删除 11 个测试文件；测试声明由 846 减为 806，测试及辅助代码由 26,195 行减为 25,340 行。计数来自 Git 跟踪的 apps / packages 测试与 Swift 测试辅助文件，参数化测试未展开。

基线及清理后的 TypeScript/Web、Swift test/build 三项检查均通过。检查了删除文件引用与最终差异；没有生产代码变更。日志位于当前 worktree 的 `.cache/test-cleanup/`，完成记录已迁入 manual QA；本任务不触发产品 spec 实现完成后的独立文档审核。
