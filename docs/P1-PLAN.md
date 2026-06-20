# P1 开发计划

最后更新：2026-06-20

本文档是 P1（优先级 1）阶段的详细开发计划，聚焦**解析准确率**、**校验与报告可信度**、**规则库与模板候选**三大方向。

2026-06-15 结构性收尾：P1 后续功能尚未新增，但 Web 工作台已完成组件与 hooks 拆分，
validator 的分类、lint、修复建议和编号检测热路径已拆出辅助函数；`pnpm run ci` 现覆盖
`typecheck`、`lint`、`knip`、`jscpd`、`test`、`build`。

2026-06-16 run 级混排基础闭环：parser 已为每个 run 计算有效格式，validator 已按规则
检测局部 run 字体/字号异常并输出 run 区间。Web 报告展示 `affectedText`。

2026-06-19 Web 预览片段高亮闭环：选中带 `affectedText` 的 run 级 issue 时，预览会在
已定位段落内优先高亮片段；找不到片段时回退整段高亮。

2026-06-19 校验与报告可信度闭环：页眉/页脚样式检测、统计型文档检测、角色识别置信度
均已实现并接入 `validateDoc` / Web 报告；阶段 2 不再作为后续待办。

2026-06-19 多模板管理补齐：规则配置页工具栏已支持新建、复制、重命名、删除自定义模板；
内置模板不可删除，所有操作沿用 `word-auto.rule-libraries.v1` 本地持久化。

2026-06-19 模板候选增强第一阶段：候选面板已展示新增/覆盖/启用/一致 diff，支持展开样本证据
并标注低置信角色来源；候选字段/角色可忽略并持久化到 Web 本地 UI 状态。

2026-06-19 表格全局顺序闭环：parser 已对 `word/document.xml` 文档流使用 preserve-order
解析，按正文与表格在 OOXML 中的真实顺序输出 `DocModel.paragraphs`；表格段落继续标记
`inTable` 并由 validator 识别为 `table_cell`。

2026-06-20 附录细分闭环：validator 已在附录上下文内拆分 `appendix_subheading`、
`appendix_list_item`、`appendix_signature`，旧 `appendix_body` 保持兜底；新增角色的规则
fallback 继续兼容 `appendix_body` / `back_matter_body`。

## 总体排期

| 阶段 | 工作量 | 关键里程碑 |
|------|--------|-----------|
| 阶段 1：解析能力增强 | 2-3 周 | 域/题注/交叉引用/脚注尾注解析、run 级混排检测 |
| 阶段 2：校验与报告可信度提升 | 已完成 | 页眉/页脚样式检测、统计型检测、置信度标记 |
| 阶段 3：规则库与模板候选 | 已完成 | 模板管理、候选 diff/证据/忽略已完成 |
| 阶段 4：兜底与补充 | 已完成 | 表格全局顺序与附录细分已完成 |
| **总计** | **5-8 周** | P1 全部完成 |

---

## 阶段 1：解析能力增强（2-3 周）

### 1.1 域解析基础设施

**目标**：识别常见域类型（`REF`/`SEQ`/`PAGEREF`/`PAGE` 等）的存在、文本与所在段落

**背景**：
OOXML 域由 `w:fldChar`（域边界：`begin`/`separate`/`end`）与 `w:instrText`（域指令文本）组成。
域有两种形式：
- 简单域（`w:fldSimple`）：指令与显示文本在同一元素
- 复杂域（`w:fldChar` 三段式）：`begin` → 指令 run → `separate` → 显示文本 run → `end`

**任务清单**：
- [x] 实现 `packages/parser/src/fields.ts`：
  - [x] 解析复杂域：识别 `w:fldChar` 的 `fldCharType`（`begin`/`separate`/`end`）
  - [x] 提取域指令：收集 `begin` 到 `separate` 之间的 `w:instrText` 文本
  - [x] 提取显示文本：收集 `separate` 到 `end` 之间的 run 文本
  - [x] 解析简单域：处理 `w:fldSimple` 的 `instr` 属性
  - [x] 域指令解析：识别域类型（`REF`/`SEQ`/`PAGEREF`/`PAGE`/`HYPERLINK` 等）和参数
