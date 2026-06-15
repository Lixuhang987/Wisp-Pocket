# User Message 渲染与 Slash Skill Composer 设计

## 背景

当前 React ThreadWindow 已经基于统一模型 `UserInput.items` / `InputItem[]` 工作，但 UI 仍停留在“把输入压平成一段文本”的阶段：

- `Composer` 内部虽然维护 `InputItem[]`，但只支持静态 chip 展示，不支持从输入框内通过 slash 命令选择 skill。
- `user` message 渲染仍只有单块文本气泡，不能把 `image`、`skill`、`text_selection` 按结构化内容分层展示。
- ThreadWindow 前端拿不到完整的可用 skill 列表，无法在 React 侧做 `/` 命令补全。

同时，Swift 侧的产品抽象已经收敛：

- 不再使用 `plugin` 作为产品概念。
- `ActionSubmission` 目前只保留 `appendSkill`。
- 这个抽象后续用于“动态 tool 主动注入”，但本次不实现该能力。

本次需求是在不扩展运行时行为的前提下，把 ThreadWindow 的用户消息展示与 Composer 交互补齐到统一 item 模型上，并清理前端相关文档里的过时 plugin 描述。

## 目标

1. `user` message 按 `InputItem[]` 结构渲染，而不是只显示一段拼接文本。
2. `image` 显示在消息顶部缩略图区。
3. `skill` 与 `text_selection` 显示为独立一行 chip，视觉上与 Composer chip 对齐。
4. `text` 显示为独立文本块，与上面的缩略图/chip 分层。
5. Composer 支持开头输入 `/` 时展示全部可用 skill，并支持 `Tab` 选中。
6. 选中的 skill 以左下角 chip 形式加入当前 `InputItem[]`，继续复用统一提交模型。
7. 删除 ThreadWindow / Electron / 相关文档中的 plugin 命名，统一改为 skill / prompt action 语义。

## 非目标

- 不实现动态 tool 主动注入。
- 不改动 `UserInput` / `InputItem` 自身字段结构。注意：本次会让 `user.message.recorded` 与 `ConversationMessage` 额外携带 `items`，把已有的 `InputItem[]` 透传到前端，这只是扩展载荷，不改 `InputItem` 形状。
- 不引入富文本编辑器，不支持在文本中间内嵌 chip。
- 不做 skill 权限、workspace、tool scope 过滤，只展示全部可用 skill。
- 不迁移旧配置目录；本次只更新前端与文档命名，底层本地路径迁移另行处理。

## 用例

### 用例 1：渲染结构化 user message

触发：

- 用户提交包含 image、skill、text_selection、text 的 `UserInput.items`

流程：

1. ThreadWindow 收到或恢复该条 `user` message。
2. UI 从 message 的结构化 item 中提取图片、skill/text_selection、text。
3. 顶部显示图片缩略图。
4. 第二行显示 chip。
5. 底部显示独立文本块。

期望：

- 没有图片时不显示图片区。
- 没有 chip 时不显示 chip 行。
- 没有文本时不显示文本块。
- 各区域彼此独立，不再把所有内容压成一段字符串。

### 用例 2：Composer 中通过 slash 选择 skill

触发：

- 用户在空文本输入框开头输入 `/`

流程：

1. Composer 检测唯一 editable text item 的内容以 `/` 开头。
2. UI 展示可用 skill 列表。
3. 用户继续输入过滤文本。
4. 用户按 `Tab` 选中当前高亮项。
5. Composer 向 `items` 追加一个 `skill` item，并清空当前 slash query。

期望：

- 插入的是结构化 `skill` item，不是文本替换。
- 选中后焦点留在 textarea，用户可继续输入普通文本。
- 左下角 chip 与消息展示的 chip 使用同一视觉语言。

### 用例 3：skill-only 提交

触发：

- 用户通过 slash 选择一个或多个 skill，但不输入 text

期望：

