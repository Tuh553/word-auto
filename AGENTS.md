# AGENTS.md

面向 AI agent（Codex、Claude 等）的工程约定。新对话先读
[`PROGRESS.md`](./PROGRESS.md) 了解当前进度，再读 [`README.md`](./README.md)
了解产品定位与架构。本文件记录**协作规范、实现事实与已踩过的坑**。

## 铁律

1. **绝不引入 Word COM / Office 自动化。** 本项目的价值在于纯 OOXML、跨平台、
   可并发。规则库历史 metadata 里可以保留 `extracted_by: "Word COM"` 这类来源说明，
   但新代码、脚本、测试和运行链路都不能调用 Word / WPS / Office 自动化。
2. docx 的本质是 `zip + XML`：读用 `fflate` 解包 + `fast-xml-parser` 解析。
3. 包管理用 **pnpm**（workspace monorepo）；运行 TS 用 `tsx`，免编译。
4. Web 是纯前端本地检测：文件不上传服务器；规则库草稿/模板 MVP 存在浏览器
   `localStorage`。
5. 源码与文档为 UTF-8（无 BOM）；TS/JS 里中文可正常使用（Node 默认 UTF-8）。
6. 技术栈以 `package.json` 为准。当前 Web 实际是 React `18.3.1` + Vite 6；
   文档或徽章若写成 React 19，要先核对依赖再沿用。

## 项目边界

- `packages/parser`：`.docx` -> `DocModel`，只负责把 OOXML 解析成段落、run、样式、
  分节、页眉页脚、域、脚注尾注、编号等结构化数据。
- `packages/validator`：`DocModel` × 规则库 -> 角色分类、规则比对、结构一致性问题、
  修复建议与模板候选。
- `apps/web`：浏览器工作台，负责上传、预览、检测、规则配置、草稿/发布、模板候选与报告展示。
- `apps/cli`：PoC/调试入口，负责命令行解析、规则加载、报告输出。

## OOXML 解析要点（决定检测准确率）

### 1. 必须解析有效格式

段落有效格式链：

```
docDefaults -> basedOn 样式链 -> 段落样式 -> 段落直接格式
```

run 有效格式链：

```
docDefaults -> basedOn 样式链 -> 段落标记 run 格式 -> run 直接格式
```

继承合并在 `packages/parser/src/resolve.ts`。新增可校验属性时，要同时确认：

- `ooxml.ts` / 专用解析模块读到了直接属性；
- `resolve.ts` 能沿样式链合并；
- validator 的段落级和必要的 run 级检测都能消费该字段；
- 金标准或 synthetic 测试覆盖继承、直接覆盖、缺省三种情况。

### 2. 复用 OOXML helper

通用 OOXML 操作集中在 `packages/parser/src/ooxml.ts`：
`attr` / `parseXml` / `toArray` / `readTextNode` / `collectNodeText` /
`collectParagraphNodes` / `parseRunProps` / `parseParaProps` / `parseSectPr`。

新解析模块要 import 这些 helper，不要在本地复制。`jscpd` 的 `threshold: 0`
会拦重复 helper。

### 3. 单位换算

- twip = 1/20 pt = 1/1440 inch；1 cm ≈ 567 twips。
- 字号 `w:sz/@w:val` 是 half-point，pt = val / 2。
- 行距 `w:spacing`：`lineRule=auto` 时 `@w:line / 240` = 倍数；
  `exact` / `atLeast` 时 `@w:line / 20` = pt。
- 缩进 `*Chars` 属性单位是 1/100 字符；`firstLine` / `left` 是 twips。
- 真实文档可能把 `pgMar` / `pgSz` / `ind` 写成 `"85.05pt"` / `"3cm"`。
  统一用 `measureToTwips` 兼容 `pt/cm/mm/in/pc` 与无单位 twips，不能直接 `Number()`。

### 4. fast-xml-parser 配置约定

保留命名空间前缀（`w:`、`w14:`、`m:` 等并存），属性前缀 `@_`，关闭属性/标签值类型推断。
字体名等必须保持字符串。`w:p` / `w:r` / `w:style` / `w:tbl` / `w:tr` / `w:tc`
强制为数组，避免“单个 vs 多个”分支。

`trimValues` 必须保持 `false`。页眉左右区分依赖制表符和长空白，trim 会破坏结构识别。

### 5. 主题字体解析

run 用 `w:asciiTheme` / `w:eastAsiaTheme` 等主题引用而非显式字体名时，解析
`word/theme/theme1.xml` 的 `fontScheme` 回填实际字体：`major*` -> 标题字体组，
其余 -> 正文字体组；含 `EastAsia` 取东亚字体（`a:ea` 为空时回退 `script="Hans"`），
否则取 `a:latin`。`parseRunProps(rPr, theme)` 在解析时即回填。

