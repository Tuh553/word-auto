# P1 开发计划

最后更新：2026-06-14

本文档是 P1（优先级 1）阶段的详细开发计划，聚焦**解析准确率**、**校验与报告可信度**、**规则库与模板候选**三大方向。

## 总体排期

| 阶段 | 工作量 | 关键里程碑 |
|------|--------|-----------|
| 阶段 1：解析能力增强 | 2-3 周 | 域/题注/交叉引用/脚注尾注解析、run 级混排检测 |
| 阶段 2：校验与报告可信度提升 | 1-2 周 | 页眉/页脚样式检测、统计型检测、置信度标记 |
| 阶段 3：规则库与模板候选 | 1-2 周 | 模板管理、候选 diff/证据/评分 |
| 阶段 4：兜底与补充 | 1 周 | 表格全局顺序、附录细分 |
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
- [ ] 实现 `packages/parser/src/notes.ts`：
  - [ ] 解析 `word/footnotes.xml`：提取脚注 ID 与内容段落
  - [ ] 解析 `word/endnotes.xml`：提取尾注 ID 与内容段落
  - [ ] 解析段落内 `w:footnoteReference`/`w:endnoteReference`：记录引用位置
- [ ] 扩展 `Paragraph` 类型：
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
- [ ] validator 接入：
  - [ ] 统计脚注/尾注数量
  - [ ] 校验脚注/尾注格式（可选规则：字体、字号）
- [ ] 金标准测试：
  - [ ] `packages/parser/src/notes.test.ts`：脚注解析、尾注解析
  - [ ] 验证引用位置准确性

**产出**：
- `packages/parser/src/notes.ts`（脚注尾注解析）
- `packages/parser/src/notes.test.ts`（单元测试）
- 脚注尾注结构化数据

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
- [ ] 实现 run 级有效格式计算：
  - [ ] 遍历段落内所有 run，为每个 run 计算有效字体/字号（继承解析）
  - [ ] 扩展 `Run` 类型：
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
- [ ] validator 接入：run 级混排检测
  - [ ] 检测同段落内 run 间字体差异（忽略空白 run）
  - [ ] 检测同段落内 run 间字号差异
  - [ ] 生成 issue 时定位到 run 区间：
    ```typescript
    interface ValidationIssue {
      // ... 现有字段
      startRunIndex?: number;  // 问题起始 run 索引
      endRunIndex?: number;    // 问题结束 run 索引
      affectedText?: string;   // 受影响的文本片段
    }
    ```
- [ ] web 报告增强：高亮 run 级区间
  - [ ] 基于 `startRunIndex`/`endRunIndex` 定位到 docx-preview 渲染的 DOM 元素
  - [ ] 局部高亮（而非整段高亮）
- [ ] 金标准测试：
  - [ ] 验证 run 级混排检测准确性
  - [ ] 验证 run 区间定位精度

**产出**：
- run 级校验逻辑
- 字符区间定位
- 前端局部高亮支持

**验收标准**：
- 能检测段落内局部混排（如"中文宋体 + 英文 Arial"）
- 前端能准确高亮问题 run
- `pnpm run ci` 通过

---

## 阶段 2：校验与报告可信度提升（1-2 周）

### 2.1 页眉/页脚样式检测

**目标**：基于已解析的结构化页眉页脚，校验字体、字号、页眉下划线、页码位置

**背景**：
当前已解析页眉/页脚基础结构（左/中/右位置 + `PAGE` 域），但未校验样式。

**任务清单**：
- [ ] parser 增强：页眉/页脚样式解析
  - [ ] 解析页眉下划线（`w:pBdr` 的 `w:bottom`）
  - [ ] 解析页码字体/字号（`PAGE` 域所在 run 的有效格式）
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
- [ ] 扩展规则库：增加页眉/页脚样式规则
  - [ ] 增加 `header_text`/`footer_text` 角色
  - [ ] 支持字段：`fontEastAsia`/`fontAscii`/`sizePt`/`alignment`/`underline`
