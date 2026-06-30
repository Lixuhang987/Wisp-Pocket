# HandAgent

**macOS 原生 Agent Runtime — 一键唤起，随处可用。**

HandAgent 是一个 macOS 桌面 AI Agent 运行时。全局热键唤起 PromptPanel，选中文本或截取屏幕区域作为上下文，提交后由本地 Agent Runtime 驱动工具调用与多轮对话。线程、附件、权限和工作区数据默认保留在本机；模型请求按你的 provider 配置发送，启用 Web 搜索时查询会发送给 Tavily，抓页时会请求目标 URL。

---

## 功能

### 全局唤起

随时随地通过热键呼出 PromptPanel，无需切换窗口。支持文本选区和区域截图作为附件。

### 多轮对话与工具调用

ThreadWindow 展示完整对话流，包括 assistant 回复、工具调用过程与权限审批。支持历史侧栏和后台 thread 管理。

### Skill 与 MCP 扩展

通过本地 manifest 定义 Skill（Append Prompt），通过 MCP 协议接入外部工具。PromptPanel 中选中 Skill 即作为 chip 附加到输入。

### Web 搜索

Agent 默认可调用 `web_search` 与 `fetch_page` 查询公共 Web。`web_search` 使用 Tavily Search API，需要在运行 agent-server 的环境中设置 `TAVILY_API_KEY`；`fetch_page` 只在需要精读单个 URL 时抓取并清洗正文。

### 灵活的模型配置

支持 OpenAI Compatible / Anthropic 等多种 provider，在设置页即可切换模型、配置 API Key，保存后立即生效，无需重启。

---

## 快速开始

```bash
# 安装依赖
pnpm install

# 启动桌面应用
bash ./scripts/swiftw run HandAgentDesktop
```

首次启动后打开 Settings 配置模型 provider 和 API Key，即可开始使用。

---

## 架构概览

| 层 | 职责 |
|---|---|
| **Desktop Shell** (Swift) | macOS 宿主、PromptPanel、Settings、全局热键 |
| **Electron Shell** | ThreadWindow / StatusBubble 容器、agent-server 进程管理 |
| **Thread Window** (React) | 对话 UI、历史管理、权限审批 |
| **Agent Server** (Node) | AgentRuntime 驱动、tool 注册、MCP 注入、thread 持久化 |
| **Core** (TypeScript) | 跨平台 Agent 核心、工具编排、LLM adapter |

---

## 开发

```bash
# TypeScript / Web 测试
bash ./scripts/test.sh

# Swift 测试 & 构建
bash ./scripts/swiftw test
bash ./scripts/swiftw build
```

详细开发文档见 [handAgent.md](handAgent.md) 和 [docs/docs.md](docs/docs.md)。

---

## 许可

Private — 尚未开源。
