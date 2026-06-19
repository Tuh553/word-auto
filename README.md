# word-auto

📄 Word 论文排版合规检测工具

上传 `.docx` → 浏览器内解析 OOXML → 对照规则库 → 输出可视化报告。
文件不上传服务器，检测在本地浏览器完成。直接解析 OOXML（docx = zip + XML），不依赖 Microsoft Word，
跨平台、可容器化、可并发。

![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-18.3.1-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-monorepo-F69220?logo=pnpm&logoColor=white)

## ✨ 核心特性

| 特性 | 说明 |
| --- | --- |
| 🚀 无需 Office | 直接解析 OOXML，不依赖 COM 自动化 |
| 🔗 完整样式解析 | 处理多层继承链（直接格式 → 段落样式 → basedOn → docDefaults） |
| 🎯 结构化分析 | 识别标题、正文、题注、参考文献等 20+ 段落角色 |
| 🔍 智能检测 | 字体、字号、行距、对齐、页边距、页码、交叉引用有效性 |
| 👁️ 浏览器预览 | 前端渲染文档原貌，叠加高亮不合规位置 |
| ⚙️ 规则可配置 | 支持多模板管理、自定义规则库导入导出 |

## ❓ 为什么不用 Word COM

COM 自动化必须安装 Word、单线程、不能并发、易卡死，且微软官方不支持服务端自动化 Office。
OOXML 直接解析是 SaaS 后端的唯一可行方案。详见 [`AGENTS.md`](./AGENTS.md)。

## 📁 项目结构

```
word-auto/
├── packages/
│   ├── parser/         .docx(zip+XML) → 文档模型（段落/run/样式 + 有效格式）
│   └── validator/      文档模型 × 规则库 → 角色分类 + 不合规问题列表
├── apps/
│   ├── cli/            命令行工具（PoC 验证）
│   └── web/            浏览器工作台（检测 + 规则配置 + 模板管理）
└── templates/source/   标准文档样本（解析/分类/校验基线）
```

## 🛠️ 技术栈

| 层级 | 技术 | 用途 |
| --- | --- | --- |
| 解析 | `fflate` + `fast-xml-parser` | zip 解压 + XML 解析 |
| 运行时 | `tsx` | 直接执行 TypeScript 无需编译 |
| 前端 | React 18.3.1 + Vite 6 | Web 工作台 |
| 预览 | `docx-preview` | 浏览器渲染 docx 原貌 + 叠加高亮 |
| 包管理 | pnpm workspace | Monorepo 管理 |

## 🔧 样式继承解析

docx 格式采用多层继承机制，校验前需解析出每段的"有效格式"：

```
直接格式 (run/段落属性) → 段落样式 → basedOn 基样式链 → docDefaults
```

`packages/parser/src/resolve.ts` 沿继承链合并属性，生成 `EffectiveProps`（字体、字号、对齐、行距、缩进、大纲级别），
单位统一换算为标准值（`units.ts`）。

## 🚀 快速开始

### 📦 安装

```bash
pnpm install
```

### 💻 使用

```bash
# Web 工作台
pnpm --filter @word-auto/web run dev

# 命令行检测
pnpm --filter @word-auto/cli exec tsx src/main.ts "论文.docx" --rules "规则.json"

# 可选：输出报告到文件
pnpm --filter @word-auto/cli exec tsx src/main.ts "论文.docx" --rules "规则.json" --out "report.json"

# 运行质量检查
pnpm run ci
```

> **注意**：使用 `pnpm run ci` 而非 `pnpm ci`（后者是 pnpm 的未实现命令）。

## 📋 功能列表

### 🔬 解析能力

