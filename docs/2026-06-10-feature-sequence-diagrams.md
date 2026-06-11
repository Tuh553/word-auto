# word-auto 功能时序图（完整版）

> 日期：2026-06-10　配套：[`2026-06-10-enhancement-roadmap.md`](./2026-06-10-enhancement-roadmap.md)
> 覆盖**现有已实现功能**与**规划新功能**两大部分，用 Mermaid 时序图描述运行时交互。
> **仅为设计/说明，未写实现代码。** 不支持 Mermaid 渲染时，可读每图下方「说明」。

## 参与者图例

| 参与者 | 对应模块 | 状态 |
| --- | --- | --- |
| `App` / `RuleConfigPanel` / `ReportPanel` / `PreviewPanel` | `apps/web` 组件 | 现有 |
| `parseDocx` | `@word-auto/parser` 解析入口 | 现有 |
| `computeEffective` | `parser/resolve.ts` 样式继承 | 现有 |
| `classifyParagraphs` / `validateDoc` | `@word-auto/validator` | 现有 |
| `lintRuleLibrary` / `normalizeRuleLibrary` / `toLegacyRuleLibrary` | `validator` 规则模型 | 现有 |
| `docx-preview` | 第三方预览渲染 | 现有 |
| 草稿存储 / 生效规则库 / Web Worker / 候选提取器 / 批注导出器 | 路线图新增 | **新增** |

---

## 图 0　全局功能总览（导航图）

一张图把握整体：系统围绕 **parser（解析）→ validator（分类/校验/规则）→ Web（交互）** 三层，
分四条功能线；核心模块被多线复用——`parser`/`validator` 同时服务「检测」与「候选提取」，
规则库同时服务「配置」与「检测」。先看此图把握全局，再按需查阅对应分图。

```mermaid
sequenceDiagram
    actor U as 用户
    participant W as Web 前端
    participant P as parser 解析
    participant V as validator 校验
    participant R as 规则库
    participant X as 新增模块

    alt A 文档检测线（现有 · 图 1-4）
        U->>W: 上传 .docx
        W->>P: 解析（样式继承 + 表格段落）
        P-->>W: DocModel
        W->>R: 取生效规则
        W->>V: 角色识别 + 文档/逐段校验
        V-->>W: 分级报告
        W-->>U: 预览高亮 + 报告 + 问题下钻
    else B 规则配置线（现有骨架→新增 · 图 5-7）
        U->>W: 导入 / 编辑规则
        W->>V: lintRuleLibrary 实时校验
        V-->>W: errors / warnings / infos
        U->>W: 保存草稿 / 发布
        W->>R: 写草稿 →（发布）生效版本
        Note over R,V: 发布后回灌检测（引擎按 RuleValue 比对）
    else C 模板候选线（新增 · 图 8）
        U->>W: 上传标准模板 / 样本
        W->>P: 解析
        W->>V: 角色识别
        W->>X: 候选提取器聚合统计
        X-->>U: 候选（值/置信度/冲突）→ 接受到草稿
    else D 性能与交付线（新增 · 图 9-10）
        U->>W: 大文档检测 / 导出
        W->>X: Web Worker 异步解析校验
        W->>X: 批注导出器生成带批注 docx
        X-->>U: 流畅报告 / 可下载 docx
    end
```

**说明**：四条线非互斥，是四类使用场景。关键复用关系——①`parser`+`validator` 被「检测」(A) 与
「候选提取」(C) 共用；②规则库被「配置」(B) 与「检测」(A) 共用，但 validator **只读生效规则**，
草稿/候选不参与检测；③新增模块(Worker/候选/批注)按场景挂载，不改变核心解析与校验链路。

---

# 第一部分　现有功能（已实现）

## 图 1　文档检测端到端主流程

四步流程：上传 → 选模板 → 配置 → 检测 → 预览 + 分级报告。

