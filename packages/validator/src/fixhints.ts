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

const isRuleValue = (value: unknown): value is RuleValue =>
  typeof value === "object" && value !== null && "mode" in (value as object);

/** 按字段语义/单位把单个目标值格式化为可读短语 */
const formatOne = (
  field: string,
  value: Scalar,
  unit?: RuleValue["unit"],
): string => {
  if (field === "bold" || unit === "bool") {
    if (typeof value === "boolean") return value ? "「加粗」" : "「不加粗」";
    return `「${value}」`;
  }
  if (field === "alignment" || unit === "enum") {
    const key = String(value);
    return `「${ALIGN_LABELS[key] ?? key}」`;
  }
  if (field === "outline_level" || unit === "level") return `${value} 级`;
  if (unit === "chars" || field.endsWith("_indent_chars")) return `${value} 字符`;
  if (field.endsWith("_cm")) return `${value}cm`;
  if (unit === "pt" || field.endsWith("_pt")) return `${value}pt`;
  if (field === "font_east_asia" || field === "font_latin") return `「${value}」`;
  return `${value}`;
};

/** 把规则期望值（RuleValue 或裸标量）描述成目标短语 */
const describeTarget = (field: string, expected: unknown): string => {
  if (isRuleValue(expected)) {
    const { unit } = expected;
    switch (expected.mode) {
      case "exact":
        return expected.exact != null
          ? formatOne(field, expected.exact, unit)
          : "规范值";
      case "oneOf":
        return (
          (expected.oneOf ?? [])
            .map((value) => formatOne(field, value, unit))
            .join(" 或 ") || "规范值"
        );
      case "range": {
        const lo = expected.min != null ? formatOne(field, expected.min, unit) : null;
        const hi = expected.max != null ? formatOne(field, expected.max, unit) : null;
        if (lo && hi) return `${lo} ~ ${hi}`;
        if (lo) return `不小于 ${lo}`;
        if (hi) return `不大于 ${hi}`;
        return "规范范围";
      }
      default:
        return "规范值";
    }
  }
  if (expected == null) return "规范值";
  return formatOne(field, expected as Scalar);
};

/** 根据一条 issue 推导修复建议与可修复性 */
export const computeFixHint = (
  issue: Pick<Issue, "field" | "expected" | "actual">,
): FixHint => {
  const { field } = issue;
  const target = describeTarget(field, issue.expected);

  // 行距特例：仅当当前是固定值（数字）时可机械改写；未设置 / 多倍行距改固定
  // 会影响整体排版观感，需人工核对，标 manual。
  if (field === "line_spacing_pt") {
    if (typeof issue.actual === "number") {
      return {
        suggestion: `请将该段落行距改为固定值 ${target}`,
        fixability: "auto",
      };
    }
    return {
      suggestion: `当前行距为 ${String(issue.actual)}，请人工核对排版后将其设为固定值 ${target}`,
      fixability: "manual",
    };
  }

  switch (field) {
    case "font_east_asia":
      return { suggestion: `请将该段落中文字体设为 ${target}`, fixability: "auto" };
    case "font_latin":
      return { suggestion: `请将该段落西文字体设为 ${target}`, fixability: "auto" };
    case "size_pt":
      return { suggestion: `请将该段落字号调整为 ${target}`, fixability: "auto" };
    case "bold":
      return { suggestion: `请将该段落设为 ${target}`, fixability: "auto" };
    case "alignment":
      return { suggestion: `请将该段落对齐方式改为 ${target}`, fixability: "auto" };
    case "spacing_before_pt":
      return { suggestion: `请将该段落段前间距设为 ${target}`, fixability: "auto" };
    case "spacing_after_pt":
      return { suggestion: `请将该段落段后间距设为 ${target}`, fixability: "auto" };
    case "first_line_indent_chars":
      return { suggestion: `请将该段落首行缩进设为 ${target}`, fixability: "auto" };
    case "hanging_indent_chars":
      return { suggestion: `请将该段落悬挂缩进设为 ${target}`, fixability: "auto" };
    case "left_indent_chars":
      return { suggestion: `请将该段落左缩进设为 ${target}`, fixability: "auto" };
    case "outline_level":
      return {
        suggestion: "请调整该段落的大纲级别，使其符合规范层级",
        fixability: "auto",
      };
    case "paper_size":
      return {
        suggestion: `请在页面设置中将纸张大小设为 ${target}`,
        fixability: "manual",
      };
    case "page_number_front":
      return {
        suggestion: `请将前置部分页码格式设为 ${target}（通常需在分节符处单独设置）`,
        fixability: "manual",
      };
    case "page_number_body":
      return {
        suggestion: `请将正文页码设为 ${target}，并在正文起始分节处重新编号`,
        fixability: "manual",
      };
    case "header_text":
      return {
        suggestion: `请在页眉中加入文字「${String(issue.expected ?? "")}」`,
        fixability: "manual",
      };
  }

  if (field in DOC_FIELD_LABELS) {
    return {
      suggestion: `请在页面设置中将${DOC_FIELD_LABELS[field]}设为 ${target}`,
      fixability: "manual",
    };
  }

  // 兜底：未知字段不臆测可自动修复
  return {
    suggestion: `请根据规范要求将该项调整为 ${target}`,
    fixability: "manual",
  };
};
