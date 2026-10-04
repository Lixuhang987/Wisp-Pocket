# Electron 设置视觉优化

基于 `codex/issue-9-frontend-pet`，按用户提供的 Codex 设置截图优化现有 Electron surface。授权范围为导航和视觉交互，不增加后端配置能力。

## 用例与合同

- 打开设置默认进入模型页；分组侧栏直接进入模型、伙伴、工具、MCP、权限和工作区。搜索只筛选设置入口，切页不卸载表单，不提交或清空草稿。
- 伙伴页以卡片展示形象、描述和显示状态，选择卡片只改变预览；编辑、显示隐藏、两级工作区选择继续调用现有 PetManagementBridge，不改变分配规则。桌宠窗口中共享表单继续紧凑模式。
- 模型与 MCP 继续经 settingsRequest 调用原 `/api/settings/*`，显式保存与失败保留不变；WorkspaceCommand、Pet、Workspace、ThreadListEntry 和 revision 合同不变。
- 设置专用中性色记录到 design/tokens.json，由生成器发布，在 settings-app 内映射；不改变其他 surface 的全局视觉。布局支持亮暗主题、键盘焦点与窄窗口。

## 实施与验证

- [x] 读取目录文档，复用干净 worktree，重建 CodeGraph 索引；TypeScript/Web 基线通过。
- [x] 改造 SettingsApp 导航和页面标题、settings.css 控件与布局、PetManager 可选画廊，复用内置图集静态帧。
- [x] 扩展 settings-save.test.tsx 中已有模型保存用例，覆盖搜索导航后的草稿保留；伙伴创建/分配用例覆盖画廊。累计新增测试 0，复用现有三条主流程，不添加样式字符串断言。
- [x] 浏览器检查模型/伙伴/工具、亮暗主题与窄视口；浏览器的模拟 IPC 数据只证明展示与交互，不证明原生窗口。
- [x] test.sh、swiftw test/build；更新 surface、目录约束和 manual-qa，独立无继承上下文的文档审核后提交。

## 验证结果

- `bash ./scripts/test.sh`、`bash ./scripts/swiftw test`、`bash ./scripts/swiftw build` 全部通过；Web 80 条用例通过，累计新增测试 0。
- Ego Browser 使用模拟 HTTP / Pet IPC 数据检查 1280×880 暗色画廊、640×440 亮色模型表单，以及 390×844 亮色伙伴布局；已检查的画廊视口无横向溢出，预览切换和无搜索结果状态正常。
- 浏览器证据保存在 worktree `.cache/settings-ui/`，不代表真实后端或原生 Electron 窗口验收；待验动作迁移到 manual-qa。
- 独立子 agent 无继承上下文完成文档审核，修正旧导航说明、主题例外与共享图集双向引用；manual QA 已更新，未发现阻断性不一致。