- [x] 扩展 `Paragraph` 类型：
  ```typescript
  interface Field {
    type: string;           // 域类型：REF/SEQ/PAGEREF/PAGE 等
    instruction: string;    // 完整域指令文本
    displayText: string;    // 显示文本
    bookmark?: string;      // REF/PAGEREF 引用的书签
    sequence?: string;      // SEQ 序列名称（Figure/Table/Equation）
    startRunIndex: number;  // 域起始 run 索引
    endRunIndex: number;    // 域结束 run 索引
  }
  
  interface Paragraph {
    // ... 现有字段
    fields?: Field[];       // 段落内的域列表
  }
  ```
- [x] 测试覆盖：
  - [x] `packages/parser/src/fields.test.ts`：复杂域解析、简单域解析、域指令解析
  - [x] 验证题注域（`SEQ Figure` / synthetic docx）
  - [x] 验证交叉引用域（`REF` / synthetic docx）
  - [x] 验证页码域（`PAGE` / synthetic docx）
  - [x] 验证嵌套域

**实现状态（2026-06-14）**：
- 已在 parser 侧新增独立 `fields.ts`，并把结果挂到 `Paragraph.fields`。
- 复杂域与简单域均会产出结构化 `Field`：`type`、`instruction`、`displayText`、
  `bookmark` / `sequence`、`startRunIndex` / `endRunIndex`。
- 当前 `templates/source/*.docx` 标准模板未包含正文域样本，因此真实模板回归暂以
  “不误识别正文 field + 既有 baseline 不回退”为准；题注 / 交叉引用 / 页码域由 synthetic
  docx 单测覆盖。

**产出**：
- `packages/parser/src/fields.ts`（域解析逻辑）
- `packages/parser/src/fields.test.ts`（单元测试）
- 扩展后的 `Paragraph` 类型

**验收标准**：
- 当前标准模板基线不回退；synthetic docx 可识别题注域、交叉引用域、页码域
- 单测覆盖复杂域、简单域、嵌套域（域内包含域）
- `pnpm run ci` 通过

---

### 1.2 题注与交叉引用

**目标**：识别图题注、表题注的 `SEQ` 域，以及引用它们的 `REF` 域

**背景**：
图表题注通常使用 `SEQ Figure`/`SEQ Table` 域生成编号，交叉引用使用 `REF` 域引用书签。
当前连号检测基于正则解析，容易误判；改用域解析后准确性更高。

**任务清单**：
- [ ] 实现题注域识别（基于 1.1 的域解析）：
  - [x] 识别 `SEQ Figure`/`SEQ Table`/`SEQ Equation` 域
  - [x] 提取题注编号（可能是多级编号，如 `1-1`）
  - [x] 关联题注域与段落角色（`figure_caption`/`table_caption`/`formula_line`）
- [ ] 实现交叉引用关联：
  - [x] 识别 `REF` / `PAGEREF` 域及其引用的书签
  - [x] 关联 `REF` 域与 `SEQ` 域（通过书签）
  - [x] 构建题注引用图：哪些段落引用了哪些题注
- [ ] validator 增强：基于域的连号检测
  - [ ] 替代当前 `packages/validator/src/numbering-check.ts` 的正则解析
  - [x] 检测题注编号连续性（基于 `SEQ` 域优先，支持多级编号；无域时仍保留正则兜底）
  - [x] 检测交叉引用有效性（`REF` / `PAGEREF` 缺失书签、非题注目标书签）
- [ ] 金标准测试：
  - [x] 验证题注域识别准确性
  - [x] 验证交叉引用关联准确性
  - [x] 验证基于域的连号检测（对比当前正则版本）

**产出**：
- 题注域结构化解析
- 交叉引用关联逻辑
- 增强版连号检测（基于域，替代正则）

