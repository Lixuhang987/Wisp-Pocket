# 产品上下文：Design OS 与 Stitch Skills 的可用部分和维护边界

核验日期：2026-09-14。两仓 `main` 与前次研究相同：Design OS 为 [`529dedb43bfec24b2cbb128f26dd8cbc6143f754`][D0]，Stitch Skills 为 [`0337446dadde6f8c94210444e2aa9d546126480f`][S0]。通过 GitHub API 阅读官方命令和源码；未安装、运行外部项目，也未上传本地资料到 Stitch。

结论：**这些工具能提供产品文档骨架、视觉规范提取和迭代工件，但不能直接承担“从现有产品建立可信现状，并在每次实现后同步 PRD 与实机截图”的完整职责。** 对既有产品，先建立有证据的当前说明，再引入设计生成更合适；这是本文建议。

## 能力矩阵

| 需要补齐的上下文 | 可借用能力 | 直接使用条件与适配边界 |
| --- | --- | --- |
| 产品总览、用户问题、能力分区 | Design OS `product-vision` 生成 overview、roadmap、data shape。[D1] | 可借结构；官方输入是用户的产品想法，没有从现有代码和实机行为验证能力状态的步骤。 |
| 模块任务、流程、界面要求 | Design OS `shape-section` 生成 spec、示例数据和 UI 类型。[D2] | 可借流程模板；仍是设计需求，不会自动从历次 spec 合成当前产品全貌。 |
| 已有产品的视觉规范 | Stitch `extract-design-md` 从前端源码提取颜色、字体、组件和布局，独立生成 `.stitch/DESIGN.md`。[S1] | Web 部分最接近可直接使用；无需构建或上传。SwiftUI/AppKit 未在其框架规则中覆盖；从样式推断的设计意图仍须标明推断。 |
| 当前 Web 界面的静态材料 | Stitch `extract-static-html` 捕获路由、状态、视口对应的独立 HTML。[S2][S3] | 可用于可运行的 Web 视图；脚本输出 HTML、删除脚本，不同时建立 PNG 图库，也不保存真实业务行为。静态回退通过展平组件构造画面，不能当实机证据。 |
| 把已有页面带入设计工具 | Stitch `code-to-design` 编排 HTML 提取、设计规范提取、上传和创建设计系统。[S4] | 用于确实要在 Stitch 重设计的页面；仅建立本地产品上下文不必走上传链路。 |
| 产品目标、页面清单、待办 | Stitch `site-md` 根据需求或已有站点内容生成 `.stitch/SITE.md`，区分当前/目标页面。[S5] | 可借长期上下文结构；默认面向静态网站，桌面产品需改成窗口、入口和用户任务，补充已验证/未验证状态。 |
| 持续维护进度 | `stitch-loop` 每轮更新 sitemap、roadmap、屏幕元数据和下一轮提示。[S6] | 可借“工作结束前回写上下文”的协议；维护范围是该循环生成的页面，不是任意仓库改动的全产品同步。 |
| 设计截图与交接 | Design OS `screenshot-design` 截设计预览，`export-product` 复制已有 PNG；Stitch 下载生成屏幕的 PNG。[D3][D4][S6] | 都能留设计材料；不能直接证明现有 Wisp Pocket 实机呈现。原生窗口需另行捕获并标明来源。 |

## 现有更新机制到底覆盖什么

- **Design OS 可以持续修改设计资料。** `product-vision`、`shape-section` 要求收到评审反馈后更新相关文件；`product-roadmap` 有明确的已有文件更新分支。它不是只能运行一次。[D1][D2][D5]
- **其事实来源仍是设计工作区。** 官方明确把规划工具与实际产品仓库分开；导出只读取该工作区的规格、组件、数据和截图，然后交给实现 agent 接入业务。[D0][D4]
- **截图默认是预览证据。** `screenshot-design` 访问 `localhost:3000/sections/.../screen-designs/...`，保存到 `product/sections/`；导出复制已有 PNG，不重新捕获实际产品，也不检查截图是否随代码变化而过期。[D3][D4]
- **Stitch 的素材刷新是显式动作。** `stitch-loop` 下载屏幕 HTML/PNG 前会检查本地文件，已有文件时询问复用还是刷新；每次生成屏幕后重新获取项目元数据。PNG 来自 Stitch 的 `screenshot.downloadUrl`。[S6]
- **本地页面的截图验证是可选步骤。** `stitch-loop` 有 Chrome 工具时可截集成页面并与 Stitch 图比较；完成标记和下一轮交接并不以完整业务用例验证为前提。[S6]
- **循环由外部调度。** 官方列举人工、CI、agent 链等触发方式；没有随意一次代码提交就自动重建所有产品资料的约定。待办为空时还允许自行发明下一页，若用于维护既有产品，应改为停止或提交建议。[S6]

