# 领域文档

本仓库采用 multi-context 布局。根目录 [CONTEXT-MAP.md](/Users/mu9/proj/handAgent/CONTEXT-MAP.md) 是唯一上下文路由入口。

## 探索前读取

1. 读取 `CONTEXT-MAP.md`，定位任务涉及的上下文与关系。
2. 读取相关 `CONTEXT.md`，使用其中的规范术语和 Avoid 列表。
3. 读取 `docs/adr/` 中相关系统级 ADR，以及上下文目录 `docs/adr/` 中的局部 ADR。

文件尚不存在时直接继续；`domain-modeling` 只在术语或不可轻易逆转的决策真正形成时按需创建。

## 当前布局

```text
/
├── CONTEXT-MAP.md
├── apps/
│   ├── desktop/CONTEXT.md
│   └── builtin-plugins/CONTEXT.md
├── packages/
│   └── core/CONTEXT.md
└── docs/adr/                  # 有系统级决策时再创建
```

## 消费规则

- 一个术语只在 owning context 定义；其他文档链接术语表，不复制定义。
- Issue、方案、测试和文档使用 glossary 的规范词，避免重新引入被排除的同义词。
- `CONTEXT.md` 只定义项目专有概念，不写类名、文件路径、协议字段或实现步骤。
- 输出与 ADR 冲突时明确指出 ADR 编号和重新讨论的理由，不静默覆盖。
