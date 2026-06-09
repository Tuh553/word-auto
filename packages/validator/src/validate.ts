import { units, type DocModel, type Paragraph } from "@word-auto/parser";
import { classifyParagraphs } from "./classify.js";
import type {
  Issue,
  Role,
  RuleLibrary,
  Severity,
  StyleRule,
  ValidationReport,
} from "./types.js";

/** OOXML 对齐值归一到规则词汇 */
const normAlign = (a?: string): string | undefined => {
  if (!a) return a;
  const map: Record<string, string> = {
    both: "justify",
    distribute: "justify",
    start: "left",
    end: "right",
  };
  return map[a] ?? a;
};

const approx = (a: number, b: number, tol: number): boolean =>
  Math.abs(a - b) <= tol;

const preview = (t: string): string =>
  t.replace(/\s+/g, " ").trim().slice(0, 24);

const checkPara = (p: Paragraph, role: Role, rule: StyleRule): Issue[] => {
  const e = p.effective;
  const out: Issue[] = [];
  // 段落含哪类字符，决定查不查对应脚本的字体（纯中文段落不报西文字体，反之亦然）
  const hasCJK = /[一-鿿]/.test(p.text);
  const hasLatin = /[A-Za-z]/.test(p.text);
  const push = (
    field: string,
    expected: unknown,
    actual: unknown,
    severity: Severity,
    message: string,
  ): void => {
    out.push({
      paraIndex: p.index,
      role,
      field,
      expected,
      actual,
      severity,
      message,
      textPreview: preview(p.text),
    });
  };

  // 中文字体（仅当段落含中文且文档显式标注/主题可解析时比对）
  if (rule.font_east_asia && hasCJK && e.fontEastAsia && e.fontEastAsia !== rule.font_east_asia) {
    push("font_east_asia", rule.font_east_asia, e.fontEastAsia, "error",
      `中文字体应为「${rule.font_east_asia}」，实际「${e.fontEastAsia}」`);
  }

  // 西文字体（仅当段落含拉丁字母时比对）
  if (rule.font_latin && hasLatin && e.fontAscii && e.fontAscii !== rule.font_latin) {
    push("font_latin", rule.font_latin, e.fontAscii, "error",
      `西文字体应为「${rule.font_latin}」，实际「${e.fontAscii}」`);
  }

  // 字号
  if (rule.size_pt != null && e.sizePt != null && !approx(e.sizePt, rule.size_pt, 0.01)) {
    push("size_pt", rule.size_pt, e.sizePt, "error",
      `字号应为 ${rule.size_pt}pt，实际 ${e.sizePt}pt`);
  }

  // 加粗
  if (rule.bold != null) {
    const actual = !!e.bold;
    if (actual !== rule.bold) {
      push("bold", rule.bold, actual, "warn",
        `加粗应为「${rule.bold ? "是" : "否"}」，实际「${actual ? "是" : "否"}」`);
    }
  }

  // 对齐
  if (rule.alignment) {
    const actual = normAlign(e.alignment) ?? "left";
    if (actual !== normAlign(rule.alignment)) {
      push("alignment", rule.alignment, e.alignment ?? "(默认 left)", "warn",
        `对齐应为「${rule.alignment}」，实际「${actual}」`);
    }
  }

  // 行距（规则用固定 pt）
  if (rule.line_spacing_pt != null) {
    const ls = e.lineSpacing;
    if (ls?.pt != null) {
      if (!approx(ls.pt, rule.line_spacing_pt, 0.5)) {
        push("line_spacing_pt", rule.line_spacing_pt, ls.pt, "warn",
          `行距应为固定 ${rule.line_spacing_pt}pt，实际固定 ${ls.pt}pt`);
      }
    } else if (ls?.multiple != null) {
      push("line_spacing_pt", rule.line_spacing_pt, `${ls.multiple} 倍`, "warn",
        `行距应为固定 ${rule.line_spacing_pt}pt，实际为 ${ls.multiple} 倍多倍行距`);
    } else {
      push("line_spacing_pt", rule.line_spacing_pt, "(未设置)", "info",
        `未显式设置行距（应为固定 ${rule.line_spacing_pt}pt）`);
    }
  }

  // 首行缩进（字符）
  if (
    rule.first_line_indent_chars != null &&
    e.firstLineIndentChars != null &&
    !approx(e.firstLineIndentChars, rule.first_line_indent_chars, 0.1)
  ) {
    push("first_line_indent_chars", rule.first_line_indent_chars, e.firstLineIndentChars,
      "warn", `首行缩进应为 ${rule.first_line_indent_chars} 字符，实际 ${e.firstLineIndentChars} 字符`);
  }

  return out;
};

