# 领域文档

本仓库采用 multi-context 领域文档布局。工程 skills 探索代码前，按本文件读取领域术语和架构决策。

## 读取顺序

1. 若根目录存在 `CONTEXT-MAP.md`，读取它并定位当前任务涉及的上下文。
2. 读取相关上下文目录中的 `CONTEXT.md`。
3. 读取 `docs/adr/` 中影响当前任务的系统级 ADR。
4. 读取相关上下文目录 `docs/adr/` 中的局部 ADR。

这些文件尚未创建时直接继续，不要把缺失本身报告为问题，也不要预先创建空文档。`domain-modeling` skill 会在术语或决策真正形成时按需创建。

## 布局

```text
/
├── CONTEXT-MAP.md
├── docs/
│   └── adr/                         # 系统级决策
├── apps/
│   └── <app>/
│       ├── CONTEXT.md
│       └── docs/adr/                # 应用上下文决策
└── packages/
    └── <package>/
        ├── CONTEXT.md
        └── docs/adr/                # 包上下文决策
```

`CONTEXT-MAP.md` 是上下文路由入口，只索引实际存在的上下文文档。并非每个 app 或 package 都必须预先创建 `CONTEXT.md`。

## 使用领域词汇

Issue 标题、重构方案、假设和测试名称涉及领域概念时，使用相关 `CONTEXT.md` 定义的术语，避免改用其明确排除的同义词。

需要的概念尚未进入 glossary 时，先判断是否误用了项目语言；若确有领域缺口，记录给 `domain-modeling`。

## 标明 ADR 冲突

输出与现有 ADR 冲突时必须明确指出，不得静默覆盖。例如：

> 与 ADR-0007 的既有决策冲突；建议重新讨论，因为……