### 6. 结构解析已接入主流程

- `fields.ts`：解析复杂域 / 简单域，输出 `REF` / `SEQ` / `PAGEREF` / `PAGE` /
  `HYPERLINK` 等类型、显示文本、书签/序列名和 run 区间。
- `fields.ts`：提取 `w:bookmarkStart`，供题注与交叉引用关联。
- `notes.ts`：解析 `footnotes.xml` / `endnotes.xml` 常规定义，并回填段落引用位置。
- `numbering.ts`：解析 `numbering.xml` 的 `abstractNum` / `num` / `numPr`。
- `headerFooter.ts`：结构化解析 `header*.xml` / `footer*.xml`，输出左/中/右文本、
  `PAGE` 页码域、片段有效格式和 `w:pBdr/w:bottom` 页眉线。
- `ooxml.ts`：递归统计段落结构信号 `w:drawing` / OMML / `w:object`，用于图题注和公式行降噪。

新增结构解析时，先判断它是否应进入 `DocModel`，再补 parser synthetic 测试和 validator 回归。

### 7. 表格段落顺序边界

表格内段落目前用局部递归提取（`w:tbl > w:tr > w:tc > w:p`），追加到正文直接段落之后，
并标记 `inTable` / 角色 `table_cell`。没有启用全局 `preserveOrder`，所以**表格与正文的
全局交错顺序尚未保留**。这对当前格式检测影响可控，但任何依赖文档流精确顺序的功能都必须先扩充金标准。

## 校验规则约定

- 角色识别在 `packages/validator/src/classify.ts`，是按文档顺序的状态机：
  章节标题关键词 > 封面区 > 目录样式 > 大纲级别 > 当前章节。
- 文档开头到第一个“摘要”之间视为封面/扉页区，整体跳过；规则 scope 不含封面。
- 表格单元格段落直接归为 `table_cell`，不参与正文章节状态机。
- 特殊正文元素已是正式角色：`figure_caption` / `table_caption` / `source_note` /
  `formula_line`。图题注宽松识别依赖邻接 `drawing`，公式行依赖 OMML / 对象信号或数学符号。
- 后置章节已是正式角色：致谢、附录、成果分别有 heading/body 角色。
- 识别不出的段落返回 `null`，不参与段落规则校验。不要把未知段落硬塞成正文来“多报一点”。
- 对齐归一：OOXML `both` / `distribute` -> `justify`，`start` / `end` -> `left` / `right`。
- 字体校验按脚本降噪：纯中文段落不报西文字体，纯西文段落不报中文字体。
- 字体/字号优先做 run 级检测。run issue 必须保留 `startRunIndex` / `endRunIndex` /
  `affectedText`，Web 报告会展示片段；预览里的局部 run 高亮尚未实现。

## 规则库与 issue 约定

- 规则库有 legacy JSON 与 editable model 两套形态。外部入口先走
  `normalizeRuleLibrary`，导出旧格式用 `toLegacyRuleLibrary`。
- 可编辑字段支持 `exact` / `oneOf` / `range` / `unset`；新增字段必须同步更新：
  `types.ts`、`rules.ts` 标签/顺序/单位、`lint.ts`、`validate-style.ts`、候选提取和测试。
- 发布草稿必须先过 `lintRuleLibrary`；检测只消费 published rules，草稿和候选不能直接污染检测链路。
- 读取外部规则库 JSON 要剥 BOM：`.replace(/^﻿/, "")`。PowerShell `Set-Content -Encoding UTF8`
  可能写出带 BOM 的 JSON。
- issue 的 `paraIndex: -1` 表示文档级问题；段落级 issue 必须能回到 `model.paragraphs[paraIndex]`。
- issue 应尽量透传 `source.provenance`，Web 报告会展示“规范依据”。
- `computeFixHint` 会给 issue 添加人话建议和 `fixability`。只有可机械改 OOXML 属性的段落样式问题才标 `auto`；
  文档级、页眉页脚、引用、脚注尾注等默认 `manual`。
- 严重级别惯例：字体/字号 = `error`；加粗/对齐/行距/缩进 = `warn`；缺失显式行距可为 `info`。
  页眉页脚样式里字体/字号是 `error`，位置/边框类多为 `warn`。

## Web 与 CLI 约定

- Web 检测入口在 `apps/web/src/lib/analyze.ts`：浏览器内 `parseDocx` + `validateDoc`，文件不上传。
- `App.tsx` 只做导航和编排；检测流、规则库、候选提取分别放在
  `useDetectionFlow` / `useRuleLibraries` / `useRuleProposals`。
