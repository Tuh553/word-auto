# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added

- **Web 报告复制 MVP**：检测结果页新增“复制修改清单”和“复制修订建议卡片”入口，分别基于当前 severity 筛选后的可见 issue 列表与当前选中 issue 生成外部沟通可直接粘贴的中文文本
- **报告复制纯函数与测试**：新增 `reportCopy.ts`，统一收口可见 issue 顺序、卡片目标解析、文本格式化与剪贴板写入；补齐单条卡片、修改清单、文档级 issue、空列表与 selected fallback 测试
- **预览同段多 issue 稳定命中模型**：Web 预览为同一段落保留当前可见 issue 列表，点击段内非片段区域时按“严重级优先 -> 当前可见顺序”稳定反选报告项
- **重复片段 fallback 策略**：当同一选中 issue 的 `affectedText` 在目标段落内重复出现时，不再模糊猜测命中区域，而是稳定回退整段高亮
- **预览联动纯函数测试补强**：新增重复片段、同段多 issue、筛选后可见目标和报告 selected helper 回归测试
- **Web 报告与预览双向联动**：支持报告点击滚动预览、预览点击反选报告，以及预览滚动按当前可见 issue 自动切换报告选中项
- **预览滚动命中策略 helper**：新增“中心优先、顶部回退”的纯函数，用于从当前视口内候选段落稳定选中 issue
- **numbering.xml 自动编号解析**：实现完整的 OOXML numbering.xml 解析，支持抽象编号定义（abstractNum）、编号实例（num）和段落编号引用（numPr）
- **标题题序连续性检测**：自动检测各级标题编号连续性（1→2→3），支持中文数字（第一章→第二章）和多级编号（1.1→1.2），章节变化时自动重置下级计数器
- **图表题注连号校验**：检测图题注和表题注编号连续性，支持单级编号（图1→图2）和两级编号（图1-1→图1-2→图2-1），主编号变化时检测次编号重置
- **题注交叉引用有效性校验**：基于既有 `caption-reference graph` 检测 `REF` / `PAGEREF` 缺失书签与非题注目标书签，并输出结构化 issue
- **脚注 / 尾注解析与基础校验**：解析 `footnotes.xml` / `endnotes.xml` 注释定义，回填段落引用位置与正文，并检测失效引用 / 孤立定义
- **列表识别**：基于 numFmt 判断有序/无序列表（bullet→无序，decimal/roman→有序），支持多级嵌套和列表项分组
- **页眉/页脚结构化解析**：解析 `header*.xml` / `footer*.xml`，输出左/中/右基础位置、页脚纯文本与 `PAGE` 页码域识别，保留旧 `headers` 纯文本兼容字段
- **页眉/页脚样式校验**：校验页眉中文/西文字体、字号、页眉下边框，以及页码位置、页码西文字体和字号
- **run 级混排检测**：段落内局部 run 字体/字号不合规时输出片段定位，报告展示受影响文本范围
- **Web 预览片段级高亮**：选中带 `affectedText` 的 run 级 issue 时，在已定位段落内优先高亮对应片段，片段找不到时回退整段高亮
- **表格全局顺序保留**：parser 按 OOXML 文档流输出正文与表格段落，表格段落继续标记 `inTable` 并分类为 `table_cell`
- **附录细分角色识别**：validator 在附录上下文内识别附录小标题、材料/条目清单、落款或日期署名段落；表格段落仍优先为 `table_cell`
- **代码审查报告**：通过 Claude Code 内置代码审查（extra-high effort，9个角度），发现并修复 7 个关键问题（详见 `code-review-findings.json`）

### Changed

