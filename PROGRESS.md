# PROGRESS

word-auto 进度表。**新对话先读这里**，再读 `AGENTS.md`（工程约定）与 `README.md`（架构）。
日期为绝对日期，避免"今天/上周"歧义。

## 产品定位（已定，勿反复推翻）

- 形态：**合规检测**（只读、低风险）；自动套版是远期高风险阶段。
- 部署：**纯前端**（浏览器内解析，文件不上传）→ GitHub Pages；本地=云端同一套代码。
- 栈：Node/TS + pnpm monorepo + `tsx`；前端 React + Vite。
- 引擎铁律：**绝不用 Word COM**，纯 OOXML（`fflate` + `fast-xml-parser`）。

## 已完成 ✅（截至 2026-06-20）

| 模块 | 说明 |
| --- | --- |
| `packages/parser` | docx→文档模型；样式继承；**run 级有效格式（每个 run 继承 docDefaults / 样式链 / 段落标记格式 / run 直接格式）**；主题字体；`sectPr` 页面设置；带单位测量值；分节页码；**结构化页眉/页脚解析（左/中/右基础位置 + `PAGE` 页码域）**；**段落域解析（复杂域 / 简单域，输出 `REF` / `SEQ` / `PAGEREF` / `PAGE` / `HYPERLINK` 等类型、显示文本与 run 区间）**；**段落书签提取（`w:bookmarkStart`）**；**脚注 / 尾注解析（`footnotes.xml` / `endnotes.xml` 定义 + 段落 `w:footnoteReference` / `w:endnoteReference` 引用位置与正文回填）**；**`numbering.xml` 自动编号解析（abstractNum / num / numPr）**；**表格内段落按文档流顺序提取并标记 `inTable` / `table_cell`**；**段落结构信号定位（`w:drawing` / OMML / `w:object`）**；**解析错误分流（`NOT_ZIP` / `ENCRYPTED` / `LEGACY_DOC` / `CORRUPT` / `NOT_DOCX`）** |
| `packages/validator` | 角色识别（封面区跳过 + TOC1/2/3 + `table_cell` + **特殊正文元素独立角色** + **致谢/附录/成果正式后置章节角色** + **附录内部小标题 / 清单 / 落款细分角色** + **结构化置信度 `high`/`medium`/`low`**）；规则比对；按脚本降噪；**run 级混排检测（局部字体/字号异常定位到 run 区间并输出 `affectedText`）**；文档级检测（页边距/页眉页脚距/装订线/纸张）；分节页码；**基于结构化左侧页眉的页眉内容检测**；**页眉/页脚样式检测（字体、字号、页眉线、页码位置/字体/字号）**；**统计型文档检测（关键词数量、摘要字数/词数、参考文献条数、外文占比）**；行距缺失提示；**标题题序连续性检测**；**图表题注连号校验（优先使用 `SEQ` 域编号，正则仅作无域兜底）**；**题注-交叉引用关联图（图 / 表 / 公式 `SEQ` ↔ `REF` / `PAGEREF`）**；**`REF` / `PAGEREF` 有效性校验（缺失书签 / 非题注目标书签）**；**脚注 / 尾注基础一致性校验（失效引用、孤立定义）**；**列表识别**；**图题注 drawing 邻接 / 公式对象信号联动分类**；**issue 透传规则依据 `source.provenance`、角色置信度与修复建议**；**可编辑规则模型 + 旧规则兼容层**；**规则合法性校验 `lintRuleLibrary`**；**模板候选提取 `extractRuleProposal`（含低置信样本 notice、结构化样本证据与只读 diff helper）**；核心分类、lint、修复建议与编号检测已拆出辅助函数降低复杂度 |
| `apps/cli` | PoC：报告 + 页面/页码实测；`parseArgs` 参数解析；`--help` / `--rules` / `--out`；中文错误输出；非零退出码；规则库 BOM strip |
| `apps/web` | React 18.3.1 + Vite 6 纯前端；四步流程；**Web Worker 解析/检测**；docx-preview 预览 + 文本匹配高亮（见下，已攻克渲染问题）；**run 级 / 片段级 issue 会优先高亮目标段落内的 `affectedText`，找不到片段时回退整段高亮**；**重复片段与同段多 issue 已按“严重级优先 -> 当前可见排序 -> 失败回退整段”的固定策略稳定处理**；**报告与预览双向联动（报告点击滚动预览、预览点击反选报告、预览滚动自动切换当前可见 issue，并带程序滚动抑制窗口避免抖动）**；**预览点击当前片段 marker 可直接选中对应 issue，点击段内非片段区域时仅在当前可见 issue 集中稳定选中 1 个问题**；规则配置页；字段值编辑；`mode` 切换；草稿保存/发布；发布后回灌检测；**多模板管理（切换、新建、复制、重命名、删除自定义模板；内置模板不可删除）**；自定义规则库 JSON 导入/导出；**模板候选面板（候选 diff、证据下钻、持久忽略、低置信样本提示）**；**报告项可展开查看规范依据 provenance**；**报告项展示修复建议与可修复性标签**；**低置信角色识别 issue 显著提示**；**报告支持按语义章节 / 角色 / 严重级 / 字段分组与组内排序，并默认定位首个问题**；**上传/候选提取错误分流中文提示**；`App` 已瘦身为导航和编排，检测、规则库、候选提取分别拆入 `useDetectionFlow` / `useRuleLibraries` / `useRuleProposals`，UI 拆为 `DetectWorkspace` / `RulesWorkspace` / 规则字段子组件 |
| 标准模板 | `templates/source/*.docx`，校准依据 + 检测金标准 |
| 部署/CI | `.github/workflows/deploy.yml`（push main 自动 GitHub Pages）；`.github/workflows/quality.yml`（PR/push 运行 typecheck、lint、knip、jscpd、test、build） |

