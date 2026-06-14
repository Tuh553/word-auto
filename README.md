# word-auto

Word 论文排版**合规检测**工作台。

用户上传 `.docx` → 浏览器内解析其真实格式 → 对照规则库 → 输出"哪里不合规"的可视化报告。
默认**文件不上传**，检测在本地浏览器完成。**不依赖 Microsoft Word，不使用 COM**：
直接解析 OOXML（docx = zip + XML），因此跨平台、可容器化、可并发，本地与云端同一套代码。

## 为什么不用 Word COM

COM 自动化必须装 Word、是带 UI 的单线程进程、不能并发、易卡死，且微软官方不支持
服务端自动化 Office。做 SaaS 后端只能走 OOXML 直接解析。详见 [`AGENTS.md`](./AGENTS.md)。

## 架构（pnpm monorepo）

```
packages/parser     .docx(zip+XML) → 文档模型（段落/run/样式 + 继承后的有效格式）
packages/validator  文档模型 × 规则库 → 分类、候选提取、不合规问题列表
apps/cli            命令行：跑解析 + 校验，输出报告（PoC 入口）
apps/web            纯前端工作台：检测预览 + 规则配置 + 多模板 + 模板候选提取
```

| 关注点 | 选型 |
| --- | --- |
| 解 zip | `fflate` |
| 解 XML | `fast-xml-parser` |
| 运行 TS | `tsx`（免编译） |
| 预览 | `docx-preview`（前端渲染原貌 + 叠加高亮） |

## 核心机制：样式继承解析

docx 的格式是多层继承，校验必须解析出"有效格式"：

```
直接格式(run/段落属性) → 段落样式 → basedOn 基样式链 → docDefaults
```

`packages/parser/src/resolve.ts` 沿这条链合并，得到每段的 `EffectiveProps`
（字体/字号/对齐/行距/缩进/大纲级别），单位统一换算（见 `units.ts`）。

## 运行 PoC

```bash
pnpm install
pnpm --filter @word-auto/web run dev
pnpm --filter @word-auto/cli exec tsx src/main.ts "<docx 路径>" --rules "<规则库 json 路径>"
# 可选：追加 --out "<报告文件路径>" 写入文件，否则打印到 stdout
pnpm run ci
```

CLI 不再内置任何机器相关的默认路径。`<docx>` 为必填位置参数，规则库必须显式通过
`--rules <path>` 传入；可用 `-h` / `--help` 查看帮助。

> 注意：pnpm 的脚本入口是 `pnpm run ci`；`pnpm ci` 是未实现的 pnpm 内置命令。

## 当前能力

- 解析：段落文本、样式继承、有效字体/字号/加粗/对齐/行距/首行缩进/大纲级别
- 结构化页眉/页脚：解析 `header*.xml` / `footer*.xml`，识别左/中/右基础位置与 `PAGE` 页码域
- 段落域解析：结构化识别复杂域 / 简单域，产出 `REF` / `SEQ` / `PAGEREF` / `PAGE` /
  `HYPERLINK` 等类型、`instruction`、`displayText`、`bookmark` / `sequence` 与 run 区间
- 脚注 / 尾注解析：读取 `footnotes.xml` / `endnotes.xml` 定义，回填段落内
  `w:footnoteReference` / `w:endnoteReference` 的引用位置与注释正文
- 题注 / 交叉引用关联：提取段落 `w:bookmarkStart`，建立图 / 表 / 公式 `SEQ` 域与正文
  `REF` / `PAGEREF` 域之间的书签关联图，保留题注序列名与编号片段
- 交叉引用有效性校验：检测 `REF` / `PAGEREF` 指向的书签是否缺失，或目标是否并非图 / 表 / 公式题注
- 结构信号：识别段落内 `w:drawing`、OMML 公式、`w:object` 嵌入对象，并保留所在段落定位
- 角色识别：按章节状态机判定段落语义（摘要标题/正文、关键词、目录标题、
  各级标题、正文、参考文献、后置章节、表格段落、特殊正文元素）
- 校验：字体、字号、加粗、对齐、行距、首行缩进，支持 `exact` / `oneOf` / `range` / `unset`
  规则值模式，输出分级问题（error/warn/info）
- 主题字体解析：run 用 `*Theme` 主题字体引用时，解析 `theme1.xml` 回填实际字体名
- 按脚本判断：纯中文段落不报西文字体问题，纯西文段落不报中文字体问题（降噪）
- 页面设置检测：页边距、页眉/页脚距、装订线、纸张尺寸（解析 `sectPr`，twips→cm）
- 分节页码检测：前置部分罗马数字 / 正文阿拉伯数字重起编号
- 脚注 / 尾注基础一致性检测：识别失效引用（正文引用缺定义）与孤立定义（定义未被正文引用）
- 自动编号解析：解析 `numbering.xml` 的抽象编号、编号实例与段落编号引用
- 编号连续性检测：标题题序、图题注、表题注连号校验，支持中文数字与多级编号；
  图表题注优先消费 `SEQ` 域编号，正文正则仅作无域兜底
- 列表识别：基于编号格式识别有序/无序列表，支持多级嵌套和列表项分组
- 目录条目（TOC1/2/3）与基于结构化左侧页眉的页眉内容检测；封面/扉页区自动识别并跳过
- 后置部分正式章节识别：参考文献后的致谢/附录/成果拆为独立 heading/body 角色并纳入校验
- 兼容带单位测量值（`85.05pt`/`3cm` 等），不止整数 twips
- 表格内段落提取：递归 `w:tbl>w:tr>w:tc>w:p`，标记 `inTable` / 角色 `table_cell`
- 特殊正文元素规则：图题注、表题注、资料来源、公式编号行已接入独立角色与默认规则
- 结构信号联动分类：图题注可利用 drawing 邻接信号，公式编号行可利用 OMML/对象信号，
  降低被误判为普通正文的概率
- 行距"缺失"提示：段落未显式设置行距时给出 info 级提示
- 报告可解释性：issue 可携带并展示规则库 `source.provenance` 的原始规范依据
- 修复建议：issue 携带可操作的人话指引与可修复性标记（auto 工具可改写 / manual 需人工处理），
  web 报告项展示对应标签与建议文案
- 报告聚合视图：支持按语义章节 / 角色 / 严重级 / 字段分组，组内按段落顺序或严重级排序，
  并默认联动预览定位首个可跳转问题
- 规则库可编辑模型、旧规则兼容层、规则合法性校验 `lintRuleLibrary`
- web：四步检测流程、docx-preview 预览、文本匹配高亮、规则配置页、字段值编辑、
  `mode` 切换、草稿保存、发布回灌检测、多模板切换、自定义规则库 JSON 导入/导出
- 模板候选提取 MVP：上传标准模板或样本文档 `.docx`，聚合角色字段候选值、覆盖率、
  样本数、冲突值和可信提示，候选只接受到草稿，不直接覆盖生效规则
- 工程安全网：`templates/source/*.docx` 金标准解析/分类/校验基线，parser/validator/web
  单测，GitHub Actions 质量门禁覆盖 type-check、test、build

## 剩余 TODO

集中维护在 [`docs/TODO.md`](./docs/TODO.md)。当前重点是 run 级混排、检测可解释性、
模板候选质量提升、Web 性能与交付物导出。仍然只做检测，不改写正文；自动套版属于远期高风险阶段。
