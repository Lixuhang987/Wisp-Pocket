# evidence

本目录保存本次研究与一次性原型的代表性证据。每份证据只支持其注明的层级，设计解释见 [原型结果](../prototype-results.md)。截图日期为2026-09-14；浏览器中的桌面、活动文件与保存路径均为示例。

## 直接子节点

- [current-shape.png](./current-shape.png)：用户提供的当前形态，920×766 RGBA；从主 checkout 的 `docs/截屏2026-09-14 01.55.10.png` 原样复制，SHA-256 为 `3935fde731cde452cbf1fceede0da177e89b249d1978f6bdfb5ed9033a18a99a`。它不是本次原型或实现后的截图。
- [ui-a.png](./ui-a.png)：A口袋对话，1440×900浏览器视口，三宠完整同屏。
- [ui-b.png](./ui-b.png)：B资料长桌，同一内容和视口。
- [ui-c.png](./ui-c.png)：C对话手册，同一内容和视口。
- [ui-solo.png](./ui-solo.png)：一个位置显示完整角色，名称入口切换其他伙伴。
- [ui-1280.png](./ui-1280.png)：1280×800下的代表性布局复核；不能外推到所有屏幕或系统缩放。
- [ui-journeys.json](./ui-journeys.json)：三种方向的完整模拟交付链，各7项断言及操作前后状态。
- [ui-boundaries.json](./ui-boundaries.json)：额外UI边界操作和断言，含草稿、筛选、角色版本、停止/队列与显示切换。
- [ui-layout.json](./ui-layout.json)：最终页面的视口、角色/面板矩形、滚动与布局复核记录。
- [logic.png](./logic.png)：独立状态模型的实际浏览器页面。
- [logic-checks.json](./logic-checks.json)：五个引导场景的实际操作步骤与结果；仅验证该纯状态模型。
- [native-probe.md](./native-probe.md)：原生实验环境、11项检查、证据限定与清理报告。
- [native-report.json](./native-report.json)：最终原生运行的完整数据，保留原始路径和时间；阅读时使用本目录归档图。
- [native-three-pets.png](./native-three-pets.png)：三张原生窗口 capturePage 的并排排版，非整桌面截图；棋盘底用于显示透明内容。
- [native-expanded-input.png](./native-expanded-input.png)：原生展开窗口与脚本写入中文草稿。
- [native-solo-pet.png](./native-solo-pet.png)：原生单槽第二只宠的窗口画面。

UI页面的模型回复、解析和保存为模拟；实际用户文件没有被读取或写入。浏览器中的拖放来自页面内示例卡片。原生实验使用真实BrowserWindow，但未证明跨应用命中、输入法、多屏、Spaces、VoiceOver、生产持久化或真实工具执行。