```mermaid
sequenceDiagram
    actor U as 用户
    participant A as App
    participant P as parseDocx
    participant N as toLegacyRuleLibrary
    participant V as validateDoc

    U->>A: 上传 .docx
    A->>A: 读取为 ArrayBuffer
    U->>A: 选择模板 + 勾选检测级别
    U->>A: 开始检测
    A->>P: 解析文档二进制
    P-->>A: DocModel（段落 + 样式 + 分节 + 页眉）
    A->>N: 规则归一为检测格式
    N-->>A: 检测用规则
    A->>V: model + rules
    V-->>A: ValidationReport（问题 + 汇总）
    A-->>U: 文档预览 + 分级问题报告
```

**说明**：纯前端、文件不离开浏览器。`validateDoc` 内部还会调角色识别与各检查器（见图 3）。

---

## 图 2　docx 解析管线 `parseDocx`（含表格段落提取）

解 zip → 主题/样式 → 逐段算有效格式 → **递归提取表格段落** → 分节与页眉。

```mermaid
sequenceDiagram
    participant P as parseDocx
    participant Z as fflate 解包
    participant S as parseStyles / parseTheme
    participant E as computeEffective
    participant C as 调用方

    P->>Z: unzipSync(buffer)
    Z-->>P: 文件表（document / styles / theme / header）
    P->>S: 解析 styles.xml + theme1.xml
    S-->>P: 样式表 + docDefaults + 主题字体
    P->>P: 解析 document.xml 取 body
    loop body 直接段落 w:p
        P->>E: 段落 + basedOn 样式链 + docDefaults
        E-->>P: 有效格式（字体/字号/行距/缩进/大纲级别）
    end
    loop 递归 w:tbl 内 w:tc 的 w:p（表格段落，标记 inTable）
        P->>E: 单元格段落 + 样式继承
        E-->>P: 有效格式
    end
    P->>P: 收集 sectPr（页面/分节页码）+ 提取页眉文本
    P-->>C: DocModel（段落含表格 + sections + headers）
```

**说明**：①样式继承沿「直接格式→样式链→docDefaults」合并；②表格段落用同一套纯函数提取、标 `inTable`，追加到段落末尾（局部递归，未走全局 `preserveOrder`）。

---

## 图 3　校验流程 `validateDoc`（文档级 + 逐段）

先角色识别，再跑文档级检查与逐段格式比对；无规则的角色（如 `table_cell`）跳过。

```mermaid
sequenceDiagram
    participant V as validateDoc
    participant C as classifyParagraphs
    participant K as 各检查器

    V->>C: 段落序列 → 角色
    C-->>V: roles（含 table_cell）
    V->>K: checkDocument（页边距/纸张/装订线）
    V->>K: checkPageNumbers（罗马/阿拉伯重起）
    V->>K: checkHeaders（页眉规定文字）
    loop 每个已分类段落
        alt 该角色有对应规则
            V->>K: checkPara（字体/字号/对齐/行距/缩进，按脚本降噪）
            K-->>V: 该段问题
        else table_cell 等无规则
            V->>V: 跳过（不误报）
        end
    end
    V-->>V: 汇总 error/warn/info + byRole
```

**说明**：角色识别是按文档顺序的状态机（标题关键词 > 封面区 > 目录样式 > 大纲级别 > 当前章节）；中文段不报西文字体、反之亦然（按脚本降噪）。

---

## 图 4　预览高亮与报告联动

`docx-preview` 渲染原貌 + 行距塌缩修补；点击问题按段落原文匹配定位高亮。

```mermaid
sequenceDiagram
    actor U as 用户
    participant RP as ReportPanel
    participant A as App
    participant PV as PreviewPanel
    participant D as docx-preview

    U->>PV: 进入结果页
    PV->>D: renderAsync(buffer)
    D-->>PV: 渲染后的文档 DOM
    PV->>PV: 修补极小行距（行高<字高 → normal）
    PV-->>U: 文档原貌预览
    U->>RP: 点击某条问题
    RP->>A: onSelect(paraIndex)
    A->>PV: 传该段原文 targetText
    PV->>PV: 文本匹配定位段落（不依赖序号）
    PV-->>U: 平滑滚动并高亮该段
```

