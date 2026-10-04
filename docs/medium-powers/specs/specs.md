# specs

本目录保存待实现规格、历史需求和非目标；各规格显式标注状态，已落地行为应压缩到 owning 模块文档或 manual QA。

## 直接子节点

- [Issue #9](https://github.com/Lixuhang987/Wisp-Pocket/issues/9)：Pet 前端化已实现、完整实机待验；后端移除 Pet、Thread 仅归 Workspace，前端统一分配伙伴，当前边界见 ADR 0007 与 owning 模块。
- [2026-10-04-time-context-draft.md](./2026-10-04-time-context-draft.md)：系统提示与时间注入持久化、小时刷新、本地证据时间及范围过滤的简版规格；已实现、三项检查与独立文档审核完成，实机待验。
- [Issue #8](https://github.com/Lixuhang987/Wisp-Pocket/issues/8)：Electron 设置、后端配置接口与 Workspace/Pet 拆分已实现，完整实机待验；固定项目根、逐 Turn AGENTS.md 与项目一级历史保留；后端 Pet、双归属与基础 Pet 已由 #9 替代，MCP 运行刷新另列 TODO。
- [multi-pet-pocket-dialogue/multi-pet-pocket-dialogue.md](./multi-pet-pocket-dialogue/multi-pet-pocket-dialogue.md)：Issue #7 的多桌宠 A「口袋对话」历史规格，轻量交互仍保留；Pet 直接替代 Workspace 与按宠分组的设计已由 Issue #8 替代，当前项目模型不以本子树为准。
- [2026-06-24-agenttrigger-thread-path-migration-spec.md](./2026-06-24-agenttrigger-thread-path-migration-spec.md)：Swift 直连 Thread 的历史迁移规格；后续默认工具和目标选择另有修订。
- [2026-06-24-chrome-bookmarks-folder-picker-spec.md](./2026-06-24-chrome-bookmarks-folder-picker-spec.md)：文件夹树选择已实现，完整扩展连接与触发实机仍待验。
- [2026-06-24-websearch-tool-spec.md](./2026-06-24-websearch-tool-spec.md)：默认 Web 工具已实现，真实 provider 验收仍待完成。
- [2026-06-25-context-history-plugin-spec.md](./2026-06-25-context-history-plugin-spec.md)：历史 Plugin 方案，已被 Issue #4 替代，采集与默认查询再由 Issue #6 修订。
- [2026-06-25-react-dynamic-tools-removal-spec.md](./2026-06-25-react-dynamic-tools-removal-spec.md)：React 不传工具集合的历史迁移；“React Thread 无动态能力”已失效。
- [2026-06-25-self-evolving-automation-spec.md](./2026-06-25-self-evolving-automation-spec.md)：历史独立 Plugin 与自进化方案，已被 Issue #4 替代，完整自主修复不作为当前交付。

Context History 与 Automation 的初始内置化规格为 [Issue #4](https://github.com/Lixuhang987/Wisp-Pocket/issues/4)；默认读取与常驻采集由 [ADR 0004](../../adr/0004-context-history-default-tools.md) 更新。其他迁移规格中的 Plugin 保留要求、React Thread 没有 Dynamic Tool 的旧结论也已失效；当前默认能力由服务端采用在线 Provider 声明，读取前先核对各文件的历史状态。
