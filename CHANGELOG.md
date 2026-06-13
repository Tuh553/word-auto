# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added

- **numbering.xml 自动编号解析**：实现完整的 OOXML numbering.xml 解析，支持抽象编号定义（abstractNum）、编号实例（num）和段落编号引用（numPr）
- **标题题序连续性检测**：自动检测各级标题编号连续性（1→2→3），支持中文数字（第一章→第二章）和多级编号（1.1→1.2），章节变化时自动重置下级计数器
- **图表题注连号校验**：检测图题注和表题注编号连续性，支持单级编号（图1→图2）和两级编号（图1-1→图1-2→图2-1），主编号变化时检测次编号重置
- **列表识别**：基于 numFmt 判断有序/无序列表（bullet→无序，decimal/roman→有序），支持多级嵌套和列表项分组
- **代码审查报告**：通过 Claude Code 内置代码审查（extra-high effort，9个角度），发现并修复 7 个关键问题（详见 `code-review-findings.json`）

### Changed

- **类型系统扩展**：
  - `Paragraph` 新增 `numbering?: ParagraphNumbering` 字段
  - `DocModel` 新增 `numbering: NumberingDefinitions` 字段
  - `Role` 类型新增 `"heading"` 和 `"unknown"` 枚举值
  - `ClassifiedParagraph` 的 `role` 字段改为可空类型（`Role | null`）
  - `ValidationIssue` 的 `role` 字段收窄为严格 `Role` 类型
- **校验流程集成**：`validateDoc` 自动调用编号连续性检测，编号问题统一输出到 `ValidationReport`
- **测试基线更新**：测试用例从 65 个增加到 83 个，新增编号检测问题从 86 个增至 91 个（+5 个编号错误）
- **数据流统一**：`classified` 数组与主校验循环对 undefined 角色的处理逻辑统一（均跳过）

### Fixed

- **章节切换逻辑缺陷**：修复图/表题注检测中章节变化时未重置 `lastMajor` 的 bug，避免跨章节编号误报
- **排序键冲突**：修复 `ROLE_ORDER` 中 `acknowledgement_heading/body` 与 `reference_heading/body` 使用相同排序值的问题
- **类型安全**：移除 `ValidationIssue` 到 `Issue` 转换中的 `as any` 类型断言，收窄类型定义避免运行时错误
- **空值防护**：在编号检测函数中添加 `cp.role` null 检查，支持未分类段落
- 修复标准模板中的标题编号跳号问题（heading2/heading3 各2个，table_caption 1个）

### Performance

- **正则表达式优化**：将 `extractNumber` 和 `extractCaptionNumber` 中的 6 个正则表达式提取为模块级常量，避免热路径中重复创建对象（200个标题场景下减少 1000 次对象创建）

### Refactored

- **消除代码重复**：提取 `checkCaptionSequence` 通用函数，消除 `checkFigureCaptionSequence` 和 `checkTableCaptionSequence` 之间 97% 的重复代码（净减少 96 行）

### Technical Details

**新增文件**：
- `packages/parser/src/numbering.ts` - numbering.xml 解析引擎
- `packages/validator/src/numbering-check.ts` - 编号连续性检测
- `packages/validator/src/list-recognition.ts` - 列表识别
- `packages/validator/src/numbering-check.test.ts` - 编号检测测试（12个用例）
- `packages/validator/src/list-recognition.test.ts` - 列表识别测试（6个用例）
- `code-review-findings.json` - 代码审查发现的 15 个问题详细报告

**修改文件**：
- `packages/parser/src/index.ts`, `types.ts` - 集成编号解析
- `packages/validator/src/index.ts`, `types.ts`, `validate.ts`, `rules.ts` - 集成编号检测
- `packages/validator/src/*.test.ts` - 更新测试基线
- `apps/web/src/lib/reportGroups.ts` - 支持编号字段分组并修复排序冲突

**测试覆盖**：
- parser: 11 个测试 ✅
- validator: 59 个测试 ✅（新增 18 个）
- web: 13 个测试 ✅
- **总计 83 个测试全部通过**

**质量保证**：
- 类型检查：`pnpm typecheck` ✅
- 单元测试：`pnpm test` ✅（83/83）
- 构建验证：`pnpm build` ✅
- CI 门禁：`pnpm run ci` ✅
- 代码审查：Claude Code extra-high effort（9个角度 × 72候选）✅

**代码统计**：
- 新增代码：~990 行（含测试 ~310 行）
- 修改文件：17 个
- 新增文件：6 个
- 净减少代码：96 行（通过重构消除重复）

**注**：原计划使用 codex review（gpt-5.3-codex），但该模型已弃用（当前最新为 gpt-5.4），最终使用 Claude Code 内置代码审查完成质量保证。