**说明**：高亮按段落原文匹配而非 DOM 序号，避免与渲染结构错位（详见 PROGRESS 渲染攻坚记录）。

---

## 图 5　规则配置页实时校验（已实现骨架）

载入模板可编辑副本 → 浏览/切换启用/改严重级别 → 实时跑 `lintRuleLibrary` 反馈。

```mermaid
sequenceDiagram
    actor U as 用户
    participant A as App
    participant P as RuleConfigPanel
    participant L as lintRuleLibrary

    U->>A: 切到「规则配置」
    A->>A: 载入模板可编辑副本（structuredClone）
    A->>P: 传入规则库
    P->>L: 校验规则合法性
    L-->>P: errors / warnings / infos
    P-->>U: 角色列表 + 字段 + 汇总/字段级提示
    U->>P: 切换字段启用 / 改严重级别
    P->>A: onChange(新规则库)
    A->>P: 回传更新
    P->>L: 重新校验
    L-->>P: 最新结果
    P-->>U: 实时反馈 + 角色错误标记
```

**说明**：当前值为只读展示；编辑只支持启用开关与严重级别。值编辑控件、草稿/发布见第二部分图 7。

---

# 第二部分　规划新功能

## 图 6　导入自定义规则库（roadmap §4）

上传 JSON → 去 BOM → 归一 → 合法性校验 → 载入或拒绝。

```mermaid
sequenceDiagram
    actor U as 用户
    participant W as Web 前端
    participant N as normalizeRuleLibrary
    participant L as lintRuleLibrary
    participant S as 规则库 state

    U->>W: 上传 / 拖入规则库 JSON
    W->>W: 读取文本、剥离 BOM
    W->>N: 归一（旧 JSON 或新结构）
    N-->>W: EditableRuleLibrary
    W->>L: 校验规则合法性
    L-->>W: errors / warnings / infos
    alt 存在 error
        W-->>U: 拒绝载入，定位字段级错误
    else 合法
        W->>S: 设为当前可编辑库
        W-->>U: 进入配置页，展示 warn / info
    end
```

**说明**：复用现有 `normalizeRuleLibrary` + `lintRuleLibrary`，近乎零新逻辑即支撑多模板。

---

## 图 7　规则配置：草稿 → 发布 → 回灌检测（roadmap §3.3 + §4）

草稿/发布态分离 + 引擎对齐（检测直接消费 `RuleValue`，支持 `oneOf`/`range`）。

```mermaid
sequenceDiagram
    actor U as 用户
    participant P as RuleConfigPanel
    participant L as lintRuleLibrary
    participant D as 草稿存储
    participant R as 生效规则库
    participant V as validateDoc

    U->>P: 编辑字段（值 / 启用 / 严重级别）
    P->>L: 实时校验草稿
    L-->>P: errors / warnings / infos
    P-->>U: 字段级反馈 + 脏状态
    U->>P: 保存草稿
    P->>D: 持久化草稿
    U->>P: 发布
    P->>L: 发布前再校验
    alt 存在 error
        P-->>U: 阻断发布
    else 通过
        P->>R: 生成新生效版本
        P-->>U: 发布成功
    end
    Note over V,R: 引擎对齐：按 RuleValue 的 mode 比对
    U->>V: 检测文档（消费生效规则）
    V->>R: 读取生效规则
    V-->>U: 报告（支持精确值/候选之一/范围）
```

**说明**：草稿不影响检测，发布才回灌；修掉「配了 `oneOf`/`range` 却检测不到」的能力断层。

---

## 图 8　模板候选提取（roadmap §4 阶段 6-7）

上传模板 → 复用 parser+classify 聚合 → 候选规则 → 人工确认接受到草稿。