- ✅ 段落文本、样式继承、字体/字号/加粗/对齐/行距/缩进/大纲级别
- ✅ 页眉/页脚结构化解析（左/中/右位置 + `PAGE` 页码域）
- ✅ 段落域解析（`REF` / `SEQ` / `PAGEREF` / `HYPERLINK` 等）
- ✅ 脚注/尾注解析及引用回填
- ✅ 题注与交叉引用关联（图/表/公式 `SEQ` 域 ↔ `REF` / `PAGEREF` 域书签映射）
- ✅ 交叉引用有效性校验（检测缺失书签或无效目标）
- ✅ 结构信号识别（`w:drawing` / OMML 公式 / `w:object` 嵌入对象）
- ✅ 主题字体解析（`*Theme` 引用 → `theme1.xml` 实际字体名）
- ✅ 自动编号解析（`numbering.xml` 抽象编号 + 编号实例）
- ✅ 表格内段落提取（递归 `w:tbl>w:tr>w:tc>w:p`，标记 `inTable` 角色）
- ✅ 兼容带单位测量值（`85.05pt` / `3cm` 等）

### 🎭 角色识别

按章节状态机判定段落语义，支持 20+ 角色：

- 摘要标题/正文、关键词、目录标题、各级标题（1-5 级）
- 正文、参考文献标题/条目、后置章节（致谢/附录/成果）
- 图题注、表题注、资料来源、公式编号行、表格单元格
- 列表识别（有序/无序，支持多级嵌套）
- 结构化分类入口输出角色识别置信度，低置信启发式命中会透传到报告

### 📐 检测规则

- ✅ 字体、字号、加粗、对齐、行距、首行缩进（支持 `exact` / `oneOf` / `range` / `unset` 模式）
- ✅ 页边距、页眉/页脚距、装订线、纸张尺寸
- ✅ 页眉/页脚样式检测（页眉字体、字号、页眉线、页码位置/字体/字号）
- ✅ 分节页码检测（前置罗马数字 / 正文阿拉伯数字重起编号）
- ✅ 目录条目（TOC1/2/3）与结构化左侧页眉检测
- ✅ 统计型检测（关键词数量、摘要字数/词数、参考文献数量、外文占比）
- ✅ 编号连续性检测（标题题序、图/表题注连号，支持中文数字与多级编号）
- ✅ 脚注/尾注一致性（失效引用 + 孤立定义）
- ✅ run 级混排检测（段落内局部字体/字号不合规）
- ✅ 按脚本判断（纯中文段落不报西文字体问题，反之亦然）
- ✅ 结构信号联动分类（图题注邻接 drawing 信号，公式编号行邻接 OMML/对象信号）

### 🌐 Web 工作台

- ✅ 四步检测流程（上传 → 预览 → 检测 → 报告）
- ✅ `docx-preview` 渲染原貌 + 文本匹配高亮
- ✅ 规则配置页（字段值编辑 / mode 切换 / 草稿保存 / 发布回灌检测）
- ✅ 多模板管理（切换 / 新建 / 复制 / 重命名 / 删除自定义模板）+ 自定义规则库 JSON 导入/导出
- ✅ 模板候选提取 MVP（上传标准模板，聚合角色字段候选值、覆盖率、冲突值、可信提示）
- ✅ 报告聚合视图（按语义章节/角色/严重级/字段分组，联动预览定位）
- ✅ 低置信角色识别提示（仅低置信 issue 显著展示）
- ✅ 修复建议（携带可操作指引与可修复性标记）
- ✅ 规则溯源（issue 展示规则库 `source.provenance` 原始规范依据）

### 🛡️ 工程保障

- ✅ `templates/source/*.docx` 金标准解析/分类/校验基线
- ✅ parser / validator / web 单元测试
- ✅ GitHub Actions 质量门禁（typecheck / lint / knip / jscpd / test / build）

## 🗓️ 开发计划

详见 [`docs/TODO.md`](./docs/TODO.md)。当前重点：

- 🔧 模板候选质量提升
- 📊 多样本聚合与评分校准
- 📋 表格全局顺序与附录细分
- ⚡ Web 性能优化与交付物导出

**不在计划内**：自动改写正文、套版功能（属于远期高风险阶段）。

## 📄 License

MIT