- [ ] validator 接入：页眉/页脚样式检测
  - [ ] 校验页眉文本字体/字号
  - [ ] 校验页眉下划线类型
  - [ ] 校验页码位置（左/中/右）
  - [ ] 校验页码字体/字号
- [ ] 金标准测试：验证页眉/页脚样式检测准确性

**产出**：
- 页眉/页脚样式规则
- 检测逻辑
- 金标准测试

**验收标准**：
- 能检测标准模板的页眉字体、页眉下划线、页码位置
- `pnpm run ci` 通过

---

### 2.2 统计型文档检测

**目标**：参考文献条数、外文占比、关键词数量、摘要字数区间

**背景**：
部分规范要求统计型指标（如"关键词 3-5 个"、"摘要 300-500 字"）。

**任务清单**：
- [ ] 实现统计型检测器：
  - [ ] 参考文献条数：统计 `reference_body` 角色段落数
  - [ ] 外文占比：正则匹配英文字符比例
  - [ ] 关键词数量：按分号/逗号分隔计数
  - [ ] 摘要字数：统计 `abstract_body_cn`/`abstract_body_en` 总字符数
- [ ] 扩展规则库：增加 `statistics` 规则类型
  - [ ] 规则字段：`metric`（指标名）、`min`/`max`/`range`（阈值）
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
- [ ] validator 接入：生成统计型 issue
  - [ ] 超出阈值时生成 `warn`/`error` 级 issue
  - [ ] issue 描述包含实际值与期望范围
- [ ] 金标准测试：验证统计型检测准确性

**产出**：
- 统计型检测器
- `statistics` 规则类型
- 统计报告

**验收标准**：
- 能检测关键词数量、摘要字数、参考文献条数
- `pnpm run ci` 通过

---

### 2.3 角色识别置信度

**目标**：对启发式命中的低置信段落打标，减少"看似确定"的误导

**背景**：
部分角色识别基于启发式（如封面特征字段、图题注宽松模式），可能误判。

**任务清单**：
- [ ] 识别低置信场景：
  - [ ] 封面特征字段（`COVER_HINT`）命中但段落 > 25 字
  - [ ] 图题注宽松模式（`FIGURE_CAPTION_RELAXED`）命中但无邻接 `drawing`
  - [ ] 公式编号行命中但无 OMML/对象结构
  - [ ] 表题注命中但段落无表格邻接
- [ ] 扩展 `Paragraph` 类型：
  ```typescript
  interface Paragraph {
    // ... 现有字段
    roleConfidence?: 'high' | 'low';
  }
  ```
- [ ] validator 透传置信度：issue 增加 `roleConfidence` 字段
- [ ] web 报告增强：低置信段落显示置信度标记（如 ⚠️ 图标）
- [ ] 金标准测试：验证置信度标记准确性

**产出**：
- 置信度标记逻辑
- 前端展示
- 降低误导风险

**验收标准**：
- 低置信段落能被正确标记
- 前端能展示置信度标记
- `pnpm run ci` 通过

---

## 阶段 3：规则库与模板候选（1-2 周）

### 3.1 多模板管理补齐

**目标**：UI 支持新建、复制、重命名、删除模板

**背景**：
当前只能导入/切换模板，无法在 UI 中管理模板生命周期。

**任务清单**：
- [ ] 模板管理页面（`apps/web/src/pages/TemplateManager.tsx`）：
  - [ ] 模板列表：展示所有模板（内置 + 自定义）
  - [ ] 新建模板：基于空白规则库创建
  - [ ] 复制模板：基于现有模板创建副本
  - [ ] 重命名模板：修改模板名称与描述
  - [ ] 删除模板：带确认提示（内置模板不可删除）
- [ ] 前端状态管理：同步 `localStorage`
  - [ ] 模板列表存储：`localStorage.templates`
  - [ ] 当前模板索引：`localStorage.currentTemplateId`