- 规则库持久化 key 是 `word-auto.rule-libraries.v1`；当前是单机浏览器状态，不是多人协作或审批流。
- 模板候选当前是单文件 MVP：上传 `.docx` -> parser + classify -> 页面设置/角色字段候选 ->
  人工接受到草稿 -> 发布 -> 检测消费新规则。已展示当前草稿、将新增/覆盖、冲突值和证据摘要；
  尚未实现持久忽略、多样本聚合和深层证据下钻。
- `docx-preview` 使用默认分页配置，不要随意覆盖 `ignoreHeight` / `breakPages` / `experimental`。
  预览渲染必须先渲染到游离节点，完成后 `replaceChildren`，并用 stale 标志丢弃过期渲染，避免 StrictMode 并发重影。
- docx-preview 对部分固定行距会算出极小行高；当前在挂载后把 `line-height < font-size` 的元素重置为 `normal`。
- 预览定位按段落原文文本匹配，不按 DOM 序号。表格追加、分页、docx-preview DOM 都可能让序号错位。
- CLI 在 `apps/cli/src/main.ts`，用 `node:util/parseArgs`；必须显式传 `--rules`，可选 `--out`。
  CLI 也要 strip BOM，并对非 `.docx`、缺文件、解析失败给中文错误和非零退出码。

## 质量门禁与防劣化约定

CI（`.github/workflows/quality.yml`）与 `pnpm run ci` 串联：

```bash
pnpm typecheck && pnpm lint && pnpm knip && pnpm jscpd && pnpm test && pnpm build
```

本地不要运行 `pnpm ci`，那不是本项目脚本入口。

| 门禁 | 工具 | 拦什么 | 严格度 |
| --- | --- | --- | --- |
| `pnpm lint` | eslint | 复杂度 / 体量 / 反模式 | `--max-warnings 0`，新增 warning 即红 |
| `pnpm knip` | knip | 未用导出 / 依赖 / 文件 | 发现即红 |
| `pnpm jscpd` | jscpd | 复制粘贴 | `.jscpd.json` `threshold: 0`，出现重复即红 |
| `pnpm test` | node:test | parser / validator / web 单测 | 行为靠测试兜住 |
| `pnpm build` | tsc / Vite | 包构建 | parser、validator、cli、web |

### 给 agent 的硬约定

1. **复用优先，禁止复制 helper。**
2. **YAGNI，不留无消费者的导出、字段和状态。** knip 能拦未用导出，但 interface 的多余字段要自己 review。
3. **结构预算：** 函数 complexity <= 15、<= 80 行；文件 <= 400 行；参数 <= 5；嵌套 <= 4 层。
4. **OOXML 动态节点用 `any` 是允许的设计选择。** 解析层不为 `any` 过度造类型；业务层类型要精确。
5. **行为变化必须补测试。** parser / classify / validate 任一路径变化，都要补 synthetic 测试或金标准回归。
6. **改完即提交。** 每次新增功能或修改代码，必须在相关测试 / typecheck / lint 通过后暂存并创建 git 提交。
   文档-only 改动至少完成 diff / 格式检查后提交；若验证无法运行，要在回复中说明原因。

## 当前已完成能力

已完成：主题字体、样式继承、run 级有效格式、run 级混排检测、页面设置检测、分节页码、
目录条目、结构化页眉页脚、页眉/页脚样式检测、页眉内容检测、统计型文档检测、
角色识别置信度透传、带单位测量值、解析错误分流、
封面区跳过、表格内段落提取、结构信号降噪、段落域/书签、题注-交叉引用关联、交叉引用有效性校验、
脚注尾注解析与一致性校验、自动编号解析、标题题序检测、图表题注连号检测、列表识别基础、
后置部分正式章节、特殊正文元素正式角色、规则配置闭环、多模板 MVP、模板候选 MVP、报告分组、
规范依据展示、修复建议、Web 预览高亮定位、CLI smoke 路径、CI 质量门禁。

## 下一步（按价值/风险排序）

1. 多模板管理补齐：新建、复制、重命名、删除模板；内置模板不可误删。
2. 模板候选增强：持久忽略、候选 diff、证据下钻、多样本聚合与评分校准。
3. 表格增强：保留表格与正文的全局交错顺序，再做表格专属规则/降噪。
4. 附录细分：附录内部小标题、成果清单、落款等角色。
5. Web 体验：Web Worker、报告与预览双向滚动、run 级局部高亮、批量检测、带批注 docx 导出。
6. 远期高风险：自动套版 / 一键修复。只能走纯 OOXML，必须无损保留分节、域、题注、
   交叉引用、编号，仍然绝不引入 Word COM。