**实现状态（2026-06-14）**：
- parser 已补 `w:bookmarkStart` 提取，并把结果挂到 `Paragraph.bookmarks`。
- validator 已新增 `buildCaptionReferenceGraph(classified)`，产出图 / 表 / 公式题注
  `SEQ`、正文 `REF` / `PAGEREF` 与书签之间的结构化关联数据。
- `packages/validator/src/numbering-check.ts` 已优先消费图 / 表题注的 `SEQ` 域编号；
  无域样本仍保留原正则兜底，避免标准模板基线回退。
- validator 已新增 `REF` / `PAGEREF` 引用有效性校验，并将“书签不存在”与
  “书签存在但目标不是图 / 表 / 公式题注”输出为结构化 `issue`。
- 图 / 表题注连号检测已明确以 `SEQ` 域编号为主，段落正则仅作为无域样本兜底。

**验收标准**：
- 能识别标准模板中所有图题注、表题注、交叉引用
- 连号检测准确率 ≥ 当前正则版本
- `pnpm run ci` 通过

---

### 1.3 脚注尾注

**目标**：识别脚注/尾注的存在、引用位置、内容文本

**背景**：
脚注定义在 `footnotes.xml`，尾注定义在 `endnotes.xml`。
段落内通过 `w:footnoteReference`/`w:endnoteReference` 引用。

**任务清单**：
- [x] 实现 `packages/parser/src/notes.ts`：
  - [x] 解析 `word/footnotes.xml`：提取脚注 ID 与内容段落
  - [x] 解析 `word/endnotes.xml`：提取尾注 ID 与内容段落
  - [x] 解析段落内 `w:footnoteReference`/`w:endnoteReference`：记录引用位置
- [x] 扩展 `Paragraph` 类型：
  ```typescript
  interface Note {
    id: string;             // 脚注/尾注 ID
    type: 'footnote' | 'endnote';
    content: string;        // 脚注/尾注文本内容
    runIndex: number;       // 引用标记所在 run 索引
  }
  
  interface Paragraph {
    // ... 现有字段
    notes?: Note[];         // 段落内的脚注/尾注引用
  }
  ```
- [x] validator 接入：
  - [x] 统计脚注/尾注数量与引用/定义一致性
  - [ ] 校验脚注/尾注格式（可选规则：字体、字号）
- [x] 金标准测试：
  - [x] `packages/parser/src/notes.test.ts`：脚注解析、尾注解析
  - [x] 验证引用位置准确性

**产出**：
- `packages/parser/src/notes.ts`（脚注尾注解析）
- `packages/parser/src/notes.test.ts`（单元测试）
- 脚注尾注结构化数据

**实现状态（2026-06-14）**：
- parser 已新增独立 `notes.ts`：解析 `footnotes.xml` / `endnotes.xml` 常规注释定义，
  忽略 separator / continuation 等特殊项，并将正文按段落拼接。
- `Paragraph.notes` 已记录 `footnote` / `endnote` 的 `id`、`runIndex`、`content` 与
  `hasDefinition`，`DocModel.noteDefinitions` 保留整篇文档的注释定义列表。
- validator 已新增基础一致性校验：正文引用缺定义时报段落级 error；定义存在但正文未引用时报
  document 级 info。样式级脚注规则仍留待后续扩展。
- synthetic 测试覆盖脚注、尾注、缺失定义；标准模板基线已固化真实 1 条脚注样本的定义、正文和引用位置。

**验收标准**：
- 能识别标准模板中所有脚注/尾注及引用位置
- 统计数量准确
- `pnpm run ci` 通过

---

### 1.4 run 级混排检测

**目标**：检测段落内局部 run 字体/字号不一致，定位到 run 或字符区间

**背景**：
当前只检测段落级字体/字号，无法发现段落内局部混排（如"中文宋体 + 英文 Arial"）。

