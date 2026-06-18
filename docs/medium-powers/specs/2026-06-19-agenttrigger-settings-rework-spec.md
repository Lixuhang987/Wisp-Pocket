# 触发器设置重构 Spec

## Background

`apps/desktop/Sources/Settings/AgentTriggerSettingsView.swift` 当前形态有三个问题：

- 内置 trigger 不是默认安装。用户进入"触发器"页时，`AgentTriggerStore` 列表为空，必须先点"安装内置 Trigger"才会写入 `~/.spotAgent/agent-triggers/packages/`。
- 当列表为空时，新增表单的"类型" Picker 没有任何 option（`installedPackages` 是空数组），但默认 `selectedPackageId = "chrome-bookmarks"` 已被设置——picker 显示一片空白。
- 用户在这个空白状态下点"保存"，`createInstance` 无法在已安装包里找到 `"chrome-bookmarks"`，落到 `saveErrorMessage = "未找到 AgentTrigger 包"`，看起来像保存功能彻底坏了。

同时整个页面是"已安装包列表 + 实例列表 + 新增表单"平铺一长条；每个实例属于哪个包靠 `packageId` 文本提示，难以浏览。设计上没有"先选触发器、再配置自动化"的分层。

底层数据模型本身是合适的：`AgentTriggerPackageManifest` 描述触发器包，`AgentTriggerInstance[]` 描述用户基于该包创建的自动化（每条独立 `config / promptTemplate / deliveryPolicy / notificationPolicy`）。本次只重构展示层和默认状态，不改 `agent-triggers/` 文件协议、不改 `AgentTriggerRuntime` reload 行为、不改 `agent_trigger.fire` 链路。

## Goal

让"触发器"页变成两级结构：

- 一级页面默认列出所有已安装的触发器包；首次启动也有内置触发器可见，不需要用户手动安装。
- 点击某个触发器包进入二级页面，在二级页面里管理这个触发器下的自动化（增、改、删）。同一个触发器允许多条自动化，每条自动化独立配置触发参数、prompt、通知策略。
- 删除"类型" Picker；二级页面的表单按当前触发器的 `providerKind` 直接渲染对应字段，不再让用户在"哪个包"和"具体参数"之间反复切换。

## Non-Goals

- 不引入新的 trigger provider，也不把现有 `chrome.bookmarks` / `system.clock` 之外的 provider 抽象提前。
- 不改触发器市场/远程下发；本版"已安装"仍只意味着"`~/.spotAgent/agent-triggers/packages/<id>/trigger.json` 存在"。
- 不改 `AgentTriggerRuntime` 触发逻辑、不改 `agent_trigger.fire` 协议、不改后台 thread 落库行为。
- 不引入 instance 启用/禁用 toggle UI、复制实例、批量操作等额外能力（数据模型留有 `enabled` 字段，但 UI 暂不暴露 toggle）。
- 不在文案里使用"实例"（instance）这种内部术语；UI 上一律称"自动化"。但磁盘格式、内部类型名 `AgentTriggerInstance` 不动。

## Use Cases

- 用户首次打开"触发器"设置：直接看到内置的 Chrome Bookmarks 和 System Clock 两个触发器卡片，旁边显示"暂无自动化"。
- 用户点击 Chrome Bookmarks 卡片：进入二级页面，看到该触发器的描述、当前自动化列表（首次为空）、"新增自动化"入口。
- 用户在 Chrome Bookmarks 二级页面点"新增自动化"：表单只问"标题"和"Folders"两项；保存后回到该二级页面，列表里出现这条自动化。
- 用户在 System Clock 二级页面点"新增自动化"：表单只问"标题"、"时间点"、"时区"三项；保存后该自动化生效，触发后台 thread。
- 用户对同一个 System Clock 触发器创建多条自动化（例如"工作日 09:00 总结日报"和"周一 10:00 拉一遍 PR 状态"）：两条独立保存、独立运行。
- 用户在二级页面点某条自动化的"删除"：该自动化从 `instances.json` 移除，runtime 立即重新加载，对应触发停掉。
- 用户在二级页面点"返回"：回到一级触发器列表。
- 用户进入设置后没有任何已安装触发器（理论上只在 `~/.spotAgent/agent-triggers/packages/` 被外部清空时出现）：一级页面显示一个"恢复内置触发器"入口，点后重新写入内置 manifest。
