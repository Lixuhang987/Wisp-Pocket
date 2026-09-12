# agent

## 目录职责

Thread owner 已下沉到 core；`agent/` 不再拥有生产代码或运行状态。历史 Agent mailbox、manager 和 request broker 已删除，生产路由直接调用 core `ThreadRegistry` / `Thread`。

本目录不定义跨进程 DTO。协议类型位于 `@handagent/core/protocol/types/`，由 `protocol/` 与 core Thread 使用。

## 现状

本目录当前无生产文件。Thread 生命周期、输入队列、Turn、交互请求、工具激活和关闭均由 `packages/core/src/thread/` 持有；agent-server 只负责组合依赖、协议翻译和连接适配。

相关入口：

- [core Thread](/Users/mu9/proj/handAgent/packages/core/src/thread/thread.md)
- [agent-server Thread 路由](/Users/mu9/proj/handAgent/apps/agent-server/src/thread/thread.md)