- [ ] 金标准测试：
  - [ ] `apps/web/src/pages/TemplateManager.test.tsx`
  - [ ] 验证 CRUD 操作正确性

**产出**：
- 模板管理 UI
- CRUD 逻辑

**验收标准**：
- 能新建/复制/重命名/删除模板
- 操作后 `localStorage` 状态正确
- `pnpm run ci` 通过

---

### 3.2 候选 diff 与证据下钻

**目标**：展示候选与当前草稿的差异，支持忽略候选并记录状态；展示样本段落、角色来源、冲突值明细

**任务清单**：
- [ ] 候选 diff 算法（`packages/validator/src/proposals.ts`）：
  - [ ] 比较候选值与草稿值：标记新增/修改/冲突
  - [ ] diff 类型：`'new'`（新字段）、`'modified'`（值不同）、`'conflict'`（多个候选值）
- [ ] 忽略候选功能：
  - [ ] 记录用户忽略决策到 `localStorage.ignoredProposals`
  - [ ] diff 视图过滤已忽略候选
- [ ] 证据下钻面板（`apps/web/src/components/ProposalEvidence.tsx`）：
  - [ ] 点击候选值展开证据面板
  - [ ] 展示样本段落列表（文本 + 段落索引）
  - [ ] 展示角色来源（角色名 + 段落数）
  - [ ] 展示冲突值明细（每个值的样本数 + 覆盖率）
- [ ] 前端 UI：
  - [ ] diff 视图：三色标记（绿=新增、黄=修改、红=冲突）
  - [ ] 忽略按钮：点击后标记为已忽略
  - [ ] 证据面板：折叠/展开
- [ ] 金标准测试：验证 diff 算法与忽略逻辑

**产出**：
- 候选 diff 视图
- 证据下钻面板

**验收标准**：
- diff 能正确标记新增/修改/冲突
- 忽略功能正常工作
- 证据面板能展示样本段落与冲突明细
- `pnpm run ci` 通过

---

### 3.3 多样本聚合与评分校准

**目标**：支持上传多篇样本文档共同提取候选；统一样本数/覆盖率/冲突率/角色可靠性为稳定评分

**任务清单**：
- [ ] 多样本上传（`apps/web`）：
  - [ ] 一次上传多个 `.docx` 文件
  - [ ] 批量解析 + 分类
  - [ ] 聚合候选统计（跨样本）
- [ ] 评分模型（`packages/validator/src/proposals.ts`）：
  - [ ] `样本数`：出现该候选值的样本数量
  - [ ] `覆盖率`：该候选值覆盖的段落比例
  - [ ] `冲突率`：同角色同字段的不同候选值数量
  - [ ] `角色可靠性`：基于分类置信度的加权
  - [ ] 综合评分公式：`score = f(样本数, 覆盖率, 1-冲突率, 角色可靠性)`
- [ ] 前端展示：
  - [ ] 评分星级（1-5 星）
  - [ ] 评分明细（悬停显示各项指标）
- [ ] 金标准测试：验证多样本聚合与评分计算

**产出**：
- 多样本聚合
- 评分模型
- 评分展示

**验收标准**：
- 能上传多篇样本并聚合候选
- 评分能反映候选质量（高样本数、高覆盖率、低冲突率 → 高分）
- `pnpm run ci` 通过

---

## 阶段 4：兜底与补充（1 周）

### 4.1 表格全局顺序

**目标**：保留表格与正文交错顺序

**背景**：
当前已提取表格内段落（`inTable` / `table_cell`），但未保留表格与正文的全局交错顺序。

**任务清单**：
- [ ] 修改 parser（`packages/parser/src/ooxml.ts`）：
  - [ ] 设置 `preserveOrder: true`：表格段落保留在文档流原位置
  - [ ] 扩展 `Paragraph` 类型：增加 `tableId?: string` 标记同一表格的段落
- [ ] 扩充金标准：
  - [ ] 增加含交错表格的样本文档（`templates/source/table-interleaved.docx`）
  - [ ] 验证表格段落的全局顺序