- **Web 报告工具栏语义统一**：报告面板现在通过共用 helper 复用“当前筛选后可见 issue”和 `resolveSelectedIssue` 语义，复制、预览联动与报告选中不再各自维护目标解析逻辑
- **Web 预览目标数据结构**：`buildPreviewIssueTargets` 和 `buildPreviewHighlightTarget` 现在显式携带同段当前可见 issue 集，供片段高亮、段级点击和筛选后反向联动复用
- **Web 检测测试入口扩展**：`@word-auto/web` 测试脚本从 `src/lib/*.test.ts` 扩展到 `src/**/*.test.ts`，允许组件级轻测试纳入门禁
- **类型系统扩展**：
  - `Paragraph` 新增 `numbering?: ParagraphNumbering` 字段
  - `DocModel` 新增 `numbering: NumberingDefinitions` 字段
  - `DocModel` 新增结构化 `headerParts` / `footerParts` 输出，并保留旧 `headers` 纯文本字段
  - `Role` 类型新增 `"heading"` 和 `"unknown"` 枚举值
  - `Role` 类型新增 `"appendix_subheading"`、`"appendix_list_item"`、`"appendix_signature"` 枚举值
  - `ClassifiedParagraph` 的 `role` 字段改为可空类型（`Role | null`）
  - `ValidationIssue` 的 `role` 字段收窄为严格 `Role` 类型
- **run 有效格式解析**：`Paragraph.runs` 增加继承后的 `effective`，供正文混排检测和页眉/页脚片段样式检测复用
- **页眉内容检测迁移**：`headers.left_text` 优先匹配结构化左侧页眉，仅在旧模型没有结构化页眉时回退纯文本
- **页眉/页脚解析增强**：`headerParts` / `footerParts` 的段落和片段现在携带有效字体、字号，并解析 `w:pBdr/w:bottom` 页眉线
- **校验流程集成**：`validateDoc` 自动调用编号连续性检测，编号问题统一输出到 `ValidationReport`
- **题注连号策略明确**：图 / 表题注优先消费 `SEQ` 域编号，段落正则仅作为无域样本兜底
- **测试基线更新**：新增 parser `PAGEREF` synthetic 用例与 validator 引用有效性用例，标准模板当前仍保留 1 个表题注连号问题
- **测试基线更新**：补充预览滚动命中、报告选中定位和预览点击反向选中的 Web 回归测试
- **数据流统一**：`classified` 数组与主校验循环对 undefined 角色的处理逻辑统一（均跳过）
- **标准模板分类基线更新**：3 个附录清单项从 `appendix_body` 拆出为 `appendix_list_item`，总 issue 数和严重级别不变

### Fixed

- **run 级局部高亮误命中**：修复长段落或重复 `affectedText` 下可能误高亮错误区域的问题；无法可靠区分时稳定回退整段
- **同段多个 issue 反向联动歧义**：修复预览点击同一段时可能误选同段其他 issue 的问题，改为固定且可预测的优先级策略
- **预览联动抖动**：修复报告点击触发预览平滑滚动时，滚动监听可能反向改选 issue 导致的联动反馈循环
- **筛选后反向联动越界**：预览点击和滚动反选现在只针对当前可见 issue 集合，不会误选已筛掉的问题
- **预览滚动回跳**：用户手动滚动预览时，报告切换选中项不再重新触发预览跳转，高亮保留但视口不被拉回
- **章节切换逻辑缺陷**：修复图/表题注检测中章节变化时未重置 `lastMajor` 的 bug，避免跨章节编号误报
- **排序键冲突**：修复 `ROLE_ORDER` 中 `acknowledgement_heading/body` 与 `reference_heading/body` 使用相同排序值的问题
- **类型安全**：移除 `ValidationIssue` 到 `Issue` 转换中的 `as any` 类型断言，收窄类型定义避免运行时错误
- **空值防护**：在编号检测函数中添加 `cp.role` null 检查，支持未分类段落
- 修复标准模板中跨章标题题序误报；当前仅保留真实的 `table_caption` 连号问题
- **XML 空白保留**：关闭 XML 解析 trim，避免 `xml:space` 中的页眉分隔空白被丢弃，支撑左右页眉识别

### Performance

- **正则表达式优化**：将 `extractNumber` 和 `extractCaptionNumber` 中的 6 个正则表达式提取为模块级常量，避免热路径中重复创建对象（200个标题场景下减少 1000 次对象创建）

### Refactored

- **消除代码重复**：提取 `checkCaptionSequence` 通用函数，消除 `checkFigureCaptionSequence` 和 `checkTableCaptionSequence` 之间 97% 的重复代码（净减少 96 行）
- **Web 工作台拆分**：将 `App.tsx` 中的检测流程、规则库状态、模板候选提取拆入
  `useDetectionFlow` / `useRuleLibraries` / `useRuleProposals`，页面拆为 `DetectWorkspace`
  与 `RulesWorkspace`