**任务清单**：
- [x] 实现 run 级有效格式计算：
  - [x] 遍历段落内所有 run，为每个 run 计算有效字体/字号（继承解析）
  - [x] 扩展 `Run` 类型：
    ```typescript
    interface Run {
      // ... 现有字段
      effective?: {
        fontEastAsia?: string;
        fontAscii?: string;
        sizePt?: number;
        bold?: boolean;
      };
    }
    ```
- [x] validator 接入：run 级混排检测
  - [x] 检测同段落内 run 间字体差异（忽略空白 run）
  - [x] 检测同段落内 run 间字号差异
  - [x] 生成 issue 时定位到 run 区间：
    ```typescript
    interface ValidationIssue {
      // ... 现有字段
      startRunIndex?: number;  // 问题起始 run 索引
      endRunIndex?: number;    // 问题结束 run 索引
      affectedText?: string;   // 受影响的文本片段
    }
    ```
- [x] web 报告与预览增强：片段高亮闭环
  - [x] 报告项展示 `affectedText` 与起始 run 序号
  - [x] 在 docx-preview 已定位段落内匹配 `affectedText`
  - [x] 局部高亮（而非整段高亮），片段找不到时回退整段
- [x] 金标准测试：
  - [x] 验证 run 级混排检测准确性
  - [x] 验证 run 区间定位精度

**产出**：
- run 级有效格式计算
- run 级校验逻辑
- run 区间定位与受影响文本展示

**实现状态（2026-06-16）**：
- `Run.effective` 已记录每个 run 的继承后格式，来源链为 `docDefaults → 样式链 →
  段落标记 run → run 直接格式`。
- validator 已将字体/字号检测优先切到 run 粒度，纯中文/纯西文仍按脚本降噪；相邻且实际值
  相同的异常 run 会合并为一个区间 issue，避免长段落被逐 run 刷屏。
- issue 已携带 `startRunIndex` / `endRunIndex` / `affectedText`，Web 报告展示受影响片段；
  `docx-preview` 预览会在目标段落内优先高亮 `affectedText`。
- 标准模板校验基线已更新：run 级检测新增 1 个公式编号行字号区间问题。

**验收标准**：
- 能检测段落内局部混排（如"中文宋体 + 英文 Arial"）
- 报告能展示问题 run 区间与受影响文本
- `pnpm run ci` 通过

---

## 阶段 2：校验与报告可信度提升（1-2 周）

### 2.1 页眉/页脚样式检测

**目标**：基于已解析的结构化页眉页脚，校验字体、字号、页眉下划线、页码位置

**背景**：
当前已解析页眉/页脚基础结构（左/中/右位置 + `PAGE` 域），但未校验样式。

**任务清单**：
- [x] parser 增强：页眉/页脚样式解析
  - [x] 解析页眉下划线（`w:pBdr` 的 `w:bottom`）
  - [x] 解析页码字体/字号（`PAGE` 域所在 run 的有效格式）
  - [ ] 扩展 `HeaderFooter` 类型：
    ```typescript
    interface HeaderFooter {
      // ... 现有字段
      underline?: {
        type: string;   // 下划线类型：single/double/thick 等
        color?: string; // 颜色
      };
      pageNumberFormat?: {
        fontEastAsia?: string;
        fontAscii?: string;
        sizePt?: number;
      };
    }
    ```
- [x] 扩展规则库：增加页眉/页脚样式规则
  - [x] 支持页眉文本字体、字号、页眉线和页码位置/字体/字号
- [x] validator 接入：页眉/页脚样式检测
  - [x] 校验页眉文本字体/字号
  - [x] 校验页眉下划线类型
  - [x] 校验页码位置（左/中/右）
  - [x] 校验页码字体/字号
- [x] 金标准测试：验证页眉/页脚样式检测准确性

**产出**：
- 页眉/页脚样式规则
- 检测逻辑
- 金标准测试

**实现状态（2026-06-19）**：
- `packages/validator/src/header-footer-check.ts` 已接入 `validateDoc`。
- 相关回归覆盖在 `packages/validator/src/heuristics.test.ts`。

