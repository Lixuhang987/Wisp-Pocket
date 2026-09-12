# Issue #3 规格入口

[前后端状态所有权收敛与中间层削减 #3](https://github.com/Lixuhang987/Wisp-Pocket/issues/3) 已按两轮确认的六项约束更新为中文实施规格，标记 `ready-for-agent`；范围、用户故事、实现与验收以该 Issue 为准，尚未实施。

## 阅读与基线

- 术语从 [Context Map](../CONTEXT-MAP.md) 路由；后端继续遵守 [ADR 0001](./adr/0001-backend-state-ownership.md) 的状态所有权与依赖边界。
- 本次评估基于本地 `ad9336d` 中已提交的 Issue #2 实现。执行前确认目标分支包含该实现或等价整合版本，不能仅凭 Issue 状态或远端分支名称判断前提已满足。
- 本地不再维护平行的规格正文；后续修改规格时同步核对 Issue 与相关模块文档。

## 验证状态

- 当前只完成规格发布和文档同步，没有代码实现或新的实机验收项，`manual-qa.md` 无需更新。
- 实施与独立文档审核流程见 [TODO](./TODO.md)；发布规格不代表行为测试或实机验证已经通过。
