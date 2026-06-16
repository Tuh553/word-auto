// 修复建议（fix hint）：把一条已组装好的校验 issue 翻译成「人话修复指引」，
// 并标注可修复性。auto = 工具可机械改写对应 OOXML 属性；manual = 需人工确认/处理。
// 当前阶段只产出文案与标记，不实际改写文档（自动修复属远期高风险动作）。

import type { Issue, RuleValue } from "./types.js";

export type Fixability = "auto" | "manual";

export interface FixHint {
  suggestion: string;
  fixability: Fixability;
}

/** 文档/页面级字段 → 中文标签（这些都涉及节属性或分节，统一标 manual） */
const DOC_FIELD_LABELS: Record<string, string> = {
  margin_top_cm: "上边距",
  margin_bottom_cm: "下边距",
  margin_left_cm: "左边距",
  margin_right_cm: "右边距",
  header_distance_cm: "页眉距边界",
  footer_distance_cm: "页脚距边界",
  gutter_cm: "装订线",
};

const ALIGN_LABELS: Record<string, string> = {
  left: "左对齐",
  right: "右对齐",
  center: "居中",
  justify: "两端对齐",
  both: "两端对齐",
  distribute: "分散对齐",
};

type Scalar = string | number | boolean;
type FixHintIssue = Pick<Issue, "field" | "expected" | "actual" | "startRunIndex">;
type FixHintBuilder = (issue: FixHintIssue, target: string) => FixHint;

const isRuleValue = (value: unknown): value is RuleValue =>
  typeof value === "object" && value !== null && "mode" in (value as object);

const formatBoolean = (value: Scalar): string =>
  typeof value === "boolean" ? (value ? "「加粗」" : "「不加粗」") : `「${value}」`;

const formatAlignment = (value: Scalar): string => {
  const key = String(value);
  return `「${ALIGN_LABELS[key] ?? key}」`;
};

const formatByField = (field: string, value: Scalar): string => {
  if (field === "font_east_asia" || field === "font_latin") return `「${value}」`;
  if (field === "outline_level") return `${value} 级`;
  if (field.endsWith("_indent_chars")) return `${value} 字符`;
  if (field.endsWith("_cm")) return `${value}cm`;
  if (field.endsWith("_pt")) return `${value}pt`;
  return `${value}`;
};

const formatByUnit = (value: Scalar, unit?: RuleValue["unit"]): string => {
  if (unit === "bool") return formatBoolean(value);
  if (unit === "enum") return formatAlignment(value);
  if (unit === "level") return `${value} 级`;
  if (unit === "chars") return `${value} 字符`;
  if (unit === "pt") return `${value}pt`;
  return `${value}`;
};

/** 按字段语义/单位把单个目标值格式化为可读短语 */
const formatOne = (field: string, value: Scalar, unit?: RuleValue["unit"]): string => {
  if (field === "bold") return formatBoolean(value);
  if (field === "alignment") return formatAlignment(value);
  if (unit) return formatByUnit(value, unit);
  return formatByField(field, value);
};

const describeRangeTarget = (
  field: string,
  expected: RuleValue,
): string => {
  const lo = expected.min != null ? formatOne(field, expected.min, expected.unit) : null;
  const hi = expected.max != null ? formatOne(field, expected.max, expected.unit) : null;
  if (lo && hi) return `${lo} ~ ${hi}`;
  if (lo) return `不小于 ${lo}`;
  if (hi) return `不大于 ${hi}`;
  return "规范范围";
};

const describeRuleValueTarget = (field: string, expected: RuleValue): string => {
  switch (expected.mode) {
    case "exact":
      return expected.exact != null ? formatOne(field, expected.exact, expected.unit) : "规范值";
    case "oneOf":
      return (expected.oneOf ?? []).map((value) => formatOne(field, value, expected.unit)).join(" 或 ") || "规范值";
    case "range":
      return describeRangeTarget(field, expected);
    default:
      return "规范值";
  }
};

/** 把规则期望值（RuleValue 或裸标量）描述成目标短语 */
const describeTarget = (field: string, expected: unknown): string => {
  if (isRuleValue(expected)) return describeRuleValueTarget(field, expected);
  if (expected == null) return "规范值";
  return formatOne(field, expected as Scalar);
};

const buildAutoFixHint = (suggestion: string): FixHint => ({
  suggestion,
  fixability: "auto",
});

const buildManualFixHint = (suggestion: string): FixHint => ({
  suggestion,
  fixability: "manual",
});

const paragraphOrRun = (issue: FixHintIssue): string =>
  issue.startRunIndex == null ? "该段落" : "该文本片段";

