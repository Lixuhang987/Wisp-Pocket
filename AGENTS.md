# AGENTS.md

## 文档约定

- 本仓库中的产品文档、设计文档、计划文档、说明文档默认使用中文编写。
- 如果某些内容必须使用英文，应当有明确理由，例如引用外部协议字段、API 原始名称或行业通用专有名词。
- 新增文档时，优先保证中文表达清晰、边界明确、术语一致。

## 文档索引

仓库文档是一棵 DFS 索引树：每个 `<dir>.md` 只列**直接子节点**，更深层细节由子节点自己继续展开。AI / 新人按 `AGENTS.md → handAgent.md → ...` 一路向下读，需要哪一层就钻到哪一层，不必预先吞下所有路径。

本文件只列根目录的直接入口；所有 `apps/`、`packages/`、`docs/` 下的细节，由各自的 `<dir>.md` 接力展开。

### 根目录入口

- `README.md`：项目简介、当前能力、本地验证命令。
- `CONTEXT-MAP.md`：统一术语入口；按任务定位 Conversation Runtime、Desktop Experience 或 Host Automation glossary。
- `handAgent.md`：跨上下文架构、分层所有权、通道合约与阅读路由。
- `AGENTS.md`：本文件，工作约定 + 文档维护规则。

### 一级子目录（每个目录由其内 `<dir>.md` 接力）

- `apps/apps.md`：应用入口、UI、宿主适配与本地服务索引。
- `packages/packages.md`：跨平台核心与 Thread 持久化索引。
- `examples/examples.md`：可复制到 `~/.spotAgent/` 的 Append Prompt / MCP 配置示例。
- `docs/docs.md`：开发说明、待办、QA、spec / plan 与设计资料入口。
- `codex/`：本地 code agent 的参考项目（权限系统 / tool 系统 / UI 流式展示 / 子 agent 系统等可借鉴）。

## 文档维护约定

- 文档的标准是：修改当前目录下的代码必须了解的前提，不包括上一级文档已经提到过的
- 每级 `<dir>.md` 只索引**直接**子节点；不要把孙节点路径平铺上来，避免上层文档随子树膨胀。
- 新增子目录或子模块时，更新所在目录的 `<dir>.md` 索引；上层文档无需改动。
- 跨模块约定（协议字段、设置文件路径等）必须在双方文档相互引用，避免单边漂移。
- 当代码与文档冲突时，优先以代码为真相并立即修文档；不要在 PR 描述里只写"待补文档"。
- 项目专有术语只在 owning `CONTEXT.md` 定义；架构文档引用规范术语，不复制 glossary。

## 架构事实入口

跨上下文架构、分层职责和通道合约以 [handAgent.md](/Users/mu9/proj/handAgent/handAgent.md) 为准；协议字段以 owning 类型定义为准。本文件只保留协作、文档维护和开发流程约束。

## Agent skills

### Issue tracker

工程 skills 管理的 issue 与 spec 使用 GitHub Issues。详见 `docs/agents/issue-tracker.md`。

### Triage labels

Triage 使用五个默认角色标签。详见 `docs/agents/triage-labels.md`。

### Domain docs

领域文档采用 multi-context 布局，由根目录 `CONTEXT-MAP.md` 路由到相关上下文及 ADR。详见 `docs/agents/domain.md`。

## 开发规范
### Since the project hasn’t gone live yet, there’s no need to consider compatibility.

### 常用命令

- TypeScript / Web 检查（ThreadWindow Web test/build、Electron shell test、agent-server + core vitest）：`bash ./scripts/test.sh`
- Swift 测试与构建（桌面 App）：`bash ./scripts/swiftw test`、`bash ./scripts/swiftw build`
- 运行桌面 App：`bash ./scripts/swiftw run HandAgentDesktop`

### 提交前检查

- `bash ./scripts/test.sh`
- `bash ./scripts/swiftw test`
- `bash ./scripts/swiftw build`

说明：
- Swift 相关命令默认通过 `bash ./scripts/swiftw` 执行。SwiftPM 依赖缓存默认写到主 checkout 的 `.cache/swiftpm/`，可跨 `.worktrees/` 复用；Swift/Clang module cache 默认仍写到当前 worktree 的 `.cache/swift/`。如需跨 worktree 共享 module cache，可设置 `HANDAGENT_SWIFT_MODULE_CACHE_DIR=/path/to/cache`；如需自定义 SwiftPM 依赖缓存，可设置 `HANDAGENT_SWIFTPM_CACHE_DIR=/path/to/cache`。

### Development Workflow

- 将以下流程记录记录到TODO中
- 读取代码，确定任务的范围，涉及的文件。涉及文件所在目录的 `<dir>.md` 必须读取，并沿父目录递归向上直到根目录的 `handAgent.md`，确保理解完整的分层上下文。
- 需要修改代码的任务，必须先在 `.worktrees/<task-name>/` 目录下创建 worktree。统一使用 `bash ./scripts/create-worktree.sh <task-name> [branch-name]`，并且**必须从主 checkout 执行**；**不要直接使用 `EnterWorktree` 工具**，也不要手写 `git worktree add` 跳过初始化。纯文档任务或只读任务不需要 worktree。
- `bash ./scripts/create-worktree.sh` 会在 worktree 内依次执行 `pnpm install`、`codegraph init -i <worktree-absolute-path>`、`codegraph status <worktree-absolute-path>`；成功时仅输出后续 CodeGraph MCP 调用必须使用的 `CodeGraph projectPath: <worktree-absolute-path>`。若 `codegraph status` 仍提示索引来自其他 git working tree，则不得继续开发。
- 在 worktree 内使用 CodeGraph MCP 工具时，必须显式传入脚本输出的绝对路径 `projectPath`，不得依赖默认 projectPath。
- 初始化完成后，先按改动范围跑一次分层基线，确认 worktree 可用，再开始浏览代码。默认先跑 `bash ./scripts/test.sh`；若任务涉及 `apps/desktop/`、`Package.swift`、Swift 脚本、打包脚本或会影响桌面启动链路，再追加 `bash ./scripts/swiftw build`。优先阅读目标目录下同名的架构文档。
- 进行代码修改。
- 验证通过后，更新已有文档。
- 执行 `git commit` 并在 commit message 中总结改动，不要让完成的工作长时间不提交。
- Spec 完成后的文档审核强制流程
当前任务完成了某个 spec 的实现后，必须执行以下流程：
1. 分发一个独立子 agent，使用fork_context: false，任务只做文档审核与文档更新。
2. 子 agent 必须：
    - 阅读该 spec。
    - 阅读所有修改文件所在目录的 `<dir>.md`，并沿父目录读到 `handAgent.md`。
    - 核对 spec、代码、相关 md 是否一致。
    - 更新所有过期 md。
3. 主 agent 必须在结束前确认：
    - 子 agent 已返回审核结论。
    - 所有相关 md 已更新。
    - `docs/manual-qa.md` 已更新或说明无需更新。
4. 若未完成上述流程，不得提交、不得结束任务。
- 最后将完成的改动加入到 manual-qa 中
