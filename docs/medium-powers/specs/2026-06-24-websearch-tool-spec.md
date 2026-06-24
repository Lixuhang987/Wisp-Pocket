# Websearch Tool Spec

## Background

Agent 当前未激活 thread 默认只暴露 `use_tools`。这降低了普通聊天中的工具噪音，但也让需要最新外部信息的问题必须先由模型激活完整工具集。Web 搜索属于低风险查询能力，应当像 `use_tools` 一样在默认工具集中直接可用。

## Goal

新增默认暴露的 `web_search` 与 `fetch_page` 工具。`web_search` 使用 Tavily Search API 返回清洗后的结构化搜索结果，并做短期缓存。`fetch_page` 只在模型需要精读某个 URL 时抓取页面、提取正文、截断后返回，避免把整页 HTML 送回模型。

这两个工具默认不经过权限审批，可直接调用。工具返回必须包含 URL，便于最终回答引用来源。

## Non-Goals

- 不自研搜索引擎或爬虫索引。
- 不在首版中批量抓取每个搜索结果全文。
- 不把完整 HTML、导航栏或广告内容原样返回给模型。
- 不把 websearch 纳入桌面 Settings 的 builtin tool 开关。

## Use Cases

- Trigger：模型需要回答近期事件、外部资料、官方文档、价格、发布信息或模型知识不保证准确的事实时调用 `web_search`。
- Expected result/effect：工具向 Tavily 查询，返回 `{ query, results }`，每条结果含 `title / url / snippet / publishedAt? / source?`。
- Trigger：模型需要精读搜索结果中的某个页面时调用 `fetch_page`。
- Expected result/effect：工具抓取 URL，清洗 HTML 后返回 `{ url, title?, content, source, fetchedAt }`，内容被限制在可控长度内。
- Trigger：同一 query 或 URL 在短时间内重复调用。
- Expected result/effect：工具复用内存缓存，避免重复请求外部 API 或页面。
