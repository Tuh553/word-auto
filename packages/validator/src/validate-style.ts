import type { Paragraph } from "@word-auto/parser";
import type {
  EditableRuleLibrary,
  Issue,
  Role,
  RuleField,
  RuleFieldKey,
  RuleValue,
  Severity,
  StyleRule,
} from "./types.js";
import { findEditableRoleRule, getRoleProvenance } from "./validate-rules.js";

type Scalar = string | number | boolean;
type EffectiveProps = Paragraph["effective"];
type ValueFormatter = (value: Scalar) => string;

interface ParagraphIssueContext {
  para: Paragraph;
  role: Role;
  effective: EffectiveProps;
  hasCJK: boolean;
  hasLatin: boolean;
  provenance?: string;
}

interface EditableParagraphContext extends ParagraphIssueContext {
  pushFieldIssue: (field: RuleField, actualValue: Scalar | undefined, actualText: string, formatter: ValueFormatter, tolerance?: number) => void;
}

interface LegacyParagraphContext extends ParagraphIssueContext {
  rule: StyleRule;
  push: (field: string, expected: unknown, actual: unknown, severity: Severity, message: string) => void;
}

interface CreateParagraphIssueArgs {
  context: ParagraphIssueContext;
  field: string;
  expected: unknown;
  actual: unknown;
  severity: Severity;
  message: string;
}

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

const EDITABLE_FIELD_TOLERANCE = 0.01;
const LINE_HEIGHT_TOLERANCE = 0.5;
const INDENT_TOLERANCE = 0.1;

const normAlign = (value?: string): string | undefined => {
  if (!value) return value;
  const map: Record<string, string> = { both: "justify", distribute: "justify", start: "left", end: "right" };
  return map[value] ?? value;
};

const approx = (a: number, b: number, tolerance: number): boolean => Math.abs(a - b) <= tolerance;
const preview = (text: string): string => text.replace(/\s+/g, " ").trim().slice(0, 24);
const textHasCJK = (text: string): boolean => /[一-鿿]/.test(text);
const textHasLatin = (text: string): boolean => /[A-Za-z]/.test(text);
const formatScalar = (value: Scalar): string => typeof value === "boolean" ? (value ? "是" : "否") : String(value);
const outlineComparable = (value: number | undefined): number => value == null ? 10 : value + 1;

const compareScalar = (
  actual: Scalar,
  expected: Scalar,
  tolerance = EDITABLE_FIELD_TOLERANCE,
): boolean => {
  if (typeof actual === "number" && typeof expected === "number") {
    return approx(actual, expected, tolerance);
  }
  return actual === expected;
};

const matchesRuleValue = (
  ruleValue: RuleValue,
  actual: Scalar | undefined,
  tolerance = EDITABLE_FIELD_TOLERANCE,
): boolean => {
  if (ruleValue.mode === "unset") return true;
  if (actual == null) return false;
  switch (ruleValue.mode) {
    case "exact":
      return ruleValue.exact != null && compareScalar(actual, ruleValue.exact, tolerance);
    case "oneOf":
      return (ruleValue.oneOf ?? []).some((item) => compareScalar(actual, item, tolerance));
    case "range":
      if (typeof actual !== "number") return false;
      if (ruleValue.min != null && actual < ruleValue.min) return false;
      return ruleValue.max == null || actual <= ruleValue.max;
  }
};

const describeRuleValue = (ruleValue: RuleValue, formatter: ValueFormatter): string => {
  switch (ruleValue.mode) {
    case "exact":
      return `应为 ${formatter(ruleValue.exact as Scalar)}`;
    case "oneOf":
      return `应为以下之一：${(ruleValue.oneOf ?? []).map(formatter).join(" / ")}`;
    case "range":
      if (ruleValue.min != null && ruleValue.max != null) {
        return `应在 ${formatter(ruleValue.min)} ~ ${formatter(ruleValue.max)} 范围内`;
      }
      if (ruleValue.min != null) return `应不小于 ${formatter(ruleValue.min)}`;
      return `应不大于 ${formatter(ruleValue.max as number)}`;
    case "unset":
      return "不校验";
  }
};

const createParagraphIssue = ({
  context,
  field,
  expected,
  actual,
  severity,
  message,
}: CreateParagraphIssueArgs): Issue => ({
  paraIndex: context.para.index,
  role: context.role,
  field,
  expected,
  actual,
  severity,
  message,
  textPreview: preview(context.para.text),
  provenance: context.provenance,
});

const createParagraphIssuePush = (
  context: ParagraphIssueContext,
  out: Issue[],
): LegacyParagraphContext["push"] => (field, expected, actual, severity, message) => {
  out.push(createParagraphIssue({ context, field, expected, actual, severity, message }));
};

const pushEditableFieldIssue = (
  context: ParagraphIssueContext,
  out: Issue[],
  field: RuleField,
  actual: unknown,
  message: string,
): void => {
  out.push(createParagraphIssue({
    context,
    field: FIELD_NAMES[field.key],
    expected: field.value,
    actual,
    severity: field.severity,
    message,
  }));
};