/** 文档/页面级检测：页边距、页眉页脚距、装订线、纸张 */
const checkDocument = (model: DocModel, rules: RuleLibrary): Issue[] => {
  const sec = model.sections.at(-1); // 最后一节为正文主体
  const doc = rules.document;
  if (!sec || !doc) return [];
  const out: Issue[] = [];

  const push = (
    field: string,
    expected: unknown,
    actual: unknown,
    message: string,
  ): void => {
    out.push({
      paraIndex: -1,
      role: "document",
      field,
      expected,
      actual,
      severity: "error",
      message,
      textPreview: "页面设置",
    });
  };

  const cm = (tw?: number): number | undefined =>
    tw == null ? undefined : units.round(units.twipsToCm(tw), 2);

  const checkCm = (
    field: string,
    label: string,
    ruleCm: number | undefined,
    tw: number | undefined,
  ): void => {
    if (ruleCm == null) return;
    const actual = cm(tw);
    if (actual == null) return;
    if (Math.abs(actual - ruleCm) > 0.05) {
      push(field, ruleCm, actual, `${label}应为 ${ruleCm}cm，实际 ${actual}cm`);
    }
  };

  checkCm("margin_top_cm", "上边距", doc.margin_top_cm, sec.marginTopTwips);
  checkCm("margin_bottom_cm", "下边距", doc.margin_bottom_cm, sec.marginBottomTwips);
  checkCm("margin_left_cm", "左边距", doc.margin_left_cm, sec.marginLeftTwips);
  checkCm("margin_right_cm", "右边距", doc.margin_right_cm, sec.marginRightTwips);
  checkCm("header_distance_cm", "页眉距", doc.header_distance_cm, sec.headerTwips);
  checkCm("footer_distance_cm", "页脚距", doc.footer_distance_cm, sec.footerTwips);
  checkCm("gutter_cm", "装订线", doc.gutter_cm, sec.gutterTwips);

  if (doc.paper_size === "A4" && sec.pageWidthTwips && sec.pageHeightTwips) {
    const w = cm(sec.pageWidthTwips)!;
    const h = cm(sec.pageHeightTwips)!;
    if (Math.abs(w - 21) > 0.1 || Math.abs(h - 29.7) > 0.1) {
      push("paper_size", "A4 (21×29.7cm)", `${w}×${h}cm`,
        `纸张应为 A4 (21×29.7cm)，实际 ${w}×${h}cm`);
    }
  }

  return out;
};

/** 校验整篇文档 */
export const validateDoc = (
  model: DocModel,
  rules: RuleLibrary,
): ValidationReport => {
  const roles = classifyParagraphs(model.paragraphs);
  const issues: Issue[] = [...checkDocument(model, rules)];
  let classified = 0;

  model.paragraphs.forEach((p, i) => {
    const role = roles[i];
    if (!role) return;
    classified++;
    const rule = rules.styles?.[role];
    if (!rule) return;
    issues.push(...checkPara(p, role, rule));
  });

  const summary = { error: 0, warn: 0, info: 0, byRole: {} as Record<string, number> };
  for (const it of issues) {
    summary[it.severity]++;
    summary.byRole[it.role] = (summary.byRole[it.role] ?? 0) + 1;
  }

  return {
    ruleName: rules.meta?.name,
    paragraphCount: model.paragraphs.length,
    classifiedCount: classified,
    issues,
    summary,
  };
};
