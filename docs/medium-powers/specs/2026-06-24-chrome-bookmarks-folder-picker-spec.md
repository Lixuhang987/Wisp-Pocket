# Chrome Bookmarks 文件夹选择 Spec

## Background

Chrome Bookmarks trigger 目前需要用户在 App 设置页手动输入文件夹标识。实际触发时，扩展上报的是 Chrome 内部文件夹 ID，App 也按这个 ID 做匹配；用户输入文件夹显示名时不会命中目标文件夹。

用户不应该理解或填写 Chrome 内部 ID。文件夹选择应当在 App 设置页完成，用户只看到书签文件夹名称、层级和内部数量。

## Goal

在 App 的 Chrome Bookmarks trigger 实例配置界面中展示 Chrome 收藏夹文件夹树。用户通过勾选文件夹配置监听范围，不再手动输入文件夹名称或 ID。

App 保存配置时仍使用内部文件夹 ID。后续用户收藏网页到已勾选文件夹时，现有 trigger 根据扩展事件中的文件夹 ID 命中实例并触发 Agent。

## Non-Goals

- 不向用户展示任何文件夹 ID。
- 不在 App 中提供收藏夹新增、删除、重命名或移动能力。
- 不实时同步收藏夹树变化；用户进入相关设置界面时拉取一次当前快照即可。
- 不改变“扩展广播收藏事件，App 负责筛选和触发 Agent”的职责边界。
- 不要求用户打开 Chrome 扩展配置页完成 trigger 设置。

## Use Cases

- Trigger：用户打开 App 设置页中的 Chrome Bookmarks trigger 实例。
- Expected result/effect：App 拉取当前 Chrome 收藏夹文件夹树，在设置页展示可勾选的层级结构。

- Trigger：用户查看收藏夹文件夹树。
- Expected result/effect：每个文件夹只展示名称和内部数量，例如 `a (2)`；文件夹 ID 不出现在界面中。

- Trigger：存在多个同名文件夹。
- Expected result/effect：App 通过树形层级让用户区分位置，例如“其他书签”下的 `a (2)` 与“书签栏”下的 `a (1)`；界面仍不展示 ID。

- Trigger：用户勾选一个或多个文件夹并保存 trigger 实例。
- Expected result/effect：App 保存对应内部文件夹 ID，设置页用文件夹名称和数量回显用户选择。

- Trigger：用户之后把网页收藏到已监听文件夹。
- Expected result/effect：扩展广播新增收藏事件，App 根据内部文件夹 ID 命中 trigger 实例，并使用该实例的 prompt 触发 Agent。