- 允许提交。
- 提交 payload 保持 `UserInput.items` 原样，不额外合成文本。

## 方案对比

### 方案 A：由 Electron preload 注入 skill 列表，React 本地补全

做法：

- Swift / Electron 继续负责读取当前可用 action/skill。
- Electron preload 向 ThreadWindow renderer 暴露只读 skill 列表。
- React Composer 基于这份列表做 `/` 补全。

优点：

- 与现有 theme / initial prompt 注入模式一致。
- 不污染 thread 协议，不需要改 agent-server。
- skill 列表只作为输入辅助，不进入 runtime 数据通路。

缺点：

- 需要扩一层 Electron preload / host config。

### 方案 B：由 agent-server 提供 skill 列表接口

做法：

- 新增 thread 命令或独立接口，由 React 向 server 拉取 skills。

优点：

- 数据来源集中。

缺点：

- skill 列表不是 runtime 真相，放进 server 会扩大协议面。
- 会把桌面端 action/skill 配置的职责打散。

### 方案 C：React 直接读取本地 skill 文件

做法：

- 让 Web 侧直接接触本地配置。

优点：

- 表面上改动少。

缺点：

- 破坏 Electron preload 边界。
- renderer 不应直接获得本地文件系统访问能力。

## 决策

采用方案 A。

理由：

- 这是现有架构里最小且最干净的改法。
- skill 列表本质上是宿主输入辅助数据，不应为了它扩 thread 协议。
- React 已经通过 preload 接收 host 注入配置，继续沿用这条边界最稳妥。

## 设计

### 1. 数据边界

新增一个供 ThreadWindow renderer 读取的只读 skill 描述列表，字段只覆盖 Composer UI 需要的最小集合：

```ts
type AvailableSkill = {
  actionId: string;
  title: string;
  prompt: string;
  description?: string;
};
```

边界要求：

- 宿主侧来源统一使用当前 `ActionDefinition` / `ActionSubmission.appendSkill` 抽象。
- React 不理解“plugin”，也不读取本地 manifest 路径。
- 这份列表只用于 slash 补全，不改变 `op.submit(UserInput)` 协议。

### 1.5 user message 结构化 items 透传协议

现状：用户提交的 `UserInput.items` 在落库和通知两条路径上都会被压平成一段 `text`：

- `composeUserInputContent` 把 `items` 拼成 `AgentMessage.content` 字符串后落库（skill 取 `prompt`、text_selection 包成 `[选区]`、image 写成 stub）。
- `user.message.recorded` 通知只带 `summarizeUserInput(...)` 得到的 `text`。
- `thread.snapshot` 通过 `agentMessagesToConversation` 重建 `ConversationMessage`，同样只产出 `text`。

因此前端 `MessageBubble` 当前永远拿不到结构化 `items`，无法做三段式渲染。本次决策是**由服务端把结构化 `items` 透传到前端**，覆盖实时与重载两条路径。

协议扩展（只增字段，不改 `InputItem` 形状）：

```ts
// user.message.recorded 载荷
payload: {
  messageId: string;
  text: string;          // 保留：摘要/纯文本兜底
  items: InputItem[];    // 新增：原始结构化输入
};

// ConversationMessage（snapshot 重建用）
type ConversationMessage = {
  // ...既有字段
  inputItems?: InputItem[]; // 新增：仅 user role 携带，其余 role 省略
};
```

落库round-trip：

- `UserAgentMessage` 增加可选 `inputItems?: InputItem[]`，与既有 `content`（喂给 LLM 的压平字符串）并存：`content` 仍是 LLM 真相，`inputItems` 仅供 UI 重建。
- `persistUserInput` 在写入 `content` 的同时保存 `inputItems`。
- `agentMessagesToConversation` 对 user role 读取 `inputItems` 填入 `ConversationMessage.inputItems`；缺失时省略，前端退化为只用 `text`。

贯通点（agent-server / core）：

