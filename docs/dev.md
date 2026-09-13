# 开发说明

本文只记录本地启动、排障和打包边界。架构所有权从 [handAgent.md](/Users/mu9/proj/handAgent/handAgent.md) 进入，统一术语从 [CONTEXT-MAP.md](/Users/mu9/proj/handAgent/CONTEXT-MAP.md) 进入。

## 首次启动

1. 安装依赖：`pnpm install`。
2. 运行 Wisp Pocket Swift Host：`bash ./scripts/swiftw run HandAgentDesktop`（Swift 内部 executable target 名称暂保留）。
3. 在 Settings 配置模型 provider、model、API key 和可选 base URL。

`swiftw run` 会按需安装依赖、生成主题 token，并构建 ThreadWindow 与 Electron UI Shell。成功路径保持安静，失败时回放对应子命令输出。

## 模型设置

- 设置文件是 `~/.spotAgent/settings.json`，优先通过 Settings 修改。
- provider 支持 `openai-compatible` 与 `anthropic`；OpenAI-compatible API 支持 `responses`、`chat`、`completion`。
- agent-server 按文件戳热加载模型与 Tool 设置；正常修改无需重启。
- 图片输入要求支持多模态的 API；`completion` 路径不支持图片。
- `web_search` 需要 agent-server 环境中的 `TAVILY_API_KEY`；`fetch_page` 会请求目标公共 URL。
- 桌宠拖入的 PDF 先保存副本并在本地提取文字，再交给模型；扫描版、加密或损坏文档会说明读取障碍，不承诺 OCR。

## 验证入口

| 改动范围 | 命令 |
| --- | --- |
| TypeScript、React、Electron、agent-server、core | `bash ./scripts/test.sh` |
| Swift 行为 | `bash ./scripts/swiftw test` |
| Swift 构建或桌面启动链路 | `bash ./scripts/swiftw build` |
| 本地打包 QA | `bash ./scripts/package-app.sh --mock-llm` |

`swiftw` 默认复用主 checkout 的 SwiftPM 依赖缓存，并为每个 worktree 隔离 Swift/Clang module cache。只有明确需要时才设置 `HANDAGENT_SWIFTPM_CACHE_DIR` 或 `HANDAGENT_SWIFT_MODULE_CACHE_DIR`。

## 排障顺序

- 无法启动：先检查完整 Xcode、`xcode-select` 和 Electron/ThreadWindow build 输出。
- 无法提交：区分 agent-server health、hidden ThreadWindow prepared 与模型 API key；不要把连接失败归因于 provider。
- provider 地址错误：检查 `baseUrl` 和 `api` 是否匹配服务端协议。
- 图片失败：确认模型 API 支持多模态，并区分 Blob 落盘、STUB 展开和 provider 拒绝。
- 窗口或热键：检查辅助功能权限，再观察 PromptPanel、ThreadWindow 和桌宠的实际所有者。桌宠位置与隔离 QA 配置见 [Electron main](../apps/electron-shell/src/main/main.md)。
- 平台 Tool：先跑对应 core/Swift 测试，真实屏幕录制、AX 和焦点行为进入 manual QA。

## 打包边界

- `package-app.sh` 会构建 React、Electron 和 Swift release，并签名 app bundle。
- 默认 ad-hoc 签名使用稳定 designated requirement，减少重建后 TCC 身份漂移。
- 正式签名通过 `HANDAGENT_PACKAGE_CODESIGN_IDENTITY` 配置；bundle id 或 requirement 变化时同步设置 `HANDAGENT_PACKAGE_CODESIGN_REQUIREMENT`。
- TypeScript 产物不会被运行中 desktop 自动热替换；修改后重新构建并重启。

## 代码边界

- 用户主动输入才可进入初始上下文；宿主状态通过 Tool 按需读取。
- core 不依赖产品 UI 或 macOS；平台能力通过 Dynamic Tool Provider 接入。
- Tool 名称使用稳定点号形式，输入、输出、Permission 和错误语义必须明确。
- 视觉常量只修改 `design/tokens.json`，再运行 `pnpm generate:theme-tokens`；桌宠结构与角色图集边界见 [DESIGN.md](../DESIGN.md)。