**验收标准**：
- 能检测标准模板的页眉字体、页眉下划线、页码位置
- `pnpm run ci` 通过

---

### 2.2 统计型文档检测

**目标**：参考文献条数、外文占比、关键词数量、摘要字数区间

**背景**：
部分规范要求统计型指标（如"关键词 3-5 个"、"摘要 300-500 字"）。

**任务清单**：
- [x] 实现统计型检测器：
  - [x] 参考文献条数：统计 `reference_body` 角色段落数
  - [x] 外文占比：统计外文参考文献比例
  - [x] 关键词数量：按分号/逗号等分隔计数
  - [x] 摘要字数：统计 `abstract_body_cn` 字数与 `abstract_body_en` 词数
- [x] 扩展规则库：增加 `statistics` 规则类型
  - [x] 规则字段：关键词、摘要、参考文献统计阈值
  - [ ] 示例规则：
    ```json
    {
      "role": "keywords_cn",
      "statistics": {
        "metric": "keyword_count",
        "min": 3,
        "max": 5
      }
    }
    ```
- [x] validator 接入：生成统计型 issue
  - [x] 超出阈值时生成 `warn`/`error` 级 issue
  - [x] issue 描述包含实际值与期望范围
- [x] 金标准测试：验证统计型检测准确性

**产出**：
- 统计型检测器
- `statistics` 规则类型
- 统计报告

**实现状态（2026-06-19）**：
- `packages/validator/src/statistics-check.ts` 与 `statistics-rules.ts` 已接入规则规范化和
  `validateDoc`。
- 相关测试在 `packages/validator/src/statistics-check.test.ts`。

**验收标准**：
- 能检测关键词数量、摘要字数、参考文献条数
- `pnpm run ci` 通过

---

### 2.3 角色识别置信度

**目标**：对启发式命中的低置信段落打标，减少"看似确定"的误导

**背景**：
部分角色识别基于启发式（如封面特征字段、图题注宽松模式），可能误判。

**任务清单**：
- [x] 识别低置信场景：
  - [x] 图/表题注仅靠文本模式命中且无结构信号
  - [x] 公式编号行命中但无 OMML/对象结构
  - [x] 资料来源仅靠文本模式命中
- [x] 新增结构化分类结果：
  ```typescript
  interface ClassifiedParagraphDetail {
    para: Paragraph;
    role: Role | null;
    confidence: 'high' | 'medium' | 'low';
    reason?: string;
  }
  ```
- [x] validator 透传置信度：issue 增加 `roleConfidence` / `roleConfidenceReason`
- [x] web 报告增强：仅低置信段落显示简短置信度提示
- [x] 模板候选：使用结构化分类入口，并在 notice 中提示低置信样本数量
- [x] 金标准测试：验证置信度标记准确性

**产出**：
- 置信度标记逻辑
- 前端展示
- 降低误导风险

**实现状态（2026-06-19）**：
- `classifyParagraphDetails(...)` 保持旧 `classifyParagraphs(...)` 兼容。
- `validateDoc` 会把段落级 issue 的角色识别置信度透传给 Web 报告。
- `extractRuleProposal` 会提示低置信样本数量，避免候选证据被误读为完全可靠。

**验收标准**：
- 低置信段落能被正确标记
- 前端能展示置信度标记
- `pnpm run ci` 通过

---

## 阶段 3：规则库与模板候选（1-2 周）

### 3.1 多模板管理补齐

**目标**：UI 支持新建、复制、重命名、删除模板

**背景**：
此前只能导入/切换模板，无法在 UI 中管理模板生命周期。

**任务清单**：
- [x] 规则配置页工具栏补齐模板管理：
  - [x] 模板列表：展示所有模板（内置 + 自定义）
  - [x] 新建模板：基于空白最小规则库创建
  - [x] 复制模板：基于现有模板创建副本，复制内置模板时产出自定义模板
  - [x] 重命名模板：同步修改 `published` / `draft` 展示名称
  - [x] 删除模板：带确认提示，内置模板不可删除