const PARAGRAPH_FIX_HINTS: Record<string, FixHintBuilder> = {
  font_east_asia: (issue, target) => buildAutoFixHint(`请将${paragraphOrRun(issue)}中文字体设为 ${target}`),
  font_latin: (issue, target) => buildAutoFixHint(`请将${paragraphOrRun(issue)}西文字体设为 ${target}`),
  size_pt: (issue, target) => buildAutoFixHint(`请将${paragraphOrRun(issue)}字号调整为 ${target}`),
  bold: (_issue, target) => buildAutoFixHint(`请将该段落设为 ${target}`),
  alignment: (_issue, target) => buildAutoFixHint(`请将该段落对齐方式改为 ${target}`),
  spacing_before_pt: (_issue, target) => buildAutoFixHint(`请将该段落段前间距设为 ${target}`),
  spacing_after_pt: (_issue, target) => buildAutoFixHint(`请将该段落段后间距设为 ${target}`),
  first_line_indent_chars: (_issue, target) => buildAutoFixHint(`请将该段落首行缩进设为 ${target}`),
  hanging_indent_chars: (_issue, target) => buildAutoFixHint(`请将该段落悬挂缩进设为 ${target}`),
  left_indent_chars: (_issue, target) => buildAutoFixHint(`请将该段落左缩进设为 ${target}`),
  outline_level: () => buildAutoFixHint("请调整该段落的大纲级别，使其符合规范层级"),
};

const DOCUMENT_FIX_HINTS: Record<string, FixHintBuilder> = {
  paper_size: (_issue, target) => buildManualFixHint(`请在页面设置中将纸张大小设为 ${target}`),
  page_number_front: (_issue, target) => buildManualFixHint(`请将前置部分页码格式设为 ${target}（通常需在分节符处单独设置）`),
  page_number_body: (_issue, target) => buildManualFixHint(`请将正文页码设为 ${target}，并在正文起始分节处重新编号`),
  page_number_alignment: (_issue, target) => buildManualFixHint(`请将页码位置设为 ${target}`),
  page_number_font_latin: (_issue, target) => buildManualFixHint(`请将页码西文字体设为 ${target}`),
  page_number_size_pt: (_issue, target) => buildManualFixHint(`请将页码字号设为 ${target}`),
  header_text: (issue) => buildManualFixHint(`请在页眉中加入文字「${String(issue.expected ?? "")}」`),
  header_font_east_asia: (_issue, target) => buildManualFixHint(`请将页眉中文字体设为 ${target}`),
  header_font_latin: (_issue, target) => buildManualFixHint(`请将页眉西文字体设为 ${target}`),
  header_size_pt: (_issue, target) => buildManualFixHint(`请将页眉字号设为 ${target}`),
  header_bottom_border: () => buildManualFixHint("请在页眉段落下方设置符合规范的下边框线"),
  caption_reference: (issue) => {
    const actual = String(issue.actual ?? "");
    if (actual.includes("不存在")) {
      return buildManualFixHint("请在 Word 中更新该交叉引用，改为指向现有图/表/公式题注，或补回对应书签后再更新域");
    }
    return buildManualFixHint("请核对该交叉引用的目标，确保它指向图/表/公式题注而不是普通书签");
  },
  note_reference: () => buildManualFixHint("请在 Word 中检查该脚注/尾注引用，补回对应定义或删除失效引用后再更新注释编号"),
  note_definition: () => buildManualFixHint("请核对这些脚注/尾注定义是否仍需保留；若正文已无引用，请删除孤立注释或重新插入引用"),
};

const lineSpacingFixHint = (issue: FixHintIssue, target: string): FixHint => {
  if (typeof issue.actual === "number") {
    return buildAutoFixHint(`请将该段落行距改为固定值 ${target}`);
  }
  return buildManualFixHint(`当前行距为 ${String(issue.actual)}，请人工核对排版后将其设为固定值 ${target}`);
};

/** 根据一条 issue 推导修复建议与可修复性 */
export const computeFixHint = (
  issue: FixHintIssue,
): FixHint => {
  const { field } = issue;
  const target = describeTarget(field, issue.expected);

  if (field === "line_spacing_pt") return lineSpacingFixHint(issue, target);

  const paragraphHint = PARAGRAPH_FIX_HINTS[field];
  if (paragraphHint) return paragraphHint(issue, target);

  const documentHint = DOCUMENT_FIX_HINTS[field];
  if (documentHint) return documentHint(issue, target);

  if (field in DOC_FIELD_LABELS) {
    return buildManualFixHint(`请在页面设置中将${DOC_FIELD_LABELS[field]}设为 ${target}`);
  }

  return buildManualFixHint(`请根据规范要求将该项调整为 ${target}`);
};
