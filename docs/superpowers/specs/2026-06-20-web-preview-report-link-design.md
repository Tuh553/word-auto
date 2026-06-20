# Web 报告与预览双向联动设计

日期：2026-06-20

## 目标

补齐 `apps/web` 中报告面板与 docx 预览之间的双向联动闭环，让用户可以稳定地：

- 点击报告 issue，滚动并高亮预览中的对应段落或片段。
- 点击预览中带 issue 的段落或高亮区域，反向选中对应报告 issue。
- 手动滚动预览时，让报告自动切换到当前视口内最相关的 issue。

本次改动只涉及 Web 交互层，不修改 parser / validator 语义，不改规则库格式，不引入后端，不上传文件。

## 非目标

- 不改 `DocModel`、`ValidationReport`、角色识别或 issue 生成语义。
- 不改现有段落文本匹配策略；预览定位仍基于段落原文文本匹配，不依赖 DOM 序号。
- 不改 `affectedText` 片段高亮规则；仍保持“有片段优先高亮片段，失败时回退整段”。
- 不改 `ReportPanel` 现有分组、排序、provenance 展开、修复建议、低置信提示展示规则。

## 现状审计

当前代码已具备以下能力：

- `ReportPanel` 点击 issue 会调用 `onSelect`，上层更新 `selectedIssueKey`。
- `useDetectionFlow` 会基于选中的 issue 生成 `selectedPreviewTarget`。
- `PreviewPanel` 会按段落原文文本匹配目标 block，并优先高亮 `affectedText`；找不到片段时回退整段高亮。
- `PreviewPanel` 已支持点击 `.wa-preview-hit` 后通过 `onSelectTarget(issueKey)` 反向选中 issue。
- `ReportPanel` 在 `selectedIssueKey` 变化后会把对应卡片 `scrollIntoView`。
- `useDetectionFlow` 已通过 `buildPreviewIssueTargets`、`resolveSelectedIssue` 基于当前 severity 筛选集维护可见 issue 与默认选中逻辑。

当前缺口：

- 预览滚动时不会自动反向选中报告 issue。
- 没有明确机制阻断“报告点击导致预览滚动”与“预览滚动监听反向选中”之间的反馈循环。
- 这部分逻辑缺少纯函数测试，稳定性不足。

## 设计原则

1. 单一真相源仍是 `selectedIssueKey`。
2. 预览导航目标仍由选中 issue 派生，不引入第二套选中状态。
3. 所有反向联动都只针对“当前可见 issue 集合”，即当前筛选后的 issue。
4. DOM 相关逻辑尽量薄，滚动选择策略提取为纯函数，以便单测。
5. 程序触发的预览滚动与用户手动滚动必须可区分，避免抖动和跳回。

## 方案选择

采用“`helper + 轻状态机`”方案：

- 在 `previewHighlight.ts` 提取纯函数，根据当前视口和候选目标几何信息选出“当前最该被选中的 issue”。
- `PreviewPanel` 负责：
  - 渲染和维护 `.wa-preview-hit` 标记；
  - 在点击或滚动时收集候选 block 的 DOM 几何信息；
  - 把用户意图通过回调上报给上层。
- `useDetectionFlow` 负责：
  - 统一仲裁不同来源的选中事件；
  - 维护“程序滚动抑制窗口”，避免反馈循环；
  - 决定何时仅更新报告选中，何时还需要驱动预览滚动。

不采用 `IntersectionObserver` 方案，因为当前问题核心是联动稳定性和可测试性，不是可见性监听本身；用 observer 仍需额外封装中心优先/顶部优先规则，测试成本更高。

## 交互行为定义

### 1. 报告 -> 预览

- 用户点击报告 issue。
- 上层将该选择记为 `report-click`。
- 预览根据 `selectedPreviewTarget` 滚动到目标段落。
- 如果 issue 带 `affectedText` 且段落内能匹配到该片段，则高亮片段并滚动到片段；否则高亮整段并滚动到段落。

### 2. 预览点击 -> 报告

- 只有带 `.wa-preview-hit` 的段落可触发反向联动。
- 用户点击 issue 段落或其片段高亮区域时，`PreviewPanel` 上报对应 `issueKey`，来源为 `preview-click`。
- 上层只更新 `selectedIssueKey` 与 `selectedPreviewTarget`，报告面板滚到该 issue。
- 由于这是用户显式选择，不需要程序滚动抑制。

### 3. 预览滚动 -> 报告

- `PreviewPanel` 在滚动时只扫描当前 `.wa-preview-hit` 对应的候选块。
- 从候选块中选出当前视口内最相关的 `issueKey`，来源为 `preview-scroll`。
- 上层只更新报告选中，不触发新的预览滚动。
- 若当前视口内没有任何候选块，则不更新选中状态。

### 4. 筛选变化

- severity 筛选变化后，仍使用 `resolveSelectedIssue` 处理当前选择：
  - 若原选中 issue 仍可见，则保留；
  - 若被筛掉，则回退到新的首个可导航 issue。
- 预览反向联动仅针对新的 `previewIssueTargets`，不会误选隐藏 issue。

## 滚动选中算法

新增一个纯函数，输入：

- 当前候选目标列表：`issueKey`、相对预览容器的 `top` / `bottom`。
- 当前视口区间：`scrollTop`、`clientHeight`。

输出：

- 当前应被反向选中的 `issueKey | null`。

策略采用 `hybrid`：

1. 先过滤出和当前视口有交集的候选块。
2. 若有候选块覆盖视口中心线，选择其中心点距离视口中心最近的目标。
3. 若没有中心命中，选择视口内 `top` 最靠前的目标。
4. 若没有可见候选块，返回 `null`。

该策略兼顾两类场景：

