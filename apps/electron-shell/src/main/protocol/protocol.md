# protocol

`protocol/` 定义 Swift <-> Electron command bridge 的 TypeScript 端协议。它是 Electron main 接收 Swift command 的唯一运行时校验层。

## 文件

| 文件 | 职责 |
|------|------|
| `electronShellProtocol.ts` | `SwiftToElectronCommand`、`ElectronToSwiftEvent`、`parseCommand()`、`encodeEvent()` 和基于 `zod` 的 command / event 运行时 schema |

## Command 边界

- 所有 Swift -> Electron command 必须是 `channel: "electron_shell"`，且必须带 string `commandId`。
- 当前 command 只有 `thread_window.open_initial_prompt`、`thread_window.open_history`、`thread_window.focus`、`settings.open`、`activity_window.show`、`pet.show`、`pet.hide`、`theme.changed`、`shutdown`。
- `thread_window.prepare` 不存在；hidden ThreadWindow 预热由 Electron main 在 agent-server ready 后主动执行。
- `thread_window.open_initial_prompt.payload` 接受 `clientRequestId`、`userInput` 与可选 `petId`；缺省身份的既有 fallback 等待后端唯一默认宠，实际 `thread.start` 必须携带身份。`userInput.items` 必须非空，item 类型只允许 `text`、`image`、`skill`、`text_selection`；image MIME 限定 `image/png`、`image/jpeg`、`image/webp`。
- `thread_window.focus.threadId` 是既有可选 `string | null` 字段：非空 ID 表示向 renderer 明确交付目标 Thread，再打开或聚焦窗口；缺失、null 或空字符串仅执行窗口级 focus/openHistory。Swift 提交入口见 [ElectronShell 合约](../../../../desktop/Sources/AppServices/ElectronShell/electron-shell.md)，交付时序见 [windows](../windows/windows.md)。

## Event 边界

- Electron -> Swift event 只通过 `encodeEvent()` 输出 JSON line；字段名必须与 Swift `ElectronShellEvent` decoder 对齐。
- `thread_window.prepared` 和 `thread_window.prepare_failed` 是事件，不是 command ack。
- `command.ack` 只确认某个 Swift command 是否执行。目标 Thread 的交付失败或窗口在交付时被替换须回 `ok: false`；成功只证明 renderer 接收或缓冲目标并完成 show/focus，不代表 Thread 已加载、React 已渲染或 `/api/thread` 状态变化。
- 桌宠交互走 renderer 的 Thread 连接与原生窗口 IPC；Swift 仍通过全局热键、选区/截图入口或显式失败处理打开 PromptPanel。

## 修改约束

- 新增、删除或改名 command/event 时，必须同步更新 Swift [ElectronShellProtocol.swift](/Users/mu9/proj/handAgent/apps/desktop/Sources/AppServices/ElectronShell/ElectronShellProtocol.swift) 和双方测试。
- 不在本目录复制 core DTO。Initial prompt 的 `UserInput` 类型从 `@handagent/core/protocol/*` 引用。
- `parseCommand()` 需要通过 schema 拒绝未知命令和缺失 payload 的命令，尤其要持续覆盖拒绝 `thread_window.prepare` 的测试。

- `settings.open` 没有 page payload，独立设置首次/重开默认 AI，重复命令只聚焦并保留草稿；ACK 表示窗口加载并聚焦，不表示后端配置读取或保存成功。Swift 对应接口见 [ElectronShell](../../../../desktop/Sources/AppServices/ElectronShell/electron-shell.md)。
