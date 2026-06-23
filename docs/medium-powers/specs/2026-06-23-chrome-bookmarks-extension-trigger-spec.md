# Chrome Bookmarks Extension Trigger Spec

## Background
当前 Chrome Bookmarks AgentTrigger 在 Swift 桌面进程内读取 Chrome `Bookmarks` 文件，并通过定时轮询与指纹差异判断收藏夹变化。这种方式不依赖扩展，但它监听的是文件结果，不是 Chrome 官方收藏夹事件。

Chrome 官方收藏夹事件只能由 Chrome 扩展通过 `chrome.bookmarks` API 接收。Codex Chrome browser-use 的本地实现采用 Chrome 扩展加 Native Messaging Host：扩展声明 `nativeMessaging` 权限，使用 `chrome.runtime.connectNative(...)` 连接本机 host，本机通过 Native Messaging Host manifest 限定允许通信的扩展 ID。HandAgent 的 Chrome 收藏夹触发器应采用同类通信模型。

当前 AgentTrigger 实例已经有提示词模板能力，但设置页尚未把实例级提示词作为用户可编辑配置暴露出来。Chrome 收藏夹扩展触发器需要让每个实例拥有自己的提示词，并在新增收藏命中时把书签 URL 等事件信息渲染进该提示词。

## Goal
当用户在 Chrome 中把一个网页收藏到某个已配置的书签文件夹时，HandAgent 自动触发对应的 AgentTrigger 实例，并用该实例的提示词模板和本次新增书签的 URL 创建一个新的后台 session。

Chrome 侧监听由 HandAgent Chrome 扩展完成；Swift 桌面 App 不直接调用 Chrome 收藏夹 API。扩展通过 Native Messaging 把新增收藏事件转发给 HandAgent 本机 host，Swift AgentTrigger provider 只消费来自本机 host 的可信事件，再沿现有 AgentTriggerRuntime 启动链路提交到 agent-server。

每个 Chrome Bookmarks 触发实例至少能配置标题、目标 folder ID 列表和实例级提示词。命中事件必须包含新增书签的 URL、书签标题、父 folder ID、Chrome profile 标识和发生时间；后台 session 的首条用户输入来自实例提示词渲染结果。

## Non-Goals
- 不实现收藏夹树展示、收藏夹搜索、书签跳转或书签管理。
- 不承诺跳转到 Chrome 内置书签管理器里的某个具体节点。
- 不再把辅助功能作为 Chrome 收藏夹事件监听方案。
- 不把文件轮询作为首选触发路径；文件读取最多作为后续故障降级能力另行设计。
- 不要求首版支持非 Chrome 浏览器。
- 不要求首版覆盖未安装或未启用 HandAgent Chrome 扩展的 Chrome profile。

## Use Cases
- Trigger：用户安装并启用 HandAgent Chrome 扩展，HandAgent 注册对应 Native Messaging Host。  
  Expected result/effect：扩展可以连接本机 host，HandAgent 设置页能识别 Chrome Bookmarks 扩展触发器处于可用状态。

- Trigger：用户在 HandAgent 设置页为 Chrome Bookmarks 创建一个触发实例，填写实例标题、目标 folder ID 和提示词模板。  
  Expected result/effect：实例保存后，Swift AgentTrigger runtime 开始等待扩展转发的新增收藏事件；提示词模板作为该实例的运行输入来源。

- Trigger：用户在 Chrome 中把网页收藏到该实例配置的 folder ID 下。  
  Expected result/effect：Chrome 扩展收到 `chrome.bookmarks.onCreated` 事件，确认新增节点是 URL 书签且父 folder ID 命中配置后，把事件通过 Native Messaging 转发给 HandAgent。

- Trigger：HandAgent 收到命中的新增收藏事件。  
  Expected result/effect：Swift provider 生成 AgentTriggerEvent，payload 包含 URL、书签标题、folder ID、profile 标识和事件时间；AgentTriggerRuntime 用实例提示词渲染出首条用户输入，并通过现有 `agent_trigger.fire` 链路新建后台 session。

- Trigger：用户把网页收藏到未配置的 folder，或新增的是文件夹而不是 URL 书签。  
  Expected result/effect：HandAgent 不启动 session，不写入误触发记录。

- Trigger：Chrome 扩展未安装、未启用或 Native Messaging Host 无法连接。  
  Expected result/effect：HandAgent 不进行文件轮询伪装成功；设置页或触发器状态显示连接不可用，避免用户误以为正在监听。