- [x] 前端状态管理：同步现有 `word-auto.rule-libraries.v1`
  - [x] 模板列表与草稿/发布状态继续存储在 `RuleLibraryRecord[]`
  - [x] 删除当前模板后自动切换到内置模板或剩余首项
- [x] 单元测试：
  - [x] `apps/web/src/lib/ruleLibraries.test.ts`
  - [x] 验证 CRUD、持久化、内置不可删和既有导入/发布/候选闭环

**产出**：
- 模板管理 UI
- CRUD 逻辑

**实现状态（2026-06-19）**：
- 纯函数集中在 `apps/web/src/lib/ruleLibraries.ts`，Hook 接入在
  `apps/web/src/hooks/useRuleLibraries.ts`。
- UI 入口在现有规则配置工具栏，不新增独立页面，避免拆出第二套模板状态。

**验收标准**：
- 能新建/复制/重命名/删除模板
- 操作后 `localStorage` 状态正确
- `pnpm run ci` 通过

---

### 3.2 候选 diff 与证据下钻

**目标**：展示候选与当前草稿的差异，支持忽略候选并记录状态；展示样本段落、角色来源、冲突值明细

**任务清单**：
- [x] 候选 diff 算法（`packages/validator/src/proposals-apply.ts`）：
  - [x] 比较候选值与草稿值：标记新增、覆盖、启用已禁用字段、与当前值一致
  - [x] diff 类型复用 `ProposalApplyStatus`：`added` / `updated` / `enabled` / `unchanged`
- [x] 忽略候选功能：
  - [x] 记录用户忽略决策到 `word-auto.proposal-ignores.v1`
  - [x] 默认过滤已忽略候选，并提供“显示已忽略 / 取消忽略”
- [x] 证据下钻面板（`apps/web/src/components/TemplateProposalEvidence.tsx`）：
  - [x] 候选字段可展开查看证据
  - [x] 展示样本段落文本、段落 index、角色来源、样本值与角色置信度
  - [x] 低置信样本显示简短提示
- [x] 前端 UI：
  - [x] diff 视图：标记新增、覆盖、启用和一致状态
  - [x] 忽略按钮：点击后标记为已忽略
  - [x] 证据面板：折叠/展开
- [x] 测试：验证 diff 算法、结构化证据、忽略持久化和候选面板渲染

**产出**：
- 候选 diff 视图
- 证据下钻面板
- 候选忽略本地状态

**验收标准**：
- diff 能正确标记新增/覆盖/启用/一致
- 忽略功能正常工作
- 证据面板能展示样本段落与冲突明细
- `pnpm run ci` 通过

**实现状态（2026-06-19）**：
- validator 已在候选样本中保留结构化证据，并新增只读 diff helper。
- Web 候选面板已展示 diff、可展开证据、低置信样本提示和持久忽略状态。
- 忽略状态是本地 UI 状态，不进入规则库 draft/published 或 JSON 导入/导出格式。

---

## 阶段 4：兜底与补充（1 周）

### 4.1 表格全局顺序

**目标**：保留表格与正文交错顺序

**背景**：
此前已提取表格内段落（`inTable` / `table_cell`），但未保留表格与正文的全局交错顺序。

**任务清单**：
- [x] 修改 parser：
  - [x] 对 `word/document.xml` 增加 preserve-order 解析，用于读取 body 子节点顺序
  - [x] 将 preserve-order 节点转换回现有段落对象 shape，保持 `DocModel.paragraphs` 接口稳定
  - [x] 不新增无消费者的 `Paragraph` 字段
- [x] 扩充测试：
  - [x] synthetic docx 覆盖“正文段落 A -> 表格段落 -> 正文段落 B”顺序
  - [x] 更新标准模板 parser 金标准中随表格归位变化的结构信号索引
- [x] validator 回归：确认 `inTable` 段落数与 `table_cell` 分类数一致

**产出**：
- 表格全局顺序保留
- 金标准扩充