上述更新步骤没有定义统一的“代码变更 → 受影响用户流程 → 实机状态捕获 → 当前 PRD 更新”契约，也没有统一记录截图对应的代码版本、数据条件和核验结论。不能把设计工件已落盘等同于产品现状已可信维护。

## 本项目已有材料与本机技能

- [README](../../README.md) 已有定位、场景与规划，[DESIGN](../../DESIGN.md) 已有设计规范；领域和架构文档也存在。缺口是按用户任务组织、与当前构建对应的产品说明和可视基线，不能概括为完全没有产品资料。
- 本次 Git 跟踪的常见媒体只有角色图集与历史 Composer 参考 SVG。局部 QA 截图仍位于 `/tmp` 或旧 worktree 缓存；文件存在不等于当前版本已核验。[manual QA](../manual-qa.md) 和 [归档说明](../archive.md) 均保留这条边界。

| 本机已有技能 | 能承接的部分 | 仍需补充 |
| --- | --- | --- |
| [prototype 的项目上下文指南](/Users/mu9/.agents/skills/prototype/PROJECT-CONTEXT.md) | 先读实际用户路径和宿主，区分现有/提议行为；建立带来源、状态和用途的可复用素材索引。 | 围绕原型复用素材，没有每次产品代码改变后的全局现状维护职责。 |
| [project-live-qa](/Users/mu9/.agents/skills/project-live-qa/SKILL.md) | 用运行中桌面产品、真实操作、截图与系统证据核验，并更新 QA/缺陷记录。 | 不负责汇总产品定位、完整任务地图或持续 PRD。 |
| [product-research](/Users/mu9/.agents/skills/product-research/SKILL.md) | 从外部产品证据推导 PRD，区分事实、推断、待验证；可借用证据标记。 | 核心是竞品研究与项目机会，非本产品当前状态的自动同步。 |
| [docs-hygiene](/Users/mu9/.agents/skills/docs-hygiene/SKILL.md) | 维护当前事实、文档职责、索引与单一来源，按实现更新过期说明。 | 需有明确的产品上下文入口、采集素材与触发规则。 |

现有根级 `DESIGN.md` 和 token 已有权威来源；使用提取工具时应核对和补充，不另建一套冲突的设计系统。

## 建议的补齐方式：增加薄的本地维护流程

以下为适配建议，不是两仓已有技能或 Wisp Pocket 已接入的机制。

1. **建立现状。** AI 读取 README、领域文档、已完成 spec 和实现，先列用户任务与界面清单；运行产品后捕获关键状态。每条能力标明“实机核验”“代码支持但未实测”“仅计划”，冲突和缺证据项显式保留。
2. **形成少量稳定材料。** 一份当前产品说明记录服务对象、核心问题、可完成任务和边界；一份界面/流程地图连接入口、状态与截图；设计规范链接已有 token 来源。产品专有术语继续引用 owning `CONTEXT.md`，不再复制 glossary。
3. **保留证据来源。** 每组截图附代码版本、捕获日期、窗口/路由、状态、尺寸、数据条件和验证结果；标明实机、设计预览或 mock。旧图保留为历史，不继续标作当前。
4. **提出变更。** 新 spec 引用受影响的现状条目和流程，描述预期变化；目标界面另存为设计提案。用户主要确认问题、范围和关键交互，AI 完成资料整理、常规检查与候选方案。
5. **实现后更新现状。** AI 按变更影响重跑相关任务、重拍受影响状态、更新当前说明及图索引；未完成的验证写回 QA。若实际行为偏离已确认需求，记录偏差和缺陷，不把异常自动改写成新的产品承诺。每轮交付带“现状变化、证据、未验证项”，再供人审查关键差异。

