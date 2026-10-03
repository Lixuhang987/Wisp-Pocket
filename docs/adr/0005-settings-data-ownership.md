# 设置按数据使用方划分修改边界

状态：已确认的目标设计，尚未实现。实施规格见 [Issue #8](https://github.com/Lixuhang987/Wisp-Pocket/issues/8)，迁移及 MCP 后续刷新待办见 [TODO](../TODO.md)。

新增 Electron 设置不等于把所有配置交给后端：主题、Append Prompt 等原生界面配置仍可由 Swift 直接修改；模型、Tool、MCP、永久 Permission 和 Pet 等后端使用的数据，必须由后端提供读写接口。前端不直接修改这些配置文件，已有 JSON 持久化可以保留；Pet 沿用既有后端管理接口与存储。

选择依据是数据的使用与生效归属，而非设置窗口采用的技术。这样后端能校验和保存自己使用的配置，Swift 的原生偏好也无需绕经后端。Append Prompt 指模板定义及其入口配置；展开后提交给后端的输入不改变模板定义的归属。

落地时需消除 Swift 与后端各持旧镜像、重写同一份文件的路径。原生偏好与后端配置应形成独立写入边界，不能仅靠原子写文件防止跨字段丢更新；Swift 不再承担迁出的后端配置写入。

本轮 MCP 接入后端配置修改接口，保存成功只表示配置已保存；运行中的连接刷新另列 TODO。未来刷新由后端自行协调，前端不编排刷新，也不将保存成功显示为连接成功。

第一阶段 Append Prompt 保留在 Swift，因此 Electron 的 Agent 分类只迁移 Tools、MCP 与 Permissions，暂不新建 Prompts 页面。本决策不新增全局 Agent 提示词或改变 Pet 角色提示词的既有作用范围。