```mermaid
sequenceDiagram
    actor U as 用户
    participant W as Web 前端
    participant P as parseDocx
    participant C as classifyParagraphs
    participant X as 候选提取器
    participant D as 草稿存储

    U->>W: 上传标准模板 / 样本 .docx
    W->>P: 解析为文档模型
    P-->>W: DocModel（段落 + 有效格式，含表格段落）
    W->>C: 角色识别
    C-->>W: 每段角色
    W->>X: 按角色聚合字段分布
    loop 每个角色 × 每个字段
        X->>X: 统计主值/样本数/覆盖率/冲突/置信度
    end
    X-->>W: RuleProposal 列表
    W-->>U: 展示候选（建议值/置信度/覆盖率/冲突）
    U->>W: 逐项或批量「接受到草稿」
    W->>D: 写入草稿字段（不覆盖生效规则）
    W->>W: 重新跑 lintRuleLibrary
    W-->>U: 草稿态 + 校验反馈
```

**说明**：把「人工写规则」升级为「自动提取 + 人工确认」；候选只进草稿，必须展示冲突与置信度。

---

## 图 9　Web Worker 异步检测（roadmap §5.4）

解析与校验移出主线程，大文档不阻塞 UI。

```mermaid
sequenceDiagram
    actor U as 用户
    participant UI as 主线程 App
    participant WK as Web Worker
    participant P as parseDocx
    participant V as validateDoc

    U->>UI: 上传 .docx + 选规则库
    UI->>WK: 传入 buffer + 规则
    Note over UI: 主线程不阻塞，展示进度
    WK->>P: 解析（unzip + XML + 表格提取）
    P-->>WK: DocModel
    WK->>V: 角色识别 + 逐段/文档级校验
    V-->>WK: ValidationReport
    WK-->>UI: 回传 report + model
    UI-->>U: 渲染预览 + 报告
```

**说明**：同步 `unzipSync` + 全量解析会卡 UI；Worker 化是纯前端形态的体验刚需，不改检测逻辑。

---

## 图 10　带批注的 docx 导出（roadmap §5.1）

把问题作为 Word 批注回插——只加批注、不改正文。

```mermaid
sequenceDiagram
    actor U as 用户
    participant RP as ReportPanel
    participant E as 批注导出器
    participant Z as OOXML 打包（fflate）

    U->>RP: 点击「导出带批注的 .docx」
    RP->>E: 传入问题列表 + 原始 docx
    E->>E: 解析原 docx 结构
    loop 每个问题
        E->>E: 生成 w:comment，锚定到对应段落
    end
    Note over E: 只新增批注，绝不改写正文
    E->>Z: 注入 comments.xml + 段落批注引用，重新打包
    Z-->>E: 新 .docx 二进制
    E-->>U: 下载（在 Word 中逐条查看批注）
```

**说明**：高价值交付物，形成「看报告→改文档」闭环；不违背「绝不用 COM、不改写正文」根基。

---

## 图 11　问题下钻：规则依据 + 修复建议（roadmap §3.5）

点击问题展示其原始模板批注依据（`provenance`）与人话修复指引。

```mermaid
sequenceDiagram
    actor U as 用户
    participant RP as ReportPanel
    participant RL as 生效规则库
    participant PV as PreviewPanel

    U->>RP: 点击某条问题
    RP->>RL: 取该规则依据原文（provenance）
    RL-->>RP: 原始模板批注文本
    RP->>RP: 生成修复建议（期望值 → 怎么改）
    RP-->>U: 展示 期望/实际 + 规则依据 + 修复指引
    RP->>PV: 传该段原文
    PV-->>U: 滚动并高亮对应段落
```

**说明**：规则库 JSON 的 `source.provenance` 已存每条规则的批注原文，目前未利用——展示它几乎零成本即可提升信任度。

---

## 标记约定

- **现有功能（图 1-5）**：已在代码库实现并经测试/对账验证（含本轮表格段落提取）。
- **新增功能（图 6-11）**：路线图规划，尚未实现；草稿存储、生效规则库、Web Worker、候选提取器、批注导出器为待建模块。
- **改造点**：图 7 的 `validateDoc` 由「降级到 legacy 单值」改为「直接消费 `RuleValue`」。
- 所有流程严守：纯 OOXML（无 Word COM）、检测与改写分离、规则可回溯依据、文件不离开浏览器。
