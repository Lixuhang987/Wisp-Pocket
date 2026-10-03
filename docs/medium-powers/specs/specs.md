# specs

本目录保存待实现规格、历史需求和非目标；各规格显式标注状态，已落地行为应压缩到 owning 模块文档或 manual QA。

## 直接子节点

- [Issue #8](https://github.com/Lixuhang987/Wisp-Pocket/issues/8)：Electron 设置、后端配置接口与 Workspace/Pet 拆分已实现，完整实机待验；固定项目根、逐 Turn AGENTS.md、基础 Pet 与项目一级历史采用当前 owning 模块合约，MCP 运行刷新另列 TODO。
- [multi-pet-pocket-dialogue/multi-pet-pocket-dialogue.md](./multi-pet-pocket-dialogue/multi-pet-pocket-dialogue.md)：Issue #7 的多桌宠 A「口袋对话」历史规格，轻量交互仍保留；Pet 直接替代 Workspace 与按宠分组的设计已由 Issue #8 替代，当前项目模型不以本子树为准。
- `2026-06-24-agenttrigger-thread-path-migration-spec.md`
- `2026-06-24-chrome-bookmarks-folder-picker-spec.md`
- `2026-06-24-websearch-tool-spec.md`
- `2026-06-25-context-history-plugin-spec.md`：历史 Plugin 方案，已被 Issue #4 替代。
- `2026-06-25-react-dynamic-tools-removal-spec.md`
- `2026-06-25-self-evolving-automation-spec.md`：历史独立 Plugin 与自进化方案，已被 Issue #4 替代。

Context History 与 Automation 的初始内置化规格为 [Issue #4](https://github.com/Lixuhang987/Wisp-Pocket/issues/4)；默认读取与常驻采集由 [ADR 0004](../../adr/0004-context-history-default-tools.md) 更新。其他迁移规格中的 Plugin 保留要求、React Thread 没有 Dynamic Tool 的旧结论也已失效；当前默认能力由服务端采用在线 Provider 声明，读取前先核对各文件的历史状态。
