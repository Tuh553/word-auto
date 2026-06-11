# word-auto

Word 论文排版**合规检测**平台（第一阶段）。

用户上传 `.docx` → 浏览器内解析其真实格式 → 对照规则库 → 输出"哪里不合规"的可视化报告。
默认**文件不上传**，检测在本地浏览器完成。**不依赖 Microsoft Word，不使用 COM**：
直接解析 OOXML（docx = zip + XML），因此跨平台、可容器化、可并发，本地与云端同一套代码。

## 为什么不用 Word COM

COM 自动化必须装 Word、是带 UI 的单线程进程、不能并发、易卡死，且微软官方不支持
服务端自动化 Office。做 SaaS 后端只能走 OOXML 直接解析。详见 [`AGENTS.md`](./AGENTS.md)。

## 架构（pnpm monorepo）

```
packages/parser     .docx(zip+XML) → 文档模型（段落/run/样式 + 继承后的有效格式）
packages/validator  文档模型 × 规则库 → 不合规问题列表（定位 + 期望值 vs 实际值）
apps/cli            命令行：跑解析 + 校验，输出报告（PoC 入口）
apps/web            纯前端工作台：上传 + docx-preview 预览 + 高亮报告 + 规则配置骨架
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
pnpm --filter @word-auto/cli run check
# 或指定文件： tsx apps/cli/src/main.ts <docx 路径> <规则库 json 路径>
```

默认读取 `E:/Claude code/docs` 里的 demo 文档与规则库，输出
`apps/cli/output/report.json`。

## 当前能力

- 解析：段落文本、样式继承、有效字体/字号/加粗/对齐/行距/首行缩进/大纲级别
- 角色识别：按章节状态机判定段落语义（摘要标题/正文、关键词、目录标题、
  各级标题、正文、参考文献）
- 校验：字体、字号、加粗、对齐、行距、首行缩进，输出分级问题（error/warn/info）
- 主题字体解析：run 用 `*Theme` 主题字体引用时，解析 `theme1.xml` 回填实际字体名
- 按脚本判断：纯中文段落不报西文字体问题，纯西文段落不报中文字体问题（降噪）
- 页面设置检测：页边距、页眉/页脚距、装订线、纸张尺寸（解析 `sectPr`，twips→cm）
- 分节页码检测：前置部分罗马数字 / 正文阿拉伯数字重起编号
- 目录条目（TOC1/2/3）与页眉内容检测；封面/扉页区自动识别并跳过
- 兼容带单位测量值（`85.05pt`/`3cm` 等），不止整数 twips
- 表格内段落提取：递归 `w:tbl>w:tr>w:tc>w:p`，标记 `inTable` / 角色 `table_cell`
- 行距"缺失"提示：段落未显式设置行距时给出 info 级提示
- 规则库可编辑模型、旧规则兼容层、规则合法性校验 `lintRuleLibrary`
- web：四步检测流程、docx-preview 预览、文本匹配高亮、规则配置页骨架

## 已知限制（下一步）

- **多模板**：目前内置重庆模板，尚未支持上传自定义规则库。
- **规则配置未闭环**：前端已能编辑角色字段/严重级别并实时 lint，但尚未回灌检测链路。
- **特殊正文元素**：图表注释/资料来源(9pt)、公式编号暂按正文校验（会误报）。
- **表格顺序**：表格内段落已提取，但未保留表格与正文的全局交错顺序；表格专属规则/降噪待做。
- **章节尾部识别**：参考文献后的致谢/附录仍会被当作 `reference_body`。
- 仅检测，不改写文档（自动套版是后续高风险阶段）。