- [ ] validator 接入：按文档流顺序校验（不影响现有逻辑）
- [ ] 金标准测试：验证表格全局顺序保留

**产出**：
- 表格全局顺序保留
- 金标准扩充

**验收标准**：
- 表格段落在文档流中的位置正确
- `pnpm run ci` 通过

---

### 4.2 附录细分

**目标**：拆分附录内部小标题、成果清单、落款等角色

**背景**：
当前附录内容统一为 `appendix_body`，无法区分内部结构。

**任务清单**：
- [ ] 扩展角色分类（`packages/validator/src/classify.ts`）：
  - [ ] 识别附录内小标题（`heading2`/`heading3` 在附录章节内）
  - [ ] 识别成果清单：基于编号格式、关键词（论文/专利/软著）
  - [ ] 识别落款：基于日期格式、位置（附录末尾）
- [ ] validator 接入：附录细分角色校验
- [ ] 金标准测试：验证附录细分准确性

**产出**：
- 附录细分角色
- 分类逻辑
- 校验规则

**验收标准**：
- 能识别附录内小标题、成果清单、落款
- `pnpm run ci` 通过

---

## 风险与依赖

### 1. 技术风险

**域解析复杂度**（高风险）：
- OOXML 域有嵌套域、简单域、复杂域等多种形式，边界 case 多
- 缓解：充分测试，基于金标准样本验证

**run 级混排前端高亮**（中风险）：
- docx-preview 可能不支持字符区间高亮，需要定制
- 缓解：优先实现检测逻辑，前端高亮可降级为整段高亮

**候选评分模型**（中风险）：
- 评分公式需实际样本数据校准，可能需多轮迭代
- 缓解：MVP 先用简单加权，后续根据用户反馈调整

### 2. 工程风险

**表格全局顺序影响现有逻辑**（中风险）：
- 修改 `preserveOrder` 可能影响现有校验逻辑
- 缓解：充分回归测试，确保金标准全部通过

**金标准维护成本**（低风险）：
- 每次行为变化都要更新金标准，维护成本增加
- 缓解：自动化测试，CI 覆盖

### 3. 资源依赖

- 标准模板样本：需要足够多的标准模板用于测试域解析、题注、脚注等
- 前端资源：run 级高亮、候选 diff 视图、证据面板需要前端开发资源

---

## 里程碑检查点

| 检查点 | 时间 | 验收标准 |
|--------|------|---------|
| 域解析基础设施完成 | 第 2 周 | 能识别题注域、交叉引用域、页码域，单测通过 |
| 题注与交叉引用完成 | 第 3 周 | 连号检测基于域，准确率 ≥ 正则版本 |
| run 级混排检测完成 | 第 3 周 | 能检测段落内局部混排，前端能高亮问题 run |
| 页眉/页脚样式检测完成 | 第 4 周 | 能检测页眉字体、下划线、页码位置 |
| 统计型检测完成 | 第 5 周 | 能检测关键词数量、摘要字数、参考文献条数 |
| 模板管理完成 | 第 6 周 | UI 支持新建/复制/重命名/删除模板 |
| 候选 diff 完成 | 第 6 周 | 能展示候选与草稿差异，支持忽略 |
| 多样本聚合完成 | 第 7 周 | 能上传多篇样本，评分反映候选质量 |
| P1 全部完成 | 第 8 周 | 所有任务完成，`pnpm run ci` 通过，文档更新 |

---

## 后续规划

P1 完成后，进入 P2（Web 体验与交付）：
1. Web Worker 解析（避免大文档阻塞 UI）
2. 批量检测（一次上传多篇，汇总报告）
3. 带批注 docx 导出（纯 OOXML 生成批注）
4. 报告与预览双向滚动
5. 高亮 run 级区间（如 P1 未完成）

详见 [`docs/TODO.md`](./TODO.md) 的 P2 部分。