验证结果（2026-06-20）：
- `pnpm typecheck`：通过（parser / validator / cli / web）
- `pnpm test`：通过（parser 26/26，validator 103/103，web 48/48；总计 177/177）
- `pnpm -r build`：通过
- `pnpm run ci`：通过（串联 typecheck → lint → knip → jscpd → test → build）
- CLI smoke：
  `node --import tsx apps/cli/src/main.ts --help` 返回 0 并打印用法；
  非 `.docx` 输入返回 1 并输出中文错误；
  `--out` 成功写入文本报告
- 注意：`pnpm ci` 不是脚本入口，会触发 pnpm 的未实现内置命令；应使用 `pnpm run ci`。

## ✅ web 预览（已解决 — chrome-devtools 自查验证）

历经多轮，最终用 chrome-devtools MCP 打开页面、截图、量 DOM，定位根因并修复：
- **重影**：`<StrictMode>` 双 effect + renderAsync 并发渲染同容器 → 渲染到游离节点、
  完成后 `replaceChildren` + `stale` 标志丢弃过期渲染。
- **文字重叠塌缩**（"十几页压到几页"真因）：docx-preview 对标准模板**固定行距**算出
  `line-height≈1pt`(1.33px)，行高仅字高 1/12 → 挂载后扫描，凡**行高<字高**(必重叠)的元素
  重置 `line-height:normal`，正常行距(≥字高)不动。
- **高亮错位**：改为**段落原文文本匹配**定位（不再用 DOM 序号），验证点击准确高亮对应段。
- **片段高亮**：选中带 `affectedText` 的 run 级 issue 时，仅在已定位的目标段落内匹配并高亮片段；
  片段找不到时明确回退到整段高亮，避免跨文档误命中。
- **重复片段策略**：若同一选中 issue 在目标段落内命中多个相同 `affectedText`，不做模糊猜测，稳定回退整段高亮；段内非片段点击则按“严重级优先、当前可见顺序次之”稳定选中 issue。
- **双向联动**：报告点击会滚动并高亮预览；预览点击有 issue 的段落或片段会反选报告；手动滚动预览时会在当前可见 issue 中按“中心优先、顶部回退”稳定切换报告选中项。
- **防反馈循环**：报告触发的程序滚动会进入短暂抑制窗口，避免滚动监听在平滑滚动中反复改选 issue；用户主动滚动只更新报告选中，不会把预览再次拉回。
- **配置**：退回 docx-preview **默认选项**，勿再覆盖 `ignoreHeight/breakPages/experimental`。
- 验证结果：标准模板预览清晰可读、点问题准确滚动高亮到对应段落。

环境备忘：
- chrome-devtools MCP 配置须**无 `--auto-connect`**（它与新版 Chrome 默认 profile 禁远程调试
  冲突）；现为 user config 自启隔离 Chrome。
- `upload_file` 受 workspace root 限制（root = `E:\Claude code\docs`）；上传 word-auto 外的
  文件需先复制到该 root 内（如 `docs/output/`）。

## 待办 ⬜（集中维护）

完整 TODO 已整理到 [`docs/TODO.md`](docs/TODO.md)。当前优先级摘要：

1. Web 体验：批量检测、带批注 docx 导出，以及继续打磨报告与预览联动细节（如更细的 run 级局部高亮可视反馈）。
2. CLI 增强后的回归：继续补 CLI 级测试或 smoke 基线，避免后续参数行为回退。
3. （远期、高风险）自动套版改写——务必无损保留分节、域、题注、交叉引用、编号，绝不引入 Word COM。

## 已知坑（详见 AGENTS.md）

- 外部规则库 JSON 带 BOM（PowerShell `Set-Content -Encoding UTF8` 所致），读取要 strip。
- 主题字体 `a:ea` 常为空，需回退 `script="Hans"`。
- 校验字体要按段落 hasCJK/hasLatin 降噪。
- 测量值可能带单位（pt/cm/mm/in），不只整数 twips——用 `measureToTwips`。
- 页眉/页脚已基础结构化并接入常用样式检测；左/右识别支持对齐、制表符和长空白分隔。
- 表格段落已按文档流顺序保留；表格单元格段落仍标记 `inTable` 并由 validator 识别为 `table_cell`。
- 当前标准模板已包含 1 条脚注样本，可用于脚注引用位置 / 正文回填基线；正文域样本仍缺失，
  题注 / 交叉引用关联回归主要靠 synthetic docx + “真实模板 0 field 回归” 双重校验。
- 自动编号已解析并接入连续性检测；后续涉及编号语义时要同步更新编号金标准测试。
- OMML / 嵌入对象当前只做**存在性与段落定位**，还未展开公式语义与对象内部文本。
- docx-preview 不做自动分页(只认显式分页符)、且对固定行距可能算出极小行高——已在 PreviewPanel 修补。

## 本地运行

```bash
pnpm install
pnpm --filter @word-auto/web run dev    # http://localhost:5173/（被占用会顺延 5174/5175）
pnpm --filter @word-auto/cli exec tsx src/main.ts "<docx 绝对路径>" --rules "<规则库 json 路径>"
pnpm --filter @word-auto/cli exec tsx src/main.ts "<docx 绝对路径>" --rules "<规则库 json 路径>" --out "output/report.txt"
```