优先借用 **Design OS 的文档结构 + `extract-design-md` 的源码提取 + `stitch-loop` 的完成前回写规则**。维护层本身应留在产品仓库，按任务触发；不必先部署独立 Design OS 工作区或把全部产品上传 Stitch。后续若确实需要视觉重设计，再组合设计生成工具。

可新增一个 `product-context` 技能入口（建议，尚未创建），只管理三种动作：首次建立基线、按改动刷新、检查说明与证据是否仍一致。将它接到现有 spec 完成后的文档审核流程；验证不足时标记待核验，而不把计划改写成已实现。

建议的最小资料结构如下，尚未在本项目创建：

```text
docs/product/
  product.md       # 直接子节点索引、阅读入口
  prd.md           # 定位、核心问题、当前能力承诺与范围；未知意图交人确认
  flows.md         # 当前用户任务、入口、关键状态与截图引用
  screens/
    screens.md     # 图片索引、构建/日期/状态/数据条件与核验结果
    *.png          # 受管理的真实界面材料；原型/参考另行标注来源
```

`docs/docs.md` 只增加产品目录入口；`AGENTS.md` 按任务引导 agent 读取。当前需求变更继续使用 GitHub Issues，不迁移或复制既有历史 spec。产品取舍和关键交互变化交人确认，常规说明、引用、证据索引与影响范围内的截图刷新由 AI 执行。

[D0]: https://github.com/buildermethods/design-os/blob/529dedb43bfec24b2cbb128f26dd8cbc6143f754/AGENTS.md
[D1]: https://github.com/buildermethods/design-os/blob/529dedb43bfec24b2cbb128f26dd8cbc6143f754/.claude/commands/design-os/product-vision.md
[D2]: https://github.com/buildermethods/design-os/blob/529dedb43bfec24b2cbb128f26dd8cbc6143f754/.claude/commands/design-os/shape-section.md
[D3]: https://github.com/buildermethods/design-os/blob/529dedb43bfec24b2cbb128f26dd8cbc6143f754/.claude/commands/design-os/screenshot-design.md
[D4]: https://github.com/buildermethods/design-os/blob/529dedb43bfec24b2cbb128f26dd8cbc6143f754/.claude/commands/design-os/export-product.md
[D5]: https://github.com/buildermethods/design-os/blob/529dedb43bfec24b2cbb128f26dd8cbc6143f754/.claude/commands/design-os/product-roadmap.md
[S0]: https://github.com/google-labs-code/stitch-skills/tree/0337446dadde6f8c94210444e2aa9d546126480f
[S1]: https://github.com/google-labs-code/stitch-skills/blob/0337446dadde6f8c94210444e2aa9d546126480f/plugins/stitch-design/skills/extract-design-md/SKILL.md
[S2]: https://github.com/google-labs-code/stitch-skills/blob/0337446dadde6f8c94210444e2aa9d546126480f/plugins/stitch-design/skills/extract-static-html/SKILL.md
[S3]: https://github.com/google-labs-code/stitch-skills/blob/0337446dadde6f8c94210444e2aa9d546126480f/plugins/stitch-design/skills/extract-static-html/scripts/snapshot.ts
[S4]: https://github.com/google-labs-code/stitch-skills/blob/0337446dadde6f8c94210444e2aa9d546126480f/plugins/stitch-design/skills/code-to-design/SKILL.md
[S5]: https://github.com/google-labs-code/stitch-skills/blob/0337446dadde6f8c94210444e2aa9d546126480f/plugins/stitch-utilities/skills/site-md/SKILL.md
[S6]: https://github.com/google-labs-code/stitch-skills/blob/0337446dadde6f8c94210444e2aa9d546126480f/plugins/stitch-utilities/skills/stitch-loop/SKILL.md