- 用户快速滚页时，中心附近的内容通常更符合“当前正在看哪里”的直觉。
- 用户小幅向下或向上浏览时，顶部回退可以避免中心线落在空白或分页边界时的误跳。

## 防反馈循环

### 选择来源

上层选择事件显式区分三类来源：

- `report-click`
- `preview-click`
- `preview-scroll`

### 抑制窗口

当来源为 `report-click` 时：

- `useDetectionFlow` 记录一次短暂抑制窗口，持续约 400ms。
- 在此窗口内，忽略 `preview-scroll` 触发的反向选中请求。

设计目的：

- 报告点击会触发 `PreviewPanel.scrollIntoView()`。
- 该程序滚动会触发原生 `scroll` 事件。
- 若不抑制，滚动监听可能在动画途中反选其他 issue，造成报告与预览抖动或跳回。

当来源为 `preview-click` 或用户真实滚动时：

- 不开启抑制窗口。
- 更新 `selectedIssueKey` 后，只允许报告滚动，不再驱动预览重新跳转。

### 重复选择短路

滚动联动还会做两层短路：

- 若当前计算出的 `issueKey` 与当前 `selectedIssueKey` 相同，不重复更新。
- 若处于抑制窗口内，`preview-scroll` 计算结果直接丢弃。

## 代码改动落点

### `apps/web/src/lib/previewHighlight.ts`

新增或扩展纯函数：

- 为滚动联动定义候选几何数据结构。
- 实现“根据当前视口选择应选 issue”的 helper。

保持原有职责不变：

- `normalizePreviewText`
- `findPreviewBlockTextIndex`
- `findNormalizedTextRange`

### `apps/web/src/components/PreviewPanel.tsx`

保留：

- `docx-preview` 渲染和小行高修补逻辑。
- 文本匹配定位和 `affectedText` 片段高亮回退逻辑。
- 点击 `.wa-preview-hit` 的反向选择能力。

新增：

- 预览容器滚动监听。
- 将 `.wa-preview-hit` 的几何信息转为纯函数输入。
- 在滚动时通过回调上报 `preview-scroll` 选择结果。
- 程序滚动抑制窗口输入，避免组件内部误判程序滚动为用户操作。

### `apps/web/src/hooks/useDetectionFlow.ts`

新增：

- 统一的选择入口，接收 `issueKey` 和选择来源。
- 对 `report-click` 写入抑制窗口时间戳。
- 区分“需要驱动预览滚动的选择”和“只更新报告选中的选择”。

保持：

- `resolveSelectedIssue` 的筛选后选择语义。
- `buildPreviewIssueTargets` 只针对当前可见 issue 的行为。

### `apps/web/src/components/DetectWorkspace.tsx`

最小改动：

- 把新的预览滚动/点击选择回调继续透传给 `PreviewPanel`。
- 不新增业务状态。

### `apps/web/src/components/ReportPanel.tsx`

原则上不改展示结构。

只验证两点：

- `selected` 样式仍正确渲染。
- `selectedIssueKey` 变化后仍会 `scrollIntoView`，不因联动改造回退。

## 测试策略

### 单元测试

#### `apps/web/src/lib/previewHighlight.test.ts`

新增覆盖：

- 候选块覆盖中心线时，优先选离中心最近的 issue。
- 没有中心命中时，回退到当前视口内最靠前的 issue。
- 当前视口没有任何 issue 块时返回 `null`。
- 候选块经过筛选裁剪后，只会从剩余可见 issue 中选择。

#### `apps/web/src/lib/reportGroups.test.ts`

保留并补强：

- `buildPreviewIssueTargets` 仍为每个可见段落只生成一个稳定目标。
- `resolveSelectedIssue` 在筛选隐藏当前 issue 时仍回退到首个可导航 issue。
- 如有必要，补充“同段多个 issue 取排序后首个可见 issue”的稳定性断言。

#### `apps/web/src/lib/reportPanel.test.ts`

保留：

- `selectedIssueKey` 对应卡片的 `selected` 状态渲染。

补充：

- 使用轻量 DOM 集成测试或 mock `scrollIntoView`，确认选中项滚入视图逻辑未回退。

### 组件轻集成测试

若当前测试环境允许：

- 为 `PreviewPanel` 增加“点击 `.wa-preview-hit` 会调用 `onSelectTarget`”测试。

若滚动 DOM 行为在当前环境中过重，则不强行硬测：

- 组件只验证点击与数据标记；
- 滚动命中策略全部由纯函数单测覆盖。

## 验证计划

实现后按以下顺序验证：

1. `pnpm typecheck`
2. `pnpm lint`
3. `pnpm run ci`

通过后创建 git commit；如果当前分支允许远程推送，则执行 `git push`。

## 风险与限制

- 预览定位仍基于文本匹配；若文档存在大量完全相同的短段落，仍可能命中首个相似 block。此次不改变这一策略，只保证现有策略下联动闭环稳定。
- `scrollIntoView({ behavior: "smooth" })` 在不同浏览器的滚动事件触发时序略有差异，因此抑制窗口应保持保守但短暂，避免吞掉真实用户滚动。
- 由于同一段可能有多个 issue，预览块级反向联动默认只回选该段当前可见 issue 中排序最靠前的一项；本次不扩展为段内 issue 选择器。

## 交付结果

完成后应满足：

- 点击报告 issue：预览滚动并高亮对应段落或片段。
- 点击预览中有 issue 的段落或高亮区域：报告选中对应 issue 并滚入视图。
- 用户滚动预览到另一个有 issue 的段落附近：报告自动切换到对应 issue。
- 没有 issue 的段落不会误选。
- 筛选、分组、排序变化后联动仍只针对当前可见 issue。
- `pnpm run ci` 通过。
