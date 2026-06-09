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
| `packages/parser` | docx→文档模型；样式继承；主题字体(theme1.xml)；`sectPr` 页面设置；**带单位测量值(pt/cm/mm/in)**；页眉文本提取；单位换算 |
| `packages/validator` | 章节状态机识别角色（**含封面区跳过 + TOC1/2/3 目录条目**）；规则比对（字体/字号/加粗/对齐/行距/首行缩进）；按 hasCJK/hasLatin 降噪；文档级检测（页边距/页眉页脚距/装订线/纸张）；**分节页码**（前置罗马/正文阿拉伯重起）；**页眉内容**；行距缺失提示 |
| `apps/cli` | PoC：报告 + 页面设置/页码实测；支持传入 docx/规则库路径 |
| `apps/web` | React+Vite 纯前端；四步流程；docx-preview 预览 + 问题高亮 |
| 标准模板 | `templates/source/*.docx`（权威批注版），作校准依据 + 检测金标准 |
| 部署 | `.github/workflows/deploy.yml`（push main 自动 GitHub Pages） |

## 标准模板对账（关键里程碑）

用引擎解析权威标准模板（而非生成的 demo）后暴露并修复了：
- **pt 单位 bug**：真实文档 pgMar 写成 `85.05pt` 等，旧解析丢失 → 已修（measureToTwips）。
- **封面误报**：封面/扉页被当正文狂报 → 分类器加封面区跳过，error 76→16。
- 剩余 16 error 为**特殊正文元素**（图表注释/资料来源 9pt、公式编号 (1.1)）被当正文，
  属长尾——见待办。
- 原则：标准模板理想应"近零 error"，剩余即下一批优化坐标。

## ⚠️ 当前调试中：web 预览渲染（最高优先）

用户反馈预览「十几页内容压到几页/叠加」。排查与现状：
- ✅ 已修「重影」：`<StrictMode>` 下 effect 双跑 + renderAsync 异步并发渲染到同容器。
  改为渲染到游离节点、完成后 `replaceChildren` 整体挂载 + stale 标志丢弃过期渲染。
- ✅ 排除 pt 单位疑点：docx-preview `convertLength` 对 `595.30pt` 这类直接当 CSS 长度，正确。
- ✅ 「塌缩重叠」是我乱调 options 所致（`ignoreHeight:true`/`breakPages:false`/`experimental`）。
  已退回 docx-preview **默认配置**（仅 `className:"docx"` + `inWrapper:true`），见 commit `42b76cf`。
- ❓ 用户尚未确认默认配置版是否解决。
- 高亮定位已改**段落原文文本匹配**（PreviewPanel `targetText`，不再用序号），文档级问题不定位。

**下一步（重启会话后做）**：chrome-devtools MCP 配置已修好——旧配置 `--auto-connect` 与
新版 Chrome 冲突（默认 profile 禁止远程调试，报 DevToolsActivePort/端口不可连），已改为
user config 无 auto-connect（`cmd /c npx -y chrome-devtools-mcp@latest`），让 MCP 自启隔离
Chrome。`claude mcp list` 已显示新配置 ✓Connected，但**当前会话的 MCP 进程仍是旧实例，需
重启会话**才生效。重启后：
1. 重新起 dev server：`pnpm --filter @word-auto/web run dev`（重启后端口应回到 5173）。
2. 直接 `mcp__chrome-devtools__new_page` 打开 `http://localhost:5173/`（首次调用自启 Chrome）。
3. 上传 `templates/source/*.docx`，**截图自查**预览渲染（塌缩/叠加是否还在）。
4. 对照 DOM 判定根因：容器 CSS / docx-preview 兼容 / 挂载方式，修到对再给用户看。
5. 别再让用户反复刷新当测试员。

预览相关文件：`apps/web/src/components/PreviewPanel.tsx`、`App.tsx`、`styles.css`(`.preview*`)。

## 待办 ⬜（按价值/风险）

1. **多模板支持**（任务3，未做）：web 支持上传自定义规则库 JSON（去 BOM + 校验 styles），
   TEMPLATES 数组已就绪；UI 模板步骤加上传入口。
2. **特殊正文元素识别**：图表注释/资料来源(9pt)、公式编号——新增角色或在分类器归类，
   避免按正文 12pt 误报。
3. **表格内段落**：parser 现仅取 body 直接 w:p；表格内 w:tbl>w:tc>w:p 未提取。
   需 fast-xml-parser `preserveOrder` 重构（影响所有 XML 访问，风险高，单独评估）。
4. web 高亮定位精度（docx-preview 段落与 body 段落序号对齐偶有偏差，可改文本匹配）。
5. 参考文献后致谢/附录被当 reference_body（状态机停在 references）。
6. （远期、高风险）自动套版改写——务必无损保留分节/域/题注/交叉引用。

## 已知坑（详见 AGENTS.md）

- 外部规则库 JSON 带 BOM（PowerShell `Set-Content -Encoding UTF8` 所致），读取要 strip。
- 主题字体 `a:ea` 常为空，需回退 `script="Hans"`。
- 校验字体要按段落 hasCJK/hasLatin 降噪。
- 测量值可能带单位（pt/cm/mm/in），不只是整数 twips——用 measureToTwips。
- 单位：字号 half-point(/2)、行距 auto 倍数(/240)、exact/atLeast pt(/20)。

## 本地运行

```bash
pnpm install
pnpm --filter @word-auto/web run dev   # http://localhost:5173/
pnpm --filter @word-auto/cli run check # demo 报告
# 解析标准模板：
pnpm --filter @word-auto/cli exec tsx src/main.ts "<标准模板.docx 绝对路径>"
```