- `packages/core` 协议类型：`UserMessageRecordedNotification.payload`、`ConversationMessage`、`UserAgentMessage`。
- `AgentRunner` / `ThreadRuntimeOrchestrator` 两处 `user.message.recorded` 发出点补 `items`。
- `ThreadPersistence.persistUserInput` 与 `MessageTranslator`（`composeUserInputContent` 不变，`agentMessagesToConversation` 透传 `inputItems`）。

边界要求：

- `content` 字符串语义不变，LLM 输入不受影响。
- 新增字段全部可选，旧数据缺失时前端按 `text` 兜底，不报错。
- 前端 `threadProtocol.ts` 镜像类型同步补 `items` / `inputItems`。

### 2. user message 视图模型

为 `user` message 新增结构化展示模型：

```ts
type UserMessageSections = {
  images: Array<{ id: string; mimeType: string; previewUrl: string }>;
  chips: Array<
    | { id: string; type: "skill"; label: string }
    | { id: string; type: "text_selection"; label: string; fullText: string }
  >;
  text: string | null;
};
```

渲染规则：

- `image`：固定顶部缩略图区，最多按网格展示缩略图。
- `skill`：chip 标签展示 skill title。
- `text_selection`：chip 标签显示截断后的选中文本，hover/title 显示全文。
- `text`：作为底部独立文本块，保留换行。
- 如果 `items` 中存在多个 `text`，按协议前提先归并；UI 不额外引入多文本块语义。

### 3. MessageBubble 调整

`MessageBubble` 对 `user` role 改为三段式：

1. `UserMessageImageStrip`
2. `UserMessageChipRow`
3. `UserMessageTextBlock`

要求：

- 仍保留右对齐气泡，但内部从“单个 `<p>`”改为纵向 stack。
- 图片区和文本区都要能在窄窗口下换行，不能撑破对话列。
- 文本为空时也允许只显示图片和 chip。

### 4. Composer slash 模式

slash 只在“唯一 editable text item 的内容以 `/` 开头”时激活。

状态：

```ts
type SkillCommandState = {
  query: string;
  highlightedIndex: number;
  visibleSkills: AvailableSkill[];
};
```

行为：

- `/`：打开 skill 列表。
- `/rev`：按 `title`、`actionId`、`prompt` 做简单 contains 过滤。
- `ArrowUp` / `ArrowDown`：切换高亮项。
- `Tab`：
  - 有可选 skill 时，选中当前项；
  - 把对应 skill 追加为 `InputItem.type === "skill"`；
  - 把 editable text item 清空；
  - 关闭列表。
- `Escape`：关闭列表，但保留当前文本。
- `Enter`：仍保持当前提交语义；如果 slash 列表打开但用户按 `Enter`，不抢占提交，避免改变现有发送心智。

### 5. Composer chip 区

当前 Composer 已经把非 text item 渲染为输入框内 prefix chips。本次只补两点：

- 当通过 slash 选择 skill 后，chip 出现在输入框左下角区域。
- chip 样式抽出为共享样式，供 user message 的 chip 行复用。

视觉约束：

- skill chip 与 text_selection chip 使用同一基础样式。
- skill 与 text_selection 可用轻量前缀文案或图标区分，但不引入第二套组件。

### 6. 输入与提交契约

提交仍保持：

```ts
type UserInput = {
  items: InputItem[];
};
```

提交前规则：

- 只要存在任一非空 `skill` / `image` / `text_selection` item，就允许提交。
- `text` item 即使为空也保留在数组中，继续沿用当前 Composer 语义。

### 7. 文档与命名清理

涉及前端的描述统一改成：

- `skill`
- `prompt action`
- `ActionSubmission.appendSkill`

删除或改写这些表述：

