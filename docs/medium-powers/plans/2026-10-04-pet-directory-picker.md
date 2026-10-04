# 设置伙伴按钮直接选择目录

## 用户用例与范围

设置页的伙伴卡片点击“选择工作区”或隐藏伙伴的“显示”，立即进入原生文件夹选择器，不展开内嵌工作区 / 话题选择区域。取消不创建项目、不安排或显示伙伴。选择目录后由后端创建或复用实际目录对应 Workspace，再安排该伙伴并显示；选择原工作区保留当前 Thread，换项目准备新话题（threadId=null），不自动打开最近历史，不停止旧任务。

已有“隐藏”、资料编辑 / 保存、卡片预览不变；历史仍从工作区页打开。桌宠内紧凑伙伴管理与右键工作区 / 历史选择继续保留现有两级流程。本次明确覆盖此前设置视觉计划与 #9 的设置内嵌选择要求，不改变后端所有权和分配规则。

## 现有流程与接口

`SettingsApp` 传入最小 `chooseWorkspace(): Promise<Workspace|null>` 回调给共享 `PetManager`。回调调用既有 `handAgentSettings.chooseDirectory()`，取消返回 null；确认后沿 SettingsApp 的 `WorkspaceCommand` 发 `workspace.create {rootPath}`，等待匹配 commandId 的 `workspace.created` 回执取得 Workspace。只有成功回执后，PetManager 才调用既有 `assignPet {petId,workspaceId,threadId}`。Workspace 类型 / 协议与 preload 桥不变。

整个操作沿现有 busy / error 锁执行，等待目录、创建回执与安排期间禁用重复动作；目录选择、创建或安排失败显示原因并允许按钮重试，不先修改伙伴。create 可复用后端目录身份，不能用前端字符串匹配代替实际目录规范化。目录注册与前端分配不属于同一事务：安排失败不改变伙伴，但已注册的工作区不回滚，重试复用它。

## 测试选择与预算

- 保留 `settings-save.test.tsx` 已有 hidden partner 创建、两级选择取消与失败重试用例，改为验证仍受支持的紧凑列表模式。
- 新增 1 条真实 SettingsApp 用例，隔离文件 picker / IPC 和 WebSocket 这两处系统边界：测试原生选择取消、workspace.create 回执后安排、换目录新话题、“显示”同目录保留 Thread，以及失败可重试。确认 busy 和最终命令 / 分配结果，不以 CSS class 或删掉旧区域的负断言作为主测试。
- 累计新增测试 1/4；模型、MCP 和桌宠现有用例复用。真实原生文件框另验，不以 JSDOM 断言替代。

## 执行与验证

- [x] 复用已初始化 worktree，完成 scripts/test.sh 基线，读取相关目录文档链。
- [x] 先调整 / 新增上述集成用例并观察“点击未调用目录 picker”的预期失败，再实施最小回调与点击逻辑；4 条设置用例通过。
- [x] scripts/test.sh、swiftw test/build 与 Electron 完整 build 通过；更新 owning 事实和 manual QA，完成 TODO 迁出。
- [x] 独立无继承上下文文档审核核对计划、实现与目录父链，修正 PRODUCT、surface、ADR 和旧 QA 描述，为 #9 / 视觉计划标明本次覆盖范围；manual QA 保留 fixture 与正式宿主待验边界。
- [ ] 主 agent 确认独立审核返回与文档更新后提交。

## 原生验证边界

真实 Electron 隔离验证已确认两个按钮直接进入系统文件框，取消保持隐藏未分配，确认后卡片项目和显示状态更新；preload 与 IPC 使用生产构建，目录选择使用原生 dialog，后端与分配结果使用 fixture。正式宿主持久化与真实宠窗仍见 [manual QA](../../manual-qa.md)。