**实现状态（2026-06-19）**：
- 新增 `packages/parser/src/documentFlow.ts`，只负责按 preserve-order 文档流收集正文与表格段落。
- 未改变 validator 业务语义；`classifyParagraphDetails` 仍优先将 `inTable` 段落判为 `table_cell`。
- 未新增 `Paragraph` 字段，避免形成无消费者的第二套表格元数据。

**验收标准**：
- 表格段落在文档流中的位置正确
- `pnpm run ci` 通过

---

### 4.2 附录细分

**目标**：拆分附录内部小标题、成果清单、落款等角色

**背景**：
当前附录内容统一为 `appendix_body`，无法区分内部结构。

**任务清单**：
- [x] 扩展角色分类（`packages/validator/src/classify.ts`）：
  - [x] 识别附录内小标题：仅在附录上下文内消费大纲级别 / 标题样式
  - [x] 识别附录材料 / 条目清单：基于自动编号、编号文本或“材料 / 附件”条目模式
  - [x] 识别落款：保守匹配姓名、日期、地点等短段落
- [x] validator 接入：新增角色 fallback 到 `appendix_body`，再兼容旧 `back_matter_body`
- [x] 金标准测试：标准模板中 3 个附录清单项从 `appendix_body` 拆出为 `appendix_list_item`

**产出**：
- 附录细分角色
- 分类逻辑
- 校验规则

**实现状态（2026-06-20）**：
- 新增角色：`appendix_subheading`、`appendix_list_item`、`appendix_signature`。
- 分类只在 `section === "appendix"` 时触发；正文、参考文献、致谢和成果章节不触发附录专属角色。
- `inTable` 段落仍最优先分类为 `table_cell`，不进入附录状态机。

**验收标准**：
- 能识别附录内小标题、清单、落款
- `pnpm run ci` 通过

---

## 风险与依赖

### 1. 技术风险

**域解析复杂度**（高风险）：
- OOXML 域有嵌套域、简单域、复杂域等多种形式，边界 case 多
- 缓解：充分测试，基于金标准样本验证

### 2. 工程风险

**金标准维护成本**（低风险）：
- 每次行为变化都要更新金标准，维护成本增加
- 缓解：自动化测试，CI 覆盖

### 3. 资源依赖

- 标准模板样本：需要足够多的标准模板用于测试域解析、题注、脚注等
- 前端资源：带批注 docx 导出和报告/预览双向滚动需要前端开发资源

---

## 里程碑检查点

| 检查点 | 时间 | 验收标准 |
|--------|------|---------|
| 域解析基础设施完成 | 第 2 周 | 能识别题注域、交叉引用域、页码域，单测通过 |
| 题注与交叉引用完成 | 第 3 周 | 连号检测基于域，准确率 ≥ 正则版本 |
| run 级混排检测完成 | 第 3 周 | 能检测段落内局部混排，报告能展示问题 run 区间 |
| 页眉/页脚样式检测完成 | 已完成 | 能检测页眉字体、下划线、页码位置 |
| 统计型检测完成 | 已完成 | 能检测关键词数量、摘要字数、参考文献条数 |
| 角色识别置信度完成 | 已完成 | 低置信启发式命中透传到报告 |
| 模板管理完成 | 已完成 | UI 支持新建/复制/重命名/删除模板 |
| 候选 diff 完成 | 已完成 | 能展示候选与草稿差异，支持忽略 |
| 表格全局顺序完成 | 已完成 | 表格段落按文档流输出，`table_cell` 分类不回退 |
| P1 全部完成 | 已完成 | 所有任务完成，`pnpm run ci` 通过，文档更新 |

---

## 后续规划

P1 完成后，进入 P2（Web 体验与交付）：
1. Web Worker 解析（避免大文档阻塞 UI）
2. 带批注 docx 导出（纯 OOXML 生成批注）
3. 报告与预览双向滚动

详见 [`docs/TODO.md`](./TODO.md) 的 P2 部分。