- “plugin action”
- “plugin prompts”
- “~/.spotAgent/plugins/*/plugin.json 是前端应理解的概念”

说明边界：

- 旧路径仍可能在宿主实现中存在，但不再作为 UI 或文档暴露的产品术语。
- `ActionSubmission` 的保留是为了后续动态 tool 注入扩展，本次不实现注入行为。

## 影响范围

### packages/core 协议与持久化

- `src/protocol/ThreadNotification.ts`：`UserMessageRecordedNotification.payload` 增加 `items: InputItem[]`。
- `src/conversation/ConversationMessage.ts`：`ConversationMessage` 对 user role 增加可选 `inputItems?: InputItem[]`。
- `src/runtime/AgentMessage.ts`：`UserAgentMessage` 增加可选 `inputItems?: InputItem[]`，用于在持久化层与扁平化 `content` 并存地保留结构化 items（`content` 仍是喂给 LLM 的文本，不变）。
- `src/runtime/AgentRunner.ts`：发出 `user.message.recorded` 时带上 `op.payload.items`。
- 相关协议文档（`protocol.md` / `conversation.md`）同步。

### agent-server 消息发出与持久化

- `src/thread/ThreadRuntimeOrchestrator.ts`：`recordUserInput` 发出 `user.message.recorded` 时带上 `items`。
- `src/thread/ThreadPersistence.ts` / `src/protocol/MessageTranslator.ts`：
  - `persistUserInput` 把结构化 `items` 写入 `UserAgentMessage.inputItems`。
  - `agentMessagesToConversation` 把 `inputItems` 透传到 `ConversationMessage.inputItems`，使 `thread.snapshot`（resume）路径与 live 路径一致。
- 相关 use-case 测试需覆盖 live 与 resume 两条路径都带 `items`。

### React ThreadWindow

- `src/components/MessageBubble.tsx`
- `src/components/Composer.tsx`
- 可能新增 user message section / shared chip 组件
- `src/native/nativeConfig.ts`
- `src/App.tsx` 或其他 host config 注入入口
- `src/store/threadWindowStore.ts`：`ThreadMessage` 增加 `userInputItems`；`thread.snapshot` 与 `user.message.recorded` 处理处保存结构化 items。
- `src/protocol/threadProtocol.ts`：镜像 core 协议的 `items` / `inputItems` 字段。
- `tests/composerInputItems.test.ts`
- 新增 message 渲染与 slash skill 交互测试

### Electron shell

- preload 暴露可用 skills
- ThreadWindow host config 类型定义与测试

### Swift desktop

- 提供 skill 列表给 Electron 时，文档和命名收敛到 `skill`
- 保留 `ActionSubmission.appendSkill` 抽象，不扩动态 tool 行为

### 文档

- `apps/thread-window-web/thread-window-web.md`
- `apps/electron-shell/electron-shell.md`
- `apps/desktop/...` 中与前端行为直接相关的描述
- `README.md` / `handAgent.md` 中若存在 plugin 术语，按实际影响同步修正
- `docs/manual-qa.md`

## 错误处理

- 没有任何可用 skill 时，slash 列表显示空状态，不报错。
- preload 未注入 skill 列表时，React 退化为空数组，Composer 仍可正常发送普通文本。
- 结构化 user message 缺失某类 item 时，视图静默跳过对应区块。

## 测试策略

优先覆盖用例级测试：

1. `Composer` 在 `/` 开头时展示全部 skills。
2. `Composer` 输入过滤词后正确过滤。
3. `Tab` 选中 skill 后，生成 `skill` item chip，并清空 slash query。
4. skill-only 输入可以提交。
5. `user` message 对包含 image + skill + text_selection + text 的输入按三区块渲染。
6. 没有图片/没有文本/没有 chip 时，不渲染空占位。

## 开放问题

本次不阻塞实现，但需要明确记录：

1. 宿主内部本地 skill 配置路径是否从历史 `plugins` 目录迁移到新的 `skills` 目录，是独立重构任务，不和本次前端改造绑定。
2. 后续动态 tool 主动注入若落到 `ActionSubmission`，需要单独定义它与当前 `skill` item 的关系，不能在本次 UI 里提前假设。
