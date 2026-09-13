# Stitch Skills：核心理念、工作流与验证边界

核验日期：2026-09-13。固定版本：[`0337446dadde6f8c94210444e2aa9d546126480f`](https://github.com/google-labs-code/stitch-skills/tree/0337446dadde6f8c94210444e2aa9d546126480f)。本文用于理解外部设计工作流，不代表 Wisp Pocket 已集成这些能力。

## 核心理念

Stitch Skills 是连接 Google Stitch 与 coding agent 的组合技能库，按设计、构建、辅助工具拆成三个插件。技能通过 `SKILL.md` 编排操作，脚本负责下载、上传或局部验证，示例和参考文件补足实施细节；运行相关链路需要配置 Stitch MCP。[S1]

从工作流可以归纳出它的重点：**把设计意图、页面产物和迭代状态保存成 agent 可再次消费的文件，让视觉设计与代码实现能够往返推进。** 设计既能从文字或图片开始，也能从已有前端逆向提取；生成的界面再交给 React、React Native 等构建技能转换。[S1][S2][S4][S8][S9]

- **统一视觉语言**：`DESIGN.md` 同时记录氛围、颜色数值及功能角色、字体、组件和布局原则；`design-md` 从 Stitch 屏幕分析，`extract-design-md` 从本地源码提取，后者无需运行应用。[S5][S10]
- **按任务组合技能**：`generate-design` 处理文字生成、图片参考、定向编辑和变体；`manage-design-system` 管理 Stitch 项目中的设计系统；代码导入、框架实现、站点循环各有独立入口。[S2][S3][S4][S8][S12]
- **保留可继续工作的上下文**：`.stitch/designs/` 保存页面 HTML 和截图，`metadata.json` 记录项目与屏幕来源；`SITE.md` 保存站点目标与页面进度，`next-prompt.md` 传递下一轮任务。[S8][S12][S13]

## 三条主要流程

### 从想法到设计

1. 明确页面用途、设备与操作模式；根据任务选择文字生成、图片参考、编辑或变体。[S2]
2. 新建设计时读取或创建 `DESIGN.md`，交给 `manage-design-system` 上传并创建、应用项目级设计系统；页面生成提示聚焦内容、布局和结构。[S2][S3]
3. 调用 Stitch 生成或修改屏幕，下载 HTML 与 PNG，保留项目元数据；按反馈继续编辑或比较变体。[S2]
4. 需要实现时转入构建技能；单纯设计迭代也可停留在 Stitch。[S1][S8][S9]

`enhance-prompt` 是辅助步骤：把“做一个设置页”展开成页面结构、明确的 UI 元素和视觉描述；`taste-design` 是可选的特定审美规范来源。[S11][S14]

### 从已有前端到 Stitch

`code-to-design` 的详细链路是：**按路由提取静态 HTML → 从源码提取 `.stitch/DESIGN.md` → 通过 `manage-design-system` 上传并创建设计系统 → 上传路由 HTML**。入口文字虽概括为三个技能，实际步骤还依赖 `manage-design-system`。[S4]

- `extract-static-html` 优先提供 Puppeteer 快照，也提供交互后浏览器捕获；无法运行应用时才使用手工展平组件的静态回退。按页面、状态与视口捕获，产物是单页 HTML。[S6]
- 快照脚本收集 CSSOM、内联样式与可读取的资源，并移除 `<script>`；因此保存的是某一 UI 状态，不能据此认为业务交互和应用运行逻辑已经迁移。[S7]
- `extract-design-md` 分析主题、CSS、组件与框架配置，将原始样式组织为设计意图；输出含 `name`、`colors` YAML 数据的 `DESIGN.md`，供其他技能解析。[S5]
- `upload-to-stitch` 的 Python 脚本直接读取文件、编码并通过 HTTP 调用 `screens:batchCreate`，避免让模型在工具参数里复述大段 base64。它上传 HTML、图片和 Markdown，创建项目设计系统仍是独立步骤。[S3][S15]

### 从 Stitch 到 React / React Native

共同流程为：**逐屏取得 MCP 元数据 → 下载 HTML、PNG 并查看截图 → 提取当前设计的主题 → 拆分组件、逻辑和数据 → 接好导航 → 验证**；已有本地设计时，技能要求明确复用还是刷新。[S8][S9]

| 目标 | 主要产物和规则 |
| --- | --- |
| React | 从 HTML 的 Tailwind 配置更新 `style-guide.json`；生成独立组件、hooks、`mockData.ts` 和 Props 接口，使用主题类并把占位链接接到 React Router。[S8] |
| React Native | 提取 `src/theme.ts`；把 HTML 映射为 `View`、`Text`、`Pressable` 等原生组件及 `StyleSheet`，补 React Navigation、安全区域和无障碍属性。[S9] |

## 多页站点如何持续推进

`stitch-loop` 每轮读取 `.stitch/next-prompt.md`、`SITE.md`、`DESIGN.md`，生成一页并下载，集成到 `site/public/`，接好导航，更新 sitemap 与下一轮提示。浏览器视觉核验是可选环节；持续调度由人工、CI 或 agent 链提供，并非技能文件自行运行后台循环。[S12]

`SITE.md` 的独立创建技能 `site-md` 已存在于该版本源码，但 README 的技能表没有列出。它负责站点目标、技术环境、sitemap 和 roadmap；`next-prompt.md` 是轮次之间的任务交接文件。[S1][S12][S13]

## 说明要求与实际保证的区别

- **提示词规则存在差异**：`generate-design` 要求新生成时由项目级设计系统提供主题，避免提示词重复主题 tokens；`enhance-prompt`、`stitch-loop` 仍要求在提示里加入设计系统块。因此应按实际入口阅读指令，不能把全部技能描述成完全一致的强制流水线。[S2][S11][S12]
- **“自动验证”只覆盖一部分规则**：React 验证脚本解析 TSX，检查是否有名字以 `Props` 结尾的接口，以及直接字符串 `className` 中的十六进制颜色；未检查 `readonly`、组件拆分、hooks、数据隔离、导航或视觉效果。React Native 脚本进一步检查导出的 Props、颜色字符串和一组 HTML 标签。源码范围比技能宣称“所有违规均导致验证失败”更窄。[S8][S9][S16][S17]
- **质量检查不是默认全部运行**：React / React Native 文档将验证脚本、开发服务器与浏览器或模拟器检查列为需先确认的可选步骤，同时又要求结束前确认代码可编译；这些是工作要求，不能当作已有验证证据。[S8][S9]
- **本次仅做说明与源码核验**：未安装插件、运行项目脚本或调用外部 Stitch；本文未验证生成质量、运行兼容性与端到端可用性。

[S1]: https://github.com/google-labs-code/stitch-skills/blob/0337446dadde6f8c94210444e2aa9d546126480f/README.md
[S2]: https://github.com/google-labs-code/stitch-skills/blob/0337446dadde6f8c94210444e2aa9d546126480f/plugins/stitch-design/skills/generate-design/SKILL.md
[S3]: https://github.com/google-labs-code/stitch-skills/blob/0337446dadde6f8c94210444e2aa9d546126480f/plugins/stitch-design/skills/manage-design-system/SKILL.md
[S4]: https://github.com/google-labs-code/stitch-skills/blob/0337446dadde6f8c94210444e2aa9d546126480f/plugins/stitch-design/skills/code-to-design/SKILL.md
[S5]: https://github.com/google-labs-code/stitch-skills/blob/0337446dadde6f8c94210444e2aa9d546126480f/plugins/stitch-design/skills/extract-design-md/SKILL.md
[S6]: https://github.com/google-labs-code/stitch-skills/blob/0337446dadde6f8c94210444e2aa9d546126480f/plugins/stitch-design/skills/extract-static-html/SKILL.md
[S7]: https://github.com/google-labs-code/stitch-skills/blob/0337446dadde6f8c94210444e2aa9d546126480f/plugins/stitch-design/skills/extract-static-html/scripts/snapshot.ts
[S8]: https://github.com/google-labs-code/stitch-skills/blob/0337446dadde6f8c94210444e2aa9d546126480f/plugins/stitch-build/skills/react-components/SKILL.md
[S9]: https://github.com/google-labs-code/stitch-skills/blob/0337446dadde6f8c94210444e2aa9d546126480f/plugins/stitch-build/skills/react-native/SKILL.md
[S10]: https://github.com/google-labs-code/stitch-skills/blob/0337446dadde6f8c94210444e2aa9d546126480f/plugins/stitch-utilities/skills/design-md/SKILL.md
[S11]: https://github.com/google-labs-code/stitch-skills/blob/0337446dadde6f8c94210444e2aa9d546126480f/plugins/stitch-utilities/skills/enhance-prompt/SKILL.md
[S12]: https://github.com/google-labs-code/stitch-skills/blob/0337446dadde6f8c94210444e2aa9d546126480f/plugins/stitch-utilities/skills/stitch-loop/SKILL.md
[S13]: https://github.com/google-labs-code/stitch-skills/blob/0337446dadde6f8c94210444e2aa9d546126480f/plugins/stitch-utilities/skills/site-md/SKILL.md
[S14]: https://github.com/google-labs-code/stitch-skills/blob/0337446dadde6f8c94210444e2aa9d546126480f/plugins/stitch-utilities/skills/taste-design/SKILL.md
[S15]: https://github.com/google-labs-code/stitch-skills/blob/0337446dadde6f8c94210444e2aa9d546126480f/plugins/stitch-design/skills/upload-to-stitch/scripts/upload_to_stitch.py
[S16]: https://github.com/google-labs-code/stitch-skills/blob/0337446dadde6f8c94210444e2aa9d546126480f/plugins/stitch-build/skills/react-components/scripts/validate.js
[S17]: https://github.com/google-labs-code/stitch-skills/blob/0337446dadde6f8c94210444e2aa9d546126480f/plugins/stitch-build/skills/react-native/scripts/validate.js
