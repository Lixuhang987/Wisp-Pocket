# Issue tracker：GitHub

本仓库由工程 skills 管理的 issue 与 spec 发布到 GitHub Issues。所有操作使用 `gh` CLI，并在仓库 checkout 内执行。

## 操作约定

- 创建：`gh issue create --title "..." --body-file -`。多行正文通过标准输入传入。
- 读取：`gh issue view <number> --comments`；需要结构化数据时追加 `--json number,title,body,labels,comments` 和适当的 `--jq`。
- 列出：`gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'`，并按需增加 `--label` 或 `--state`。
- 评论：`gh issue comment <number> --body "..."`
- 添加或移除标签：`gh issue edit <number> --add-label "..."`、`gh issue edit <number> --remove-label "..."`
- 关闭：`gh issue close <number> --comment "..."`

仓库由当前 checkout 的 git remote 决定；在仓库内执行时，`gh` 会自动解析。

## Pull request 是否进入 triage

**PRs as a request surface: no.**

如以后改为 `yes`，外部 PR 使用相同的状态与标签，并通过对应的 `gh pr` 命令操作：

- 读取：`gh pr view <number> --comments`；差异使用 `gh pr diff <number>`。
- 列出外部 PR：`gh pr list --state open --json number,title,body,labels,author,authorAssociation,comments`，只保留 `authorAssociation` 为 `CONTRIBUTOR`、`FIRST_TIME_CONTRIBUTOR` 或 `NONE` 的项目。
- 评论、标签和关闭：使用 `gh pr comment`、`gh pr edit --add-label` / `--remove-label`、`gh pr close`。

GitHub issue 与 PR 共用编号空间。遇到裸编号 `#42` 时，先执行 `gh pr view 42`，失败后再执行 `gh issue view 42`。

## Skill 指令映射

- “publish to the issue tracker”：创建 GitHub issue。
- “fetch the relevant ticket”：执行 `gh issue view <number> --comments`。

## Wayfinding 操作

`wayfinder` 使用一个 map issue 和多个 child issue：

- **Map**：带 `wayfinder:map` 标签的单个 issue，正文保存 Notes、Decisions-so-far 和 Fog。
- **Child ticket**：优先使用 GitHub sub-issue 关联到 map；若仓库未启用 sub-issue，则在 map 正文使用任务列表，并在 child 正文首行写 `Part of #<map>`。类型标签为 `wayfinder:research`、`wayfinder:prototype`、`wayfinder:grilling` 或 `wayfinder:task`。
- **Blocking**：优先使用 GitHub 原生 issue dependency。调用 `POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by`，其中 `issue_id` 是 blocker 的数据库数字 ID，可通过 `gh api repos/<owner>/<repo>/issues/<number> --jq .id` 获取。不可用时，在 child 正文首行使用 `Blocked by: #<n>, #<n>`。
- **Frontier query**：按 map 顺序检查尚未关闭的 child，排除存在未关闭 blocker 或已有 assignee 的项目，首个剩余项目即 frontier。
- **Claim**：`gh issue edit <number> --add-assignee @me`，这是会话的首次写操作。
- **Resolve**：先评论答案，再关闭 child，最后把上下文指针和链接追加到 map 的 Decisions-so-far。
