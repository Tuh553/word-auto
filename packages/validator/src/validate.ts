import { units, type DocModel, type Paragraph } from "@word-auto/parser";
import { classifyParagraphs } from "./classify.js";
import { computeFixHint } from "./fixhints.js";
import { checkNoteConsistency } from "./notes-check.js";
import { checkNumberingSequence } from "./numbering-check.js";
import { checkCaptionReferenceValidity } from "./reference-check.js";
import { isEditableRuleLibrary } from "./rules.js";
import type {
  EditableRuleLibrary,
  Issue,
  ProvenanceEntry,
  Role,
  RuleField,
  RuleFieldKey,
  RuleLibrary,
  RuleValue,
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

const FIELD_NAMES: Record<RuleFieldKey, string> = {
  fontFamilyCn: "font_east_asia",
  fontFamilyLatin: "font_latin",
  fontSizePt: "size_pt",
  bold: "bold",
  align: "alignment",
  lineHeightPt: "line_spacing_pt",
  spaceBeforePt: "spacing_before_pt",
  spaceAfterPt: "spacing_after_pt",
  firstLineIndentChars: "first_line_indent_chars",
  hangingIndentChars: "hanging_indent_chars",
  leftIndentChars: "left_indent_chars",
  outlineLevel: "outline_level",
};

const ROLE_RULE_FALLBACKS: Partial<Record<Role, Role[]>> = {
  acknowledgement_heading: ["back_matter_heading"],
  acknowledgement_body: ["back_matter_body"],
  appendix_heading: ["back_matter_heading"],
  appendix_body: ["back_matter_body"],
  achievement_heading: ["back_matter_heading"],
  achievement_body: ["back_matter_body"],
};

const ROLE_PROVENANCE_KEYS: Partial<Record<Role, string[]>> = {
  abstract_title_cn: ["cn_abstract_title"],
  abstract_body_cn: ["cn_abstract_body"],
  keywords_cn: ["cn_keywords"],
  abstract_title_en: ["en_abstract_title"],
  abstract_body_en: ["en_abstract_body"],
  keywords_en: ["en_keywords"],
  toc_title: ["toc"],
  toc1: ["toc"],
  toc2: ["toc"],
  toc3: ["toc"],
  heading1: ["heading1"],
  heading2: ["heading2"],
  heading3: ["heading3"],
  body_text: ["body"],
  reference_heading: ["references"],
  reference_body: ["references"],
};

const FIELD_PROVENANCE_KEYS: Record<string, string[]> = {
  paper_size: ["page_setup_comment"],
  margin_top_cm: ["page_setup_comment"],
  margin_bottom_cm: ["page_setup_comment"],
  margin_left_cm: ["page_setup_comment"],
  margin_right_cm: ["page_setup_comment"],
  header_distance_cm: ["page_setup_comment"],
  footer_distance_cm: ["page_setup_comment"],
  gutter_cm: ["page_setup_comment"],
  page_number_front: ["page_setup_comment"],
  page_number_body: ["page_setup_comment"],
  header_text: ["page_setup_comment"],
};

const findRuleForRole = (
  role: Role,
  styles: RuleLibrary["styles"] | undefined,
): StyleRule | undefined => {
  const direct = styles?.[role];
  if (direct) return direct;
  for (const legacyRole of ROLE_RULE_FALLBACKS[role] ?? []) {
    const fallback = styles?.[legacyRole];
    if (fallback) return fallback;
  }
  return undefined;
};

const findEditableRoleRule = (
  role: Role,
  rules: EditableRuleLibrary,
) => {
  const direct = rules.roles.find((item) => item.role === role);
  if (direct) return direct;
  for (const legacyRole of ROLE_RULE_FALLBACKS[role] ?? []) {
    const fallback = rules.roles.find((item) => item.role === legacyRole);
    if (fallback) return fallback;
  }
  return undefined;
};

const readProvenanceText = (
  entry: string | ProvenanceEntry | undefined,
): string | undefined => {
  if (typeof entry === "string") {
    const text = entry.trim();
    return text || undefined;
  }
  if (entry && typeof entry.text === "string") {
    const text = entry.text.trim();
    return text || undefined;
  }
  return undefined;
};

const findProvenanceText = (
  rules: RuleLibrary | EditableRuleLibrary,
  keys: string[],
): string | undefined => {
  const provenance = rules.source?.provenance;
  if (!provenance) return undefined;
  for (const key of keys) {
    const text = readProvenanceText(provenance[key]);
    if (text) return text;
  }
  return undefined;
};

const getRoleProvenance = (
  rules: RuleLibrary | EditableRuleLibrary,
  role: Role,
): string | undefined =>
  findProvenanceText(rules, ROLE_PROVENANCE_KEYS[role] ?? []);

const getFieldProvenance = (
  rules: RuleLibrary | EditableRuleLibrary,
  field: string,
): string | undefined =>
  findProvenanceText(rules, FIELD_PROVENANCE_KEYS[field] ?? []);

const textHasCJK = (text: string): boolean => /[一-鿿]/.test(text);
const textHasLatin = (text: string): boolean => /[A-Za-z]/.test(text);

const formatScalar = (value: string | number | boolean): string => {
  if (typeof value === "boolean") return value ? "是" : "否";
  return String(value);
};

const compareScalar = (
  actual: string | number | boolean,
  expected: string | number | boolean,
  tolerance = 0.01,
): boolean => {
  if (typeof actual === "number" && typeof expected === "number") {
    return approx(actual, expected, tolerance);
  }
  return actual === expected;
};

const matchesRuleValue = (
  ruleValue: RuleValue,
  actual: string | number | boolean | undefined,
  tolerance = 0.01,
): boolean => {
  if (ruleValue.mode === "unset") return true;
  if (actual == null) return false;

  switch (ruleValue.mode) {
    case "exact":
      return ruleValue.exact != null &&
        compareScalar(actual, ruleValue.exact, tolerance);
    case "oneOf":
      return (ruleValue.oneOf ?? []).some((item) => compareScalar(actual, item, tolerance));
    case "range":
      if (typeof actual !== "number") return false;
      if (ruleValue.min != null && actual < ruleValue.min) return false;
      if (ruleValue.max != null && actual > ruleValue.max) return false;
      return true;
  }
};

const describeRuleValue = (
  ruleValue: RuleValue,
  formatter: (value: string | number | boolean) => string,
): string => {
  switch (ruleValue.mode) {
    case "exact":
      return `应为 ${formatter(ruleValue.exact as string | number | boolean)}`;
    case "oneOf":
      return `应为以下之一：${(ruleValue.oneOf ?? []).map(formatter).join(" / ")}`;
    case "range":
      if (ruleValue.min != null && ruleValue.max != null) {
        return `应在 ${formatter(ruleValue.min)} ~ ${formatter(ruleValue.max)} 范围内`;
      }
      if (ruleValue.min != null) {
        return `应不小于 ${formatter(ruleValue.min)}`;
      }
      return `应不大于 ${formatter(ruleValue.max as number)}`;
    case "unset":
      return "不校验";
  }
};

const outlineComparable = (value: number | undefined): number =>
  value == null ? 10 : value + 1;

const pushEditableIssue = (
  out: Issue[],
  p: Paragraph,
  role: Role,
  field: RuleField,
  actual: unknown,
  message: string,
  provenance?: string,
): void => {
  out.push({
    paraIndex: p.index,
    role,
    field: FIELD_NAMES[field.key],
    expected: field.value,
    actual,
    severity: field.severity,
    message,
    textPreview: preview(p.text),
    provenance,
  });
};

const checkEditablePara = (
  p: Paragraph,
  role: Role,
  rules: EditableRuleLibrary,
): Issue[] => {
  const roleRule = findEditableRoleRule(role, rules);
  if (!roleRule) return [];

  const e = p.effective;
  const out: Issue[] = [];
  const hasCJK = textHasCJK(p.text);
  const hasLatin = textHasLatin(p.text);
  const provenance = getRoleProvenance(rules, role);

  const handleField = (
    field: RuleField,
    actualValue: string | number | boolean | undefined,
    actualText: string,
    formatter: (value: string | number | boolean) => string,
    tolerance = 0.01,
  ): void => {
    if (!field.enabled || field.value.mode === "unset") return;
    if (matchesRuleValue(field.value, actualValue, tolerance)) return;
    pushEditableIssue(
      out,
      p,
      role,
      field,
      actualValue ?? actualText,
      `${field.label}${describeRuleValue(field.value, formatter)}，实际 ${actualText}`,
      provenance,
    );
  };

  for (const field of roleRule.fields) {
    switch (field.key) {
      case "fontFamilyCn":
        if (hasCJK && e.fontEastAsia) {
          handleField(field, e.fontEastAsia, `「${e.fontEastAsia}」`, (value) => `「${value}」`);
        }
        break;
      case "fontFamilyLatin":
        if (hasLatin && e.fontAscii) {
          handleField(field, e.fontAscii, `「${e.fontAscii}」`, (value) => `「${value}」`);
        }
        break;
      case "fontSizePt":
        if (e.sizePt != null) {
          handleField(field, e.sizePt, `${e.sizePt}pt`, (value) => `${value}pt`);
        }
        break;
      case "bold": {
        const actual = !!e.bold;
        handleField(field, actual, `「${actual ? "是" : "否"}」`, (value) =>
          `「${formatScalar(value)}」`);
        break;
      }
      case "align": {
        const actual = normAlign(e.alignment) ?? "left";
        const actualText = e.alignment == null ? "「left（默认）」" : `「${actual}」`;
        handleField(field, actual, actualText, (value) => `「${value}」`);
        break;
      }
      case "lineHeightPt": {
        const lineSpacing = e.lineSpacing;
        const actualValue = lineSpacing?.pt;
        const actualText = lineSpacing?.pt != null
          ? `${lineSpacing.pt}pt`
          : lineSpacing?.multiple != null
            ? `${lineSpacing.multiple} 倍`
            : "（未设置）";
        handleField(field, actualValue, actualText, (value) => `${value}pt`, 0.5);
        break;
      }
      case "spaceBeforePt":
        if (e.spacingBeforePt != null) {
          handleField(field, e.spacingBeforePt, `${e.spacingBeforePt}pt`, (value) => `${value}pt`);
        }
        break;
      case "spaceAfterPt":
        if (e.spacingAfterPt != null) {
          handleField(field, e.spacingAfterPt, `${e.spacingAfterPt}pt`, (value) => `${value}pt`);
        }
        break;
      case "firstLineIndentChars":
        if (e.firstLineIndentChars != null) {
          handleField(
            field,
            e.firstLineIndentChars,
            `${e.firstLineIndentChars} 字符`,
            (value) => `${value} 字符`,
            0.1,
          );
        }
        break;
      case "hangingIndentChars":
        if (e.hangingIndentChars != null) {
          handleField(
            field,
            e.hangingIndentChars,
            `${e.hangingIndentChars} 字符`,
            (value) => `${value} 字符`,
            0.1,
          );
        }
        break;
      case "leftIndentChars":
        if (e.leftIndentChars != null) {
          handleField(
            field,
            e.leftIndentChars,
            `${e.leftIndentChars} 字符`,
            (value) => `${value} 字符`,
            0.1,
          );
        }
        break;
      case "outlineLevel": {
        const actual = outlineComparable(e.outlineLevel);
        handleField(field, actual, `${actual} 级`, (value) => `${value} 级`);
        break;
      }
    }
  }

  return out;
};

const checkPara = (
  p: Paragraph,
  role: Role,
  rule: StyleRule,
  provenance?: string,
): Issue[] => {
  const e = p.effective;
  const out: Issue[] = [];
  // 段落含哪类字符，决定查不查对应脚本的字体（纯中文段落不报西文字体，反之亦然）
  const hasCJK = textHasCJK(p.text);
  const hasLatin = textHasLatin(p.text);
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
      provenance,
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
const checkDocument = (
  model: DocModel,
  rules: RuleLibrary | EditableRuleLibrary,
): Issue[] => {
  const sec = model.sections.at(-1); // 最后一节为正文主体
  const doc = isEditableRuleLibrary(rules) ? rules.document : rules.document;
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
      provenance: getFieldProvenance(rules, field),
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

/** 分节页码检测：前置部分格式（如大写罗马）、正文格式（阿拉伯）并重新起始 */
const checkPageNumbers = (
  model: DocModel,
  rules: RuleLibrary | EditableRuleLibrary,
): Issue[] => {
  const pn = isEditableRuleLibrary(rules) ? rules.pageNumbers : rules.page_numbers;
  if (!pn) return [];
  const out: Issue[] = [];
  const push = (field: string, expected: unknown, actual: unknown, message: string): void => {
    out.push({
      paraIndex: -1,
      role: "document",
      field,
      expected,
      actual,
      severity: "error",
      message,
      textPreview: "页码",
      provenance: getFieldProvenance(rules, field),
    });
  };

  // 规则页码格式词汇 → OOXML pgNumType@fmt
  const FMT: Record<string, string> = {
    RomanUpper: "upperRoman",
    RomanLower: "lowerRoman",
    Arabic: "decimal",
  };
  const fmts = model.sections.map((s) => s.pageNumberFormat ?? "decimal");

  if (pn.front_matter_format) {
    const want = FMT[pn.front_matter_format] ?? pn.front_matter_format;
    if (!model.sections.some((s) => s.pageNumberFormat === want)) {
      push("page_number_front", pn.front_matter_format, fmts.join(","),
        `前置部分页码应使用 ${pn.front_matter_format}（${want}），未找到对应分节`);
    }
  }

  if (pn.body_format) {
    const want = FMT[pn.body_format] ?? pn.body_format;
    const restart = pn.body_restart_at ?? 1;
    const ok = model.sections.some(
      (s) => (s.pageNumberFormat ?? "decimal") === want && s.pageNumberStart === restart,
    );
    if (!ok) {
      push("page_number_body", `${pn.body_format} start=${restart}`, fmts.join(","),
        `正文页码应为 ${pn.body_format}（${want}）并从 ${restart} 重新编号`);
    }
  }

  return out;
};

/** 页眉内容检测：页眉是否包含规定文字（如「重庆大学硕士学位论文」） */
const checkHeaders = (
  model: DocModel,
  rules: RuleLibrary | EditableRuleLibrary,
): Issue[] => {
  const h = rules.headers;
  if (!h?.left_text) return [];
  const target = h.left_text.replace(/\s+/g, "");
  const structuredHeaders = model.headerParts ?? [];
  const candidateTexts = structuredHeaders.length > 0
    ? structuredHeaders.map((part) => part.leftText)
    : model.headers;
  const found = candidateTexts.some((t) => t.replace(/\s+/g, "").includes(target));
  if (found) return [];
  const actual = structuredHeaders.length > 0
    ? structuredHeaders
        .map((part) => part.leftText || "(左侧无文字)")
        .join(" / ")
    : model.headers.join(" / ");
  return [
    {
      paraIndex: -1,
      role: "document",
      field: "header_text",
      expected: h.left_text,
      actual: actual || "(无页眉文字)",
      severity: "warn",
      message: `页眉应包含「${h.left_text}」`,
      textPreview: "页眉",
      provenance: getFieldProvenance(rules, "header_text"),
    },
  ];
};

/** 校验整篇文档 */
export const validateDoc = (
  model: DocModel,
  rules: RuleLibrary | EditableRuleLibrary,
): ValidationReport => {
  const roles = classifyParagraphs(model.paragraphs);
  const classified = roles.map((role, i) => ({
    para: model.paragraphs[i],
    role: role ?? null,
  }));

  const issues: Issue[] = [
    ...checkDocument(model, rules),
    ...checkPageNumbers(model, rules),
    ...checkHeaders(model, rules),
  ];

  // 结构化编号 / 域引用检测（转换为 Issue 格式）
  const structuredIssues = [
    ...checkNumberingSequence(model, classified),
    ...checkCaptionReferenceValidity(classified),
    ...checkNoteConsistency(model, classified),
  ];
  for (const vi of structuredIssues) {
    if (vi.type === "paragraph" && vi.paragraphIndex !== undefined) {
      const para = model.paragraphs[vi.paragraphIndex];
      issues.push({
        paraIndex: vi.paragraphIndex,
        role: vi.role,
        field: vi.field,
        expected: vi.expected,
        actual: vi.actual,
        severity: vi.severity,
        message: vi.message,
        textPreview: para?.text.slice(0, 24) ?? "",
        suggestion: vi.fixHint,
        fixability: vi.canAutoFix ? "auto" : "manual",
      });
      continue;
    }
    if (vi.type === "document") {
      issues.push({
        paraIndex: -1,
        role: vi.role,
        field: vi.field,
        expected: vi.expected,
        actual: vi.actual,
        severity: vi.severity,
        message: vi.message,
        textPreview: vi.textPreview ?? "",
        provenance: vi.provenance,
        suggestion: vi.fixHint,
        fixability: vi.canAutoFix ? "auto" : "manual",
      });
    }
  }

  let classifiedCount = 0;

  model.paragraphs.forEach((p, i) => {
    const cp = classified[i];
    if (!cp.role) return;
    classifiedCount++;
    if (isEditableRuleLibrary(rules)) {
      issues.push(...checkEditablePara(p, cp.role, rules));
      return;
    }
    const rule = findRuleForRole(cp.role, rules.styles);
    if (rule) issues.push(...checkPara(p, cp.role, rule, getRoleProvenance(rules, cp.role)));
  });

  const summary = { error: 0, warn: 0, info: 0, byRole: {} as Record<string, number> };
  for (const it of issues) {
    summary[it.severity]++;
    summary.byRole[it.role] = (summary.byRole[it.role] ?? 0) + 1;
  }

  // 统一为每条问题补齐修复建议与可修复性（只在此一处处理，避免散落各 push 点）
  const decorated = issues.map((it) => ({ ...it, ...computeFixHint(it) }));

  return {
    ruleName: isEditableRuleLibrary(rules) ? rules.name : rules.meta?.name,
    paragraphCount: model.paragraphs.length,
    classifiedCount,
    issues: decorated,
    summary,
  };
};
