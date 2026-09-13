# specs

本目录保存历史需求和非目标；已落地行为应压缩到 owning 模块文档或 manual QA。

## 直接子节点

- `2026-06-24-agenttrigger-thread-path-migration-spec.md`
- `2026-06-24-chrome-bookmarks-folder-picker-spec.md`
- `2026-06-24-websearch-tool-spec.md`
- `2026-06-25-context-history-plugin-spec.md`：历史 Plugin 方案，已被 Issue #4 替代。
- `2026-06-25-react-dynamic-tools-removal-spec.md`
- `2026-06-25-self-evolving-automation-spec.md`：历史独立 Plugin 与自进化方案，已被 Issue #4 替代。

Context History 与 Automation 的当前规格为 [Issue #4](https://github.com/Lixuhang987/Wisp-Pocket/issues/4)。其他迁移规格中的 Plugin 保留要求、React Thread 没有 Dynamic Tool 的旧结论也已失效；当前默认能力由服务端采用在线 Provider 声明，读取前先核对各文件的历史状态。