- **规则配置组件拆分**：将 `RuleConfigPanel` 拆为 toolbar、summary、字段面板、字段卡片与共享格式化 helper
- **validator 结构整理**：拆分 `classify`、`fixhints`、`lint`、`numbering-check` 中的热路径辅助函数，降低单函数复杂度并保持既有行为

### Technical Details

**新增文件**：
- `packages/parser/src/numbering.ts` - numbering.xml 解析引擎
- `packages/parser/src/headerFooter.ts` - 页眉/页脚结构化解析
- `packages/parser/src/documentFlow.ts` - 按文档流顺序收集正文与表格段落
- `packages/validator/src/numbering-check.ts` - 编号连续性检测
- `packages/validator/src/list-recognition.ts` - 列表识别
- `packages/validator/src/numbering-check.test.ts` - 编号检测测试（12个用例）
- `packages/validator/src/list-recognition.test.ts` - 列表识别测试（6个用例）
- `packages/parser/src/headerFooter.test.ts` - 页眉/页脚结构化解析测试（2个用例）
- `code-review-findings.json` - 代码审查发现的 15 个问题详细报告
- `apps/web/src/components/DetectWorkspace.tsx` - 检测四步流程 UI
- `apps/web/src/components/RulesWorkspace.tsx` - 规则配置与候选提取工作区
- `apps/web/src/components/RuleConfigFieldCard.tsx` - 单字段规则编辑卡片
- `apps/web/src/components/RuleConfigPanelSections.tsx` - 规则配置 toolbar / summary / role-field pane
- `apps/web/src/components/ruleConfigShared.ts` - 规则值格式化、模式切换、输入解析 helper
- `apps/web/src/hooks/useDetectionFlow.ts` - 检测流程状态与动作
- `apps/web/src/components/PreviewPanel.test.ts` - 预览点击反向选中轻测试
- `apps/web/src/hooks/useRuleLibraries.ts` - 规则库草稿、发布、导入导出状态与动作
- `apps/web/src/hooks/useRuleProposals.ts` - 模板候选提取与接受动作
- `apps/web/src/lib/previewHighlight.ts` - Web 预览段落与片段匹配 helper
- `apps/web/src/lib/previewHighlight.ts` - 增加预览滚动命中 issue 与预览点击 issueKey 解析 helper

**修改文件**：
- `packages/parser/src/index.ts`, `types.ts`, `ooxml.ts` - 集成编号解析与结构化页眉页脚输出
- `packages/validator/src/index.ts`, `types.ts`, `validate.ts`, `rules.ts`, `numbering-check.ts` - 集成编号检测与结构化页眉检测
- `packages/validator/src/*.test.ts` - 更新测试基线
- `apps/web/src/lib/reportGroups.ts` - 支持编号字段分组、预览片段目标选择并修复排序冲突
- `apps/web/src/App.tsx`, `PreviewPanel.tsx`, `ReportPanel.tsx`, `DetectWorkspace.tsx`, `RuleConfigPanel.tsx`, `TemplateProposalPanel.tsx` - 组件瘦身、双向联动与 shared helper 复用
- `packages/validator/src/classify.ts`, `fixhints.ts`, `lint.ts`, `numbering-check.ts` - 保持行为不变的结构拆分

**测试覆盖**：
- parser: 26 个测试 ✅
- validator: 103 个测试 ✅
- web: 48 个测试 ✅
- **总计 177 个测试全部通过**

**质量保证**：
- 类型检查：`pnpm typecheck` ✅
- ESLint：`pnpm lint` ✅（`--max-warnings 0`）
- 未用代码检查：`pnpm knip` ✅
- 复制粘贴检查：`pnpm jscpd` ✅（0 clones）
- 单元测试：`pnpm test` ✅（177/177）
- 构建验证：`pnpm build` ✅
- CI 门禁：`pnpm run ci` ✅
- 代码审查：Claude Code extra-high effort（9个角度 × 72候选）✅

**代码统计**：
- 新增代码：~1200 行（含测试 ~360 行）
- 修改文件：20+ 个
- 新增文件：8 个
- 净减少代码：96 行（通过重构消除重复）

**注**：原计划使用 codex review（gpt-5.3-codex），但该模型已弃用（当前最新为 gpt-5.4），最终使用 Claude Code 内置代码审查完成质量保证。
