# 开发说明

本文只记录本地启动、排障和打包边界。架构所有权从 [handAgent.md](/Users/mu9/proj/handAgent/handAgent.md) 进入，统一术语从 [CONTEXT-MAP.md](/Users/mu9/proj/handAgent/CONTEXT-MAP.md) 进入。

## 首次启动

1. 安装依赖：`pnpm install`。
2. 运行 Wisp Pocket Swift Host：`bash ./scripts/swiftw run HandAgentDesktop`（Swift 内部 executable target 名称暂保留）。
3. 从 menu bar 的“设置”打开 Electron 窗口，在 AI 显式保存模型 provider、model、API Key 和可选 Base URL；原生宿主设置仍从 PromptPanel 进入。

`swiftw run` 会按需安装依赖、生成主题 token，并构建 ThreadWindow 与 Electron UI Shell。成功路径保持安静，失败时回放对应子命令输出。

## 模型设置

- 后端模型/Tool 文件是 `~/.spotAgent/settings.json`，Electron 设置通过 `/api/settings/*` 修改。Swift 外观独立写 `~/.spotAgent/native-preferences.json`，不镜像后端配置；MCP 配置写 `mcp.json`，保存后重启 App 加载，尚无运行刷新。
- provider 支持 `openai-compatible` 与 `anthropic`；OpenAI-compatible API 支持 `responses`、`chat`、`completion`。
- agent-server 按文件戳热加载模型与 Tool 设置；正常修改无需重启。
- 图片输入要求支持多模态的 API；`completion` 路径不支持图片。
- `web_search` 需要 agent-server 环境中的 `TAVILY_API_KEY`；`fetch_page` 会请求目标公共 URL。
- 桌宠拖入的 PDF 只交付原路径引用，由模型按需调用 file.read 读取当时内容，不保存原文件副本；扫描版、加密或损坏文档会说明读取障碍，不承诺 OCR。

## 验证入口

| 改动范围 | 命令 |
| --- | --- |
| TypeScript、React、Electron、agent-server、core | `bash ./scripts/test.sh` |
| Swift 行为 | `bash ./scripts/swiftw test` |
| Swift 构建或桌面启动链路 | `bash ./scripts/swiftw build` |
| 本地打包 QA | `bash ./scripts/package-app.sh --mock-llm` |

`swiftw` 默认复用主 checkout 的 SwiftPM 依赖缓存，并为每个 worktree 隔离 Swift/Clang module cache。只有明确需要时才设置 `HANDAGENT_SWIFTPM_CACHE_DIR` 或 `HANDAGENT_SWIFT_MODULE_CACHE_DIR`。

### Swift 测试隔离

完整 Swift suite 仍有使用默认 AgentTrigger factory 的装配用例。与实机 App 并行运行时，在临时 home 执行测试，避免覆盖运行中 App 的 Chrome bridge 发现文件；先确认 Foundation 实际解析出的 home 与临时目录一致：

```sh
qa_home="$(mktemp -d /tmp/handagent-swift-home.XXXXXX)"
env CFFIXED_USER_HOME="$qa_home" HOME="$qa_home" bash ./scripts/swiftw -e 'import Foundation; print(FileManager.default.homeDirectoryForCurrentUser.path)'
env CFFIXED_USER_HOME="$qa_home" HOME="$qa_home" bash ./scripts/swiftw test
```

这只是测试进程的隔离入口；新增用例仍应按 [AppServices 测试边界](../apps/desktop/TestsSwift/AppServices/app-services.md) 显式注入 Store 与 runtime。`HANDAGENT_HOST_DATA_HOME` 的范围见下文，它不覆盖 AgentTrigger。

## 排障顺序

- 无法启动：先检查完整 Xcode、`xcode-select` 和 Electron/ThreadWindow build 输出。
- 无法提交：区分 agent-server health、所选 Workspace 与模型 API key；ThreadWindow prepared 不影响独立任务提交；不要把连接失败归因于 provider。
- provider 地址错误：检查 `baseUrl` 和 `api` 是否匹配服务端协议。
- 图片失败：确认模型 API 支持多模态，并区分 Blob 落盘、STUB 展开和 provider 拒绝。
- 窗口或热键：检查辅助功能权限，再观察 PromptPanel、ThreadWindow 和桌宠的实际所有者。桌宠位置与隔离 QA 配置见 [Electron main](../apps/electron-shell/src/main/main.md)。
- 平台 Tool：先跑对应 core/Swift 测试，真实屏幕录制、AX 和焦点行为进入 manual QA。

## 内置功能实机数据

- 正常入口为 PromptPanel → 原生 Settings → Host；Context History 常驻、Automation 默认关闭，其单独启用开关保存到 `~/.spotAgent/builtin-features.json`。两者业务数据分别保存在同级 `context-history/`、`automation/`，详见 [Host Automation](../apps/host-automation/host-automation.md)。
- 启动 Swift Host 时设置 `HANDAGENT_HOST_DATA_HOME=/绝对路径/qa-home`，只将上述配置和两个业务目录放在该路径的 `.spotAgent/` 下。它不改变模型设置、Thread 数据库、AgentTrigger、Append Prompt 或其他设置的 home。
- 记录实际启动的 bundle、版本、进程与 TCC 权限，验收动作见 [人工说明入口](./human/human.md)。新构建测试与旧实例隔离，不能从工作区路径推断运行的二进制来源。

## 打包边界

- `package-app.sh` 会构建 React、Electron 和 Swift release，并签名 app bundle。
- 当前产物包含 Electron main，但不包含 Electron runtime。在已安装依赖的 checkout 内打开包时，Swift 从 workspace 启动 Electron 并使用包内 main；因此仍要求 `pnpm` 可用。无法定位 checkout 且使用默认包内 main 时仍依赖全局 `electron`，不属于自包含发行包。binary/main 覆盖与查找顺序由 [Swift ElectronShell 桥](../apps/desktop/Sources/AppServices/ElectronShell/electron-shell.md) 定义。
- Swift 可执行产物是 `HandAgentDesktop` 和 Chrome Native Messaging helper；`HandAgentHostAutomation` 为主程序链接的内部 target，不产生独立 Context History、Automation 或原子 Plugin 可执行程序。
- 默认 ad-hoc 签名使用稳定 designated requirement，减少重建后 TCC 身份漂移。
- 正式签名通过 `HANDAGENT_PACKAGE_CODESIGN_IDENTITY` 配置；bundle id 或 requirement 变化时同步设置 `HANDAGENT_PACKAGE_CODESIGN_REQUIREMENT`。
- TypeScript 产物不会被运行中 desktop 自动热替换；修改后重新构建并重启。

## 代码边界

- 初始任务资料由用户主动提交；system 规则与时间基准按 [Runtime 合约](../packages/core/src/runtime/runtime.md) 持久化注入。屏幕、剪贴板、文件与应用状态通过 Tool 按需读取。
- core 不依赖产品 UI 或 macOS；平台能力通过 Dynamic Tool Provider 接入。
- Tool 名称使用稳定点号形式，输入、输出、Permission 和错误语义必须明确。
- 视觉常量只修改 `design/tokens.json`，再运行 `pnpm generate:theme-tokens`；桌宠结构与角色图集边界见 [DESIGN.md](../DESIGN.md)。
