# 设置按数据使用方划分修改边界

状态：已实现（2026-10-04），完整实机待验。实施规格见 [Issue #8](https://github.com/Lixuhang987/Wisp-Pocket/issues/8)，检查状态见 [实施记录](../medium-powers/plans/2026-10-03-issue-8-settings-workspace.md)，实机步骤见 [manual QA](../manual-qa.md)；MCP 运行刷新仍见 [TODO](../TODO.md)。

新增 Electron 设置不等于把所有配置交给后端：主题、Append Prompt 等原生界面配置仍可由 Swift 直接修改；模型、Tool、MCP、永久 Permission、Workspace 和 Pet 等后端使用的数据，必须由后端提供读写接口。前端不直接修改这些配置文件，已有 JSON 持久化可以保留；Workspace/Pet 沿既有后端管理入口和存储扩展，拆分边界见 [ADR 0006](./0006-workspace-pet-separation.md)。

选择依据是数据的使用与生效归属，而非设置窗口采用的技术。这样后端能校验和保存自己使用的配置，Swift 的原生偏好也无需绕经后端。Append Prompt 指模板定义及其入口配置；展开后提交给后端的输入不改变模板定义的归属。

Swift 外观偏好写独立 `native-preferences.json`，后端模型/Tool 仍写 `settings.json`，MCP 使用 `mcp.json`。后端设置接口串行合并业务配置，保留未展示模型字段；Swift 已移除迁出配置的编辑路径。独立文件消除两端旧镜像覆盖，原子写入仅承担单次落盘完整性。实现边界见 [后端设置](../../apps/agent-server/src/settings/settings.md) 与 [原生偏好](../../apps/desktop/Sources/AppServices/AgentSettings/agent-settings.md)。

本轮 MCP 接入后端配置修改接口，保存成功只表示配置已保存；运行中的连接刷新另列 TODO。未来刷新由后端自行协调，前端不编排刷新，也不将保存成功显示为连接成功。

第一阶段 Append Prompt 保留在 Swift，因此 Electron 的 Agent 分类只迁移 Tools、MCP 与 Permissions，暂不新建 Prompts 页面。本决策不新增全局 Agent 提示词或改变 Pet 角色提示词的既有作用范围。