const createParagraphContext = (
  para: Paragraph,
  role: Role,
  provenance?: string,
): ParagraphIssueContext => ({
  para,
  role,
  effective: para.effective,
  hasCJK: textHasCJK(para.text),
  hasLatin: textHasLatin(para.text),
  provenance,
});

const createEditableContext = (
  para: Paragraph,
  role: Role,
  provenance: string | undefined,
  out: Issue[],
): EditableParagraphContext => {
  const context = createParagraphContext(para, role, provenance);
  return {
    ...context,
    pushFieldIssue: (field, actualValue, actualText, formatter, tolerance = EDITABLE_FIELD_TOLERANCE) => {
      if (!field.enabled || field.value.mode === "unset") return;
      if (matchesRuleValue(field.value, actualValue, tolerance)) return;
      pushEditableFieldIssue(
        context,
        out,
        field,
        actualValue ?? actualText,
        `${field.label}${describeRuleValue(field.value, formatter)}，实际 ${actualText}`,
      );
    },
  };
};

const pushStringField = (context: EditableParagraphContext, field: RuleField, actualValue: string | undefined): void => {
  if (!actualValue) return;
  context.pushFieldIssue(field, actualValue, `「${actualValue}」`, (value) => `「${value}」`);
};

const pushNumericField = (
  context: EditableParagraphContext,
  field: RuleField,
  actualValue: number | undefined,
  suffix: string,
  tolerance = EDITABLE_FIELD_TOLERANCE,
): void => {
  if (actualValue == null) return;
  context.pushFieldIssue(field, actualValue, `${actualValue}${suffix}`, (value) => `${value}${suffix}`, tolerance);
};

const checkEditableCnFont = (context: EditableParagraphContext, field: RuleField): void => {
  if (!context.hasCJK) return;
  pushStringField(context, field, context.effective.fontEastAsia);
};

const checkEditableLatinFont = (context: EditableParagraphContext, field: RuleField): void => {
  if (!context.hasLatin) return;
  pushStringField(context, field, context.effective.fontAscii);
};

const checkEditableFontSize = (context: EditableParagraphContext, field: RuleField): void => {
  pushNumericField(context, field, context.effective.sizePt, "pt");
};

const checkEditableBold = (context: EditableParagraphContext, field: RuleField): void => {
  const actual = !!context.effective.bold;
  context.pushFieldIssue(field, actual, `「${actual ? "是" : "否"}」`, (value) => `「${formatScalar(value)}」`);
};

const checkEditableAlignment = (context: EditableParagraphContext, field: RuleField): void => {
  const actual = normAlign(context.effective.alignment);
  const actualText = actual == null ? "（未设置）" : `「${actual}」`;
  context.pushFieldIssue(field, actual, actualText, (value) => `「${value}」`);
};

const checkEditableLineHeight = (context: EditableParagraphContext, field: RuleField): void => {
  const lineSpacing = context.effective.lineSpacing;
  const actualValue = lineSpacing?.pt;
  const actualText = lineSpacing?.pt != null ? `${lineSpacing.pt}pt` : lineSpacing?.multiple != null ? `${lineSpacing.multiple} 倍` : "（未设置）";
  context.pushFieldIssue(field, actualValue, actualText, (value) => `${value}pt`, LINE_HEIGHT_TOLERANCE);
};

const checkEditableSpaceBefore = (context: EditableParagraphContext, field: RuleField): void => {
  pushNumericField(context, field, context.effective.spacingBeforePt, "pt");
};

const checkEditableSpaceAfter = (context: EditableParagraphContext, field: RuleField): void => {
  pushNumericField(context, field, context.effective.spacingAfterPt, "pt");
};

const checkEditableFirstLineIndent = (context: EditableParagraphContext, field: RuleField): void => {
  pushNumericField(context, field, context.effective.firstLineIndentChars, " 字符", INDENT_TOLERANCE);
};

const checkEditableHangingIndent = (context: EditableParagraphContext, field: RuleField): void => {
  pushNumericField(context, field, context.effective.hangingIndentChars, " 字符", INDENT_TOLERANCE);
};

const checkEditableLeftIndent = (context: EditableParagraphContext, field: RuleField): void => {
  pushNumericField(context, field, context.effective.leftIndentChars, " 字符", INDENT_TOLERANCE);
};

const checkEditableOutlineLevel = (context: EditableParagraphContext, field: RuleField): void => {
  const actual = outlineComparable(context.effective.outlineLevel);
  context.pushFieldIssue(field, actual, `${actual} 级`, (value) => `${value} 级`);
};

