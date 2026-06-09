# PROGRESS

word-auto 进度表。**新对话先读这里**，再读 `AGENTS.md`（工程约定）与 `README.md`（架构）。
日期为绝对日期，避免"今天/上周"歧义。

## 产品定位（已定，勿反复推翻）

- 形态：**合规检测**（只读、低风险）；自动套版是远期高风险阶段。
- 部署：**纯前端**（浏览器内解析，文件不上传）→ GitHub Pages；本地=云端同一套代码。
- 栈：Node/TS + pnpm monorepo + `tsx`；前端 React + Vite。
- 引擎铁律：**绝不用 Word COM**，纯 OOXML（`fflate` + `fast-xml-parser`）。

## 已完成 ✅（截至 2026-06-09）

| 模块 | 说明 |
| --- | --- |
| monorepo 骨架 | pnpm workspace + tsconfig + .gitignore |
| `packages/parser` | docx→文档模型；样式继承（docDefaults→basedOn链→直接格式）；主题字体解析（theme1.xml）；`sectPr` 页面设置解析；单位换算 |
| `packages/validator` | 章节状态机识别角色；规则比对（字体/字号/加粗/对齐/行距/首行缩进）；按 hasCJK/hasLatin 降噪；文档级检测（页边距/页眉页脚距/装订线/纸张）；行距缺失 info 提示 |
| `apps/cli` | PoC 入口，跑 demo 出报告 + 页面设置实测 |
| `apps/web` | React+Vite 纯前端；四步流程；docx-preview 预览 + 问题高亮（页面级显示「页面设置」） |
| GitHub Pages 部署 | `.github/workflows/deploy.yml`（push main 自动 build+deploy） |

提交节点：初始 MVP → 主题字体解析+降噪 → 文档级检测+行距缺失提示。

demo 实测验证：页面设置 21×29.7cm(A4)/边距3-2.5-2.5-2.5/页眉1.6页脚1.5装订1.0，全合规；
正文「等线」命中「应为宋体」，字号 10.5≠12 命中，误报为零。

## 待办 ⬜（按价值/风险）

1. 分节页码：前置罗马数字 / 正文阿拉伯重起 1（解析 `sectPr/pgNumType` + footer XML）。
2. web 高亮定位精度（docx-preview 段落与 body 段落序号对齐偶有偏差；可改用文本匹配定位）。
3. 多模板支持（规则库参数化，UI 已留模板下拉）。
4. 目录条目（TOC1/2/3）校验；表格内段落、页眉页脚内容。
5. （远期、高风险）自动套版改写——务必无损保留分节/域/题注/交叉引用。

## 已知坑（详见 AGENTS.md）

- 外部规则库 JSON 带 BOM（PowerShell `Set-Content -Encoding UTF8` 所致），读取要
  `.replace(/^﻿/, "")`。
- 主题字体 `a:ea` 常为空，需回退 `script="Hans"`。
- 校验字体要按段落 hasCJK/hasLatin 降噪，否则纯中文段落误报西文字体。
- 单位：字号 half-point(/2)、缩进/边距 twips、行距 auto 为倍数(/240)、exact/atLeast 为 pt(/20)。

## 本地运行

```bash
pnpm install
pnpm --filter @word-auto/web run dev   # http://localhost:5173/
pnpm --filter @word-auto/cli run check # 命令行报告
```
