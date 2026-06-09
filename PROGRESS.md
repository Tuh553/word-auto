# PROGRESS

word-auto 进度表。**新对话先读这里**，再读 `AGENTS.md`（工程约定）与 `README.md`（架构）。
日期为绝对日期，避免"今天/上周"歧义。

## 产品定位（已定，勿反复推翻）

- 形态：**合规检测**（只读、低风险）；自动套版是远期高风险阶段。
- 部署：**纯前端**（浏览器内解析，文件不上传）→ GitHub Pages；本地=云端同一套代码。
- 栈：Node/TS + pnpm monorepo + `tsx`；前端 React + Vite。
- 引擎铁律：**绝不用 Word COM**，纯 OOXML（`fflate` + `fast-xml-parser`）。

## 已完成 ✅（截至 2026-06-09）

| 模块 | 状态 | 说明 |
| --- | --- | --- |
| monorepo 骨架 | ✅ | pnpm workspace + tsconfig + .gitignore |
| `packages/parser` | ✅ | docx→文档模型；样式继承（docDefaults→basedOn链→直接格式）；主题字体解析（theme1.xml）；单位换算 |
| `packages/validator` | ✅ | 章节状态机识别段落角色；规则比对（字体/字号/加粗/对齐/行距/首行缩进）；按 hasCJK/hasLatin 降噪 |
| `apps/cli` | ✅ | PoC 入口，跑 demo 出报告 |
| `apps/web` | ✅ | React+Vite 纯前端；四步流程（上传/选模板/配置/检测）；docx-preview 预览 + 问题高亮 |
| GitHub Pages 部署 | ✅ | `.github/workflows/deploy.yml`（push main 自动 build+deploy） |

提交节点：初始 MVP → 主题字体解析+降噪（`feat(parser): 解析主题字体...`）。

## 进行中 🔵：文档级检测(1) + 行距缺失提示(3)

> 上一轮已设计好方案、尚未落代码。以下为实现断点，照此继续。

### (1) 文档级检测：解析 `sectPr`（页边距/装订线/页眉页脚距/纸张）

数据已在规则库 `document` 段（margin_*_cm、header_distance_cm、footer_distance_cm、
gutter_cm、paper_size=A4）。

- `parser/src/types.ts`：新增 `SectionProps`（pageWidth/HeightTwips、margin{Top,Bottom,Left,Right}Twips、header/footer/gutterTwips）；`DocModel` 增 `sections: SectionProps[]`。
- `parser/src/ooxml.ts`：导出 `parseSectPr(node)`——读 `w:pgSz`(@w:w/@w:h)、`w:pgMar`(@w:top/bottom/left/right/header/footer/gutter)，复用内部 `num()`。
- `parser/src/index.ts`：收集所有 `w:sectPr`（段落 `pPr/sectPr` + body 末尾 `body/sectPr`）→ `sections.map(parseSectPr)`，取 `sections.at(-1)` 为主体节。
- `validator/src/validate.ts`：新增 `checkDocument(model, rules)`，twips→cm（`units.twipsToCm`），容差 0.05cm；纸张 A4 比对宽≈21cm/高≈29.7cm，容差 0.1cm。文档级 Issue 用 `paraIndex: -1`、`role: 'document'`、`textPreview: '页面设置'`。
- `validator/src/types.ts`：`Role` 加 `'document'`；`RuleLibrary.document` 补 header_distance_cm/footer_distance_cm/gutter_cm/paper_size 字段。
- `validateDoc` 把 `checkDocument` 结果并入 issues 与 summary。

### (3) 行距"缺失"提示

`validate.ts` 行距分支补 `else`：`rule.line_spacing_pt` 存在但 `e.lineSpacing` 为
undefined 时，push `severity: 'info'`，message「未显式设置行距（应为固定 Npt）」。

### 收尾

- `apps/cli/src/main.ts`：打印时 `paraIndex < 0` 显示「页面设置」而非 `#-1`。
- `apps/web` `ReportPanel.tsx`：`paraIndex < 0` 显示「页面设置」而非「第 N 段」。
- 跑 `pnpm --filter @word-auto/cli run check` 验证，再 `git commit`。

## 待办 ⬜（按价值/风险）

1. 分节页码：前置罗马数字 / 正文阿拉伯重起 1（解析 `sectPr/pgNumType` + footer）。
2. web 高亮定位精度（docx-preview 段落与 body 段落序号对齐偶有偏差）。
3. 多模板支持（规则库参数化，UI 已留模板下拉）。
4. （远期、高风险）自动套版改写——务必无损保留分节/域/题注/交叉引用。

## 已知坑（详见 AGENTS.md）

- 外部规则库 JSON 带 BOM（PowerShell `Set-Content -Encoding UTF8` 所致），读取要
  `.replace(/^﻿/, "")`。
- 主题字体 `a:ea` 常为空，需回退 `script="Hans"`。
- 校验字体要按段落 hasCJK/hasLatin 降噪，否则纯中文段落误报西文字体。

## 本地运行

```bash
pnpm install
pnpm --filter @word-auto/web run dev   # http://localhost:5173/
pnpm --filter @word-auto/cli run check # 命令行报告
```