const EDITABLE_FIELD_CHECKERS: Record<RuleFieldKey, (context: EditableParagraphContext, field: RuleField) => void> = {
  fontFamilyCn: checkEditableCnFont,
  fontFamilyLatin: checkEditableLatinFont,
  fontSizePt: checkEditableFontSize,
  bold: checkEditableBold,
  align: checkEditableAlignment,
  lineHeightPt: checkEditableLineHeight,
  spaceBeforePt: checkEditableSpaceBefore,
  spaceAfterPt: checkEditableSpaceAfter,
  firstLineIndentChars: checkEditableFirstLineIndent,
  hangingIndentChars: checkEditableHangingIndent,
  leftIndentChars: checkEditableLeftIndent,
  outlineLevel: checkEditableOutlineLevel,
};

const checkLegacyCnFont = (context: LegacyParagraphContext): void => {
  const expected = context.rule.font_east_asia;
  const actual = context.effective.fontEastAsia;
  if (!expected || !context.hasCJK || !actual || actual === expected) return;
  context.push("font_east_asia", expected, actual, "error", `中文字体应为「${expected}」，实际「${actual}」`);
};

const checkLegacyLatinFont = (context: LegacyParagraphContext): void => {
  const expected = context.rule.font_latin;
  const actual = context.effective.fontAscii;
  if (!expected || !context.hasLatin || !actual || actual === expected) return;
  context.push("font_latin", expected, actual, "error", `西文字体应为「${expected}」，实际「${actual}」`);
};

const checkLegacyFontSize = (context: LegacyParagraphContext): void => {
  const expected = context.rule.size_pt;
  const actual = context.effective.sizePt;
  if (expected == null || actual == null || approx(actual, expected, EDITABLE_FIELD_TOLERANCE)) return;
  context.push("size_pt", expected, actual, "error", `字号应为 ${expected}pt，实际 ${actual}pt`);
};

const checkLegacyBold = (context: LegacyParagraphContext): void => {
  if (context.rule.bold == null) return;
  const actual = !!context.effective.bold;
  if (actual === context.rule.bold) return;
  context.push("bold", context.rule.bold, actual, "warn", `加粗应为「${context.rule.bold ? "是" : "否"}」，实际「${actual ? "是" : "否"}」`);
};

const checkLegacyAlignment = (context: LegacyParagraphContext): void => {
  const expected = context.rule.alignment;
  if (!expected) return;
  const actual = normAlign(context.effective.alignment);
  if (actual === normAlign(expected)) return;
  context.push(
    "alignment",
    expected,
    actual ?? "(未设置)",
    "warn",
    `对齐应为「${expected}」，实际${actual == null ? "（未设置）" : `「${actual}」`}`,
  );
};

const checkLegacyLineSpacing = (context: LegacyParagraphContext): void => {
  const expected = context.rule.line_spacing_pt;
  if (expected == null) return;
  const lineSpacing = context.effective.lineSpacing;
  if (lineSpacing?.pt != null) {
    if (approx(lineSpacing.pt, expected, LINE_HEIGHT_TOLERANCE)) return;
    context.push("line_spacing_pt", expected, lineSpacing.pt, "warn", `行距应为固定 ${expected}pt，实际固定 ${lineSpacing.pt}pt`);
    return;
  }
  if (lineSpacing?.multiple != null) {
    context.push("line_spacing_pt", expected, `${lineSpacing.multiple} 倍`, "warn", `行距应为固定 ${expected}pt，实际为 ${lineSpacing.multiple} 倍多倍行距`);
    return;
  }
  context.push("line_spacing_pt", expected, "(未设置)", "info", `未显式设置行距（应为固定 ${expected}pt）`);
};

const checkLegacyFirstLineIndent = (context: LegacyParagraphContext): void => {
  const expected = context.rule.first_line_indent_chars;
  const actual = context.effective.firstLineIndentChars;
  if (expected == null || actual == null || approx(actual, expected, INDENT_TOLERANCE)) return;
  context.push("first_line_indent_chars", expected, actual, "warn", `首行缩进应为 ${expected} 字符，实际 ${actual} 字符`);
};

const LEGACY_CHECKERS = [
  checkLegacyCnFont,
  checkLegacyLatinFont,
  checkLegacyFontSize,
  checkLegacyBold,
  checkLegacyAlignment,
  checkLegacyLineSpacing,
  checkLegacyFirstLineIndent,
] as const;

export const checkEditablePara = (
  para: Paragraph,
  role: Role,
  rules: EditableRuleLibrary,
): Issue[] => {
  const roleRule = findEditableRoleRule(role, rules);
  if (!roleRule) return [];
  const out: Issue[] = [];
  const context = createEditableContext(para, role, getRoleProvenance(rules, role), out);
  for (const field of roleRule.fields) {
    EDITABLE_FIELD_CHECKERS[field.key](context, field);
  }
  return out;
};

export const checkPara = (
  para: Paragraph,
  role: Role,
  rule: StyleRule,
  provenance?: string,
): Issue[] => {
  const out: Issue[] = [];
  const contextBase = createParagraphContext(para, role, provenance);
  const context: LegacyParagraphContext = {
    ...contextBase,
    rule,
    push: createParagraphIssuePush(contextBase, out),
  };
  for (const checker of LEGACY_CHECKERS) {
    checker(context);
  }
  return out;
};
