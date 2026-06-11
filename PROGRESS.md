# PROGRESS

word-auto 进度表。**新对话先读这里**，再读 `AGENTS.md`（工程约定）与 `README.md`（架构）。
日期为绝对日期，避免"今天/上周"歧义。

## 产品定位（已定，勿反复推翻）

- 形态：**合规检测**（只读、低风险）；自动套版是远期高风险阶段。
- 部署：**纯前端**（浏览器内解析，文件不上传）→ GitHub Pages；本地=云端同一套代码。
- 栈：Node/TS + pnpm monorepo + `tsx`；前端 React + Vite。
- 引擎铁律：**绝不用 Word COM**，纯 OOXML（`fflate` + `fast-xml-parser`）。

## 已完成 ✅（截至 2026-06-11）

| 模块 | 说明 |
| --- | --- |
| `packages/parser` | docx→文档模型；样式继承；主题字体；`sectPr` 页面设置；带单位测量值；分节页码；页眉文本；**表格内段落提取（`inTable` / `table_cell`）** |
| `packages/validator` | 角色识别（封面区跳过 + TOC1/2/3 + `table_cell`）；规则比对；按脚本降噪；文档级检测（页边距/页眉页脚距/装订线/纸张）；分节页码；页眉内容；行距缺失提示；**可编辑规则模型 + 旧规则兼容层**；**规则合法性校验 `lintRuleLibrary`**；单元测试（`node:test`，23 例） |
| `apps/cli` | PoC：报告 + 页面/页码实测；可传 docx/规则库路径 |
| `apps/web` | React+Vite 纯前端；四步流程；docx-preview 预览 + 文本匹配高亮（见下，已攻克渲染问题）；**规则配置页骨架**（视图切换 + 角色列表 + 字段编辑 + 实时 `lintRuleLibrary` 校验） |
| 标准模板 | `templates/source/*.docx`，校准依据 + 检测金标准 |
| 部署 | `.github/workflows/deploy.yml`（push main 自动 GitHub Pages） |

验证结果（2026-06-11）：
- `pnpm test`：23/23 通过
- `pnpm -r build`：通过

## ✅ web 预览（已解决 — chrome-devtools 自查验证）

历经多轮，最终用 chrome-devtools MCP 打开页面、截图、量 DOM，定位根因并修复：
- **重影**：`<StrictMode>` 双 effect + renderAsync 并发渲染同容器 → 渲染到游离节点、
  完成后 `replaceChildren` + `stale` 标志丢弃过期渲染。
- **文字重叠塌缩**（"十几页压到几页"真因）：docx-preview 对标准模板**固定行距**算出
  `line-height≈1pt`(1.33px)，行高仅字高 1/12 → 挂载后扫描，凡**行高<字高**(必重叠)的元素
  重置 `line-height:normal`，正常行距(≥字高)不动。
- **高亮错位**：改为**段落原文文本匹配**定位（不再用 DOM 序号），验证点击准确高亮对应段。
- **配置**：退回 docx-preview **默认选项**，勿再覆盖 `ignoreHeight/breakPages/experimental`。
- 验证结果：标准模板预览清晰可读、点问题准确滚动高亮到对应段落。

环境备忘：
- chrome-devtools MCP 配置须**无 `--auto-connect`**（它与新版 Chrome 默认 profile 禁远程调试
  冲突）；现为 user config 自启隔离 Chrome。
- `upload_file` 受 workspace root 限制（root = `E:\Claude code\docs`）；上传 word-auto 外的
  文件需先复制到该 root 内（如 `docs/output/`）。

## 待办 ⬜（按价值/风险）

> 主线（多模板规则库可视化，见 `docs/plans/2026-06-09-rule-library-and-template-implementation-plan.md`）：
> 阶段 1 模型/兼容层 + 阶段 3 合法性校验 `lintRuleLibrary`/测试 + 阶段 4 配置页骨架（视图切换/角色列表/字段编辑/实时校验）已完成 ✅；
> 下一步 = 字段值编辑控件（数值/字体/枚举/范围）+ 规则方式 `mode` 切换 + 草稿/发布态（阶段 2，发布后回灌检测）。

1. 多模板支持：web 上传自定义规则库 JSON（去 BOM + 校验 styles）。
2. 规则配置闭环：字段值编辑控件、`mode` 切换、草稿/发布态，以及发布后回灌检测链路。
3. 特殊正文元素识别：图表注释/资料来源(9pt)、公式编号，避免按正文 12pt 误报。
4. 表格增强：当前已提取表格段落，但未保留表格与正文的全局交错顺序；表格专属规则/降噪待做。
5. 参考文献后致谢/附录被当 `reference_body`（状态机停在 `references`）。
6. 预览：封面页(不检测)在 docx-preview 下仍可能排版偏差，但不影响核心；可考虑默认定位到首个问题。
7. （远期、高风险）自动套版改写——务必无损保留分节/域/题注/交叉引用。

## 已知坑（详见 AGENTS.md）

- 外部规则库 JSON 带 BOM（PowerShell `Set-Content -Encoding UTF8` 所致），读取要 strip。
- 主题字体 `a:ea` 常为空，需回退 `script="Hans"`。
- 校验字体要按段落 hasCJK/hasLatin 降噪。
- 测量值可能带单位（pt/cm/mm/in），不只整数 twips——用 `measureToTwips`。
- docx-preview 不做自动分页(只认显式分页符)、且对固定行距可能算出极小行高——已在 PreviewPanel 修补。

## 本地运行

```bash
pnpm install
pnpm --filter @word-auto/web run dev    # http://localhost:5173/（被占用会顺延 5174/5175）
pnpm --filter @word-auto/cli run check  # demo 报告
pnpm --filter @word-auto/cli exec tsx src/main.ts "<docx 绝对路径>"  # 任意文档
```
