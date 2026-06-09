# AGENTS.md

面向 AI agent（Codex、Claude 等）的工程约定。先读 [`README.md`](./README.md) 了解
项目定位与架构，本文件记录**协作规范与已踩过的坑**。

## 铁律

1. **绝不引入 Word COM / Office 自动化。** 本项目的全部价值在于纯 OOXML、跨平台、
   可并发。任何"调 Word 来读/写文档"的方案都违背产品根基。
2. docx 的本质是 `zip + XML`——读用 `fflate` 解包 + `fast-xml-parser` 解析。
3. 包管理用 **pnpm**（workspace monorepo）；运行 TS 用 `tsx`，免编译。
4. 用编辑器文件工具读写，不要用 shell `echo`/`sed` 改文件。
5. 源码与文档为 UTF-8（无 BOM）；TS/JS 里中文可正常使用（Node 默认 UTF-8）。
   注意：这与隔壁 `docs/` 的 PowerShell 项目相反，那边脚本必须纯 ASCII。

## OOXML 解析要点（决定检测准确率）

### 1. 格式是多层继承，必须解析"有效格式"

```
直接格式(run/段落) → 段落样式 → basedOn 基样式链 → docDefaults
```

只看段落的直接属性会严重漏报。继承合并在 `packages/parser/src/resolve.ts`，
新增可校验属性时，要同时确保它沿这条链正确 resolve。

### 2. 单位换算（`packages/parser/src/units.ts`）

- twip = 1/20 pt = 1/1440 inch；1 cm ≈ 567 twips
- 字号 `w:sz/@w:val` 是 half-point，pt = val / 2
- 行距 `w:spacing`：`lineRule=auto` 时 `@w:line / 240` = 倍数；
  `exact`/`atLeast` 时 `@w:line / 20` = pt
- 缩进 `*Chars` 属性单位是 1/100 字符；`firstLine`/`left` 是 twips

### 3. 主题字体解析（已实现，`packages/parser/src/theme.ts`）

run 用 `w:asciiTheme`/`w:eastAsiaTheme` 等主题引用而非显式字体名时，解析
`word/theme/theme1.xml` 的 `fontScheme` 回填实际字体：`major*` → 标题字体组，
其余 → 正文字体组；含 `EastAsia` 取东亚字体（`a:ea` 为空时回退 `script="Hans"`），
否则取 `a:latin`。`parseRunProps(rPr, theme)` 在解析时即回填。

校验降噪：纯中文段落不报西文字体、纯西文段落不报中文字体
（`validator/src/validate.ts` 按 `hasCJK`/`hasLatin` 判断）。

### 4. 读取外部规则库 JSON 要剥 BOM

`docs/` 的 PowerShell 用 `Set-Content -Encoding UTF8` 写出的 JSON **带 BOM**，
`JSON.parse` 会报 `Unexpected token '﻿'`。读取时 `.replace(/^﻿/, "")`。

### 5. fast-xml-parser 配置约定

保留命名空间前缀（`w:`、`w14:` 并存），属性前缀 `@_`，关闭属性/标签值类型推断
（字体名等须保持字符串）。`w:p`/`w:r`/`w:style` 等强制为数组，避免"单个 vs 多个"分支。
文本节点在 `#text`（带 `xml:space` 时 `w:t` 是对象而非字符串）。

## 校验规则约定（与规则库对应）

- 角色识别（`validator/src/classify.ts`）是**按文档顺序的状态机**：标题关键词 >
  大纲级别 > 样式名 > 当前章节。识别不出的段落返回 null，不参与校验。
- 对齐归一：OOXML `both`/`distribute` → `justify`，`start`/`end` → `left`/`right`。
- 严重级别：字体/字号 = error；加粗/对齐/行距/缩进 = warn。

## 下一步（按价值/风险排序）

1. 补全检测维度：页边距、分节页码、页眉、段前段后距。
2. 行距"缺失"提示（段落未显式设行距时也给出提示）。
3. `apps/web`：上传 + `docx-preview` 预览 + 问题高亮定位（已有，待提升定位精度）。
4. 多模板支持（规则库参数化）。
5. （远期、高风险）自动套版改写——务必无损保留分节/域/题注/交叉引用。
