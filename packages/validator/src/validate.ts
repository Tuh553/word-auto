import { units, type DocModel } from "@word-auto/parser";
import { classifyParagraphs } from "./classify.js";
import { computeFixHint } from "./fixhints.js";
import { checkNoteConsistency } from "./notes-check.js";
import { checkNumberingSequence } from "./numbering-check.js";
import { checkCaptionReferenceValidity } from "./reference-check.js";
import { isEditableRuleLibrary } from "./rules.js";
import type {
  EditableRuleLibrary,
  Issue,
  RuleLibrary,
  ValidationReport,
} from "./types.js";
import {
  checkEditablePara,
  checkPara,
} from "./validate-style.js";
import {
  findRuleForRole,
  getFieldProvenance,
  getRoleProvenance,
} from "./validate-rules.js";

type ValidationRules = RuleLibrary | EditableRuleLibrary;

const PAGE_NUMBER_FORMATS: Record<string, string> = {
  RomanUpper: "upperRoman",
  RomanLower: "lowerRoman",
  Arabic: "decimal",
};

interface DocumentIssueArgs {
  out: Issue[];
  rules: ValidationRules;
  field: string;
  expected: unknown;
  actual: unknown;
  severity: Issue["severity"];
  message: string;
  textPreview: string;
}

const pushDocumentIssue = ({
  out,
  rules,
  field,
  expected,
  actual,
  severity,
  message,
  textPreview,
}: DocumentIssueArgs): void => {
  out.push({
    paraIndex: -1,
    role: "document",
    field,
    expected,
    actual,
    severity,
    message,
    textPreview,
    provenance: getFieldProvenance(rules, field),
  });
};

const cmFromTwips = (value?: number): number | undefined =>
  value == null ? undefined : units.round(units.twipsToCm(value), 2);

interface DimensionCheckArgs {
  out: Issue[];
  rules: ValidationRules;
  field: string;
  label: string;
  expectedCm: number | undefined;
  actualTwips: number | undefined;
}

const checkDimensionField = ({
  out,
  rules,
  field,
  label,
  expectedCm,
  actualTwips,
}: DimensionCheckArgs): void => {
  if (expectedCm == null) return;
  const actual = cmFromTwips(actualTwips);
  if (actual == null || Math.abs(actual - expectedCm) <= 0.05) return;
  pushDocumentIssue({
    out,
    rules,
    field,
    expected: expectedCm,
    actual,
    severity: "error",
    message: `${label}应为 ${expectedCm}cm，实际 ${actual}cm`,
    textPreview: "页面设置",
  });
};

const checkPaperSize = (
  out: Issue[],
  rules: ValidationRules,
  paperSize: string | undefined,
  pageWidthTwips: number | undefined,
  pageHeightTwips: number | undefined,
): void => {
  if (paperSize !== "A4" || !pageWidthTwips || !pageHeightTwips) return;
  const width = cmFromTwips(pageWidthTwips);
  const height = cmFromTwips(pageHeightTwips);
  if (width == null || height == null) return;
  if (Math.abs(width - 21) <= 0.1 && Math.abs(height - 29.7) <= 0.1) return;
  pushDocumentIssue({
    out,
    rules,
    field: "paper_size",
    expected: "A4 (21×29.7cm)",
    actual: `${width}×${height}cm`,
    severity: "error",
    message: `纸张应为 A4 (21×29.7cm)，实际 ${width}×${height}cm`,
    textPreview: "页面设置",
  });
};

const checkDocument = (
  model: DocModel,
  rules: ValidationRules,
): Issue[] => {
  const section = model.sections.at(-1);
  const documentRules = rules.document;
  if (!section || !documentRules) return [];

  const out: Issue[] = [];
  checkDimensionField({ out, rules, field: "margin_top_cm", label: "上边距", expectedCm: documentRules.margin_top_cm, actualTwips: section.marginTopTwips });
  checkDimensionField({ out, rules, field: "margin_bottom_cm", label: "下边距", expectedCm: documentRules.margin_bottom_cm, actualTwips: section.marginBottomTwips });
  checkDimensionField({ out, rules, field: "margin_left_cm", label: "左边距", expectedCm: documentRules.margin_left_cm, actualTwips: section.marginLeftTwips });
  checkDimensionField({ out, rules, field: "margin_right_cm", label: "右边距", expectedCm: documentRules.margin_right_cm, actualTwips: section.marginRightTwips });
  checkDimensionField({ out, rules, field: "header_distance_cm", label: "页眉距", expectedCm: documentRules.header_distance_cm, actualTwips: section.headerTwips });
  checkDimensionField({ out, rules, field: "footer_distance_cm", label: "页脚距", expectedCm: documentRules.footer_distance_cm, actualTwips: section.footerTwips });
  checkDimensionField({ out, rules, field: "gutter_cm", label: "装订线", expectedCm: documentRules.gutter_cm, actualTwips: section.gutterTwips });
  checkPaperSize(out, rules, documentRules.paper_size, section.pageWidthTwips, section.pageHeightTwips);
  return out;
};

const matchesPageNumberRule = (
  format: string | undefined,
  expectedFormat: string,
  restartAt?: number,
  expectedRestartAt?: number,
): boolean => {
  if ((format ?? "decimal") !== expectedFormat) return false;
  return expectedRestartAt == null || restartAt === expectedRestartAt;
};

const checkPageNumbers = (
  model: DocModel,
  rules: ValidationRules,
): Issue[] => {
  const pageNumbers = isEditableRuleLibrary(rules) ? rules.pageNumbers : rules.page_numbers;
  if (!pageNumbers) return [];

  const out: Issue[] = [];
  const formats = model.sections.map((section) => section.pageNumberFormat ?? "decimal").join(",");

  if (pageNumbers.front_matter_format) {
    const expected = PAGE_NUMBER_FORMATS[pageNumbers.front_matter_format] ?? pageNumbers.front_matter_format;
    const found = model.sections.some((section) =>
      matchesPageNumberRule(section.pageNumberFormat, expected),
    );
    if (!found) {
      pushDocumentIssue({
        out,
        rules,
        field: "page_number_front",
        expected: pageNumbers.front_matter_format,
        actual: formats,
        severity: "error",
        message: `前置部分页码应使用 ${pageNumbers.front_matter_format}（${expected}），未找到对应分节`,
        textPreview: "页码",
      });
    }
  }

  if (pageNumbers.body_format) {
    const expected = PAGE_NUMBER_FORMATS[pageNumbers.body_format] ?? pageNumbers.body_format;
    const restartAt = pageNumbers.body_restart_at ?? 1;
    const found = model.sections.some((section) =>
      matchesPageNumberRule(section.pageNumberFormat, expected, section.pageNumberStart, restartAt),
    );
    if (!found) {
      pushDocumentIssue({
        out,
        rules,
        field: "page_number_body",
        expected: `${pageNumbers.body_format} start=${restartAt}`,
        actual: formats,
        severity: "error",
        message: `正文页码应为 ${pageNumbers.body_format}（${expected}）并从 ${restartAt} 重新编号`,
        textPreview: "页码",
      });
    }
  }

  return out;
};

const checkHeaders = (
  model: DocModel,
  rules: ValidationRules,
): Issue[] => {
  const leftText = rules.headers?.left_text;
  if (!leftText) return [];

  const target = leftText.replace(/\s+/g, "");
  const structuredHeaders = model.headerParts ?? [];
  const candidateTexts = structuredHeaders.length > 0
    ? structuredHeaders.map((part) => part.leftText)
    : model.headers;
  const found = candidateTexts.some((text) => text.replace(/\s+/g, "").includes(target));
  if (found) return [];

  const actual = structuredHeaders.length > 0
    ? structuredHeaders.map((part) => part.leftText || "(左侧无文字)").join(" / ")
    : model.headers.join(" / ");
  return [{
    paraIndex: -1,
    role: "document",
    field: "header_text",
    expected: leftText,
    actual: actual || "(无页眉文字)",
    severity: "warn",
    message: `页眉应包含「${leftText}」`,
    textPreview: "页眉",
    provenance: getFieldProvenance(rules, "header_text"),
  }];
};

const collectStructuredIssues = (
  model: DocModel,
  classified: Array<{ para: DocModel["paragraphs"][number]; role: ReturnType<typeof classifyParagraphs>[number] | null }>,
): Issue[] => {
  const issues: Issue[] = [];
  const structuredIssues = [
    ...checkNumberingSequence(model, classified),
    ...checkCaptionReferenceValidity(classified),
    ...checkNoteConsistency(model, classified),
  ];

  for (const item of structuredIssues) {
    if (item.type === "paragraph" && item.paragraphIndex !== undefined) {
      const para = model.paragraphs[item.paragraphIndex];
      issues.push({
        paraIndex: item.paragraphIndex,
        role: item.role,
        field: item.field,
        expected: item.expected,
        actual: item.actual,
        severity: item.severity,
        message: item.message,
        textPreview: para?.text.slice(0, 24) ?? "",
        suggestion: item.fixHint,
        fixability: item.canAutoFix ? "auto" : "manual",
      });
      continue;
    }

    if (item.type === "document") {
      issues.push({
        paraIndex: -1,
        role: item.role,
        field: item.field,
        expected: item.expected,
        actual: item.actual,
        severity: item.severity,
        message: item.message,
        textPreview: item.textPreview ?? "",
        provenance: item.provenance,
        suggestion: item.fixHint,
        fixability: item.canAutoFix ? "auto" : "manual",
      });
    }
  }

  return issues;
};

const collectParagraphIssues = (
  model: DocModel,
  classified: Array<{ para: DocModel["paragraphs"][number]; role: ReturnType<typeof classifyParagraphs>[number] | null }>,
  rules: ValidationRules,
): { classifiedCount: number; issues: Issue[] } => {
  const issues: Issue[] = [];
  let classifiedCount = 0;

  model.paragraphs.forEach((paragraph, index) => {
    const current = classified[index];
    if (!current.role) return;
    classifiedCount++;

    if (isEditableRuleLibrary(rules)) {
      issues.push(...checkEditablePara(paragraph, current.role, rules));
      return;
    }

    const rule = findRuleForRole(current.role, rules.styles);
    if (!rule) return;
    issues.push(...checkPara(paragraph, current.role, rule, getRoleProvenance(rules, current.role)));
  });

  return { classifiedCount, issues };
};

const summarizeIssues = (issues: Issue[]): ValidationReport["summary"] => {
  const summary = { error: 0, warn: 0, info: 0, byRole: {} as Record<string, number> };
  for (const issue of issues) {
    summary[issue.severity]++;
    summary.byRole[issue.role] = (summary.byRole[issue.role] ?? 0) + 1;
  }
  return summary;
};

export const validateDoc = (
  model: DocModel,
  rules: ValidationRules,
): ValidationReport => {
  const roles = classifyParagraphs(model.paragraphs);
  const classified = roles.map((role, index) => ({
    para: model.paragraphs[index],
    role: role ?? null,
  }));

  const issues: Issue[] = [
    ...checkDocument(model, rules),
    ...checkPageNumbers(model, rules),
    ...checkHeaders(model, rules),
    ...collectStructuredIssues(model, classified),
  ];
  const paragraphResult = collectParagraphIssues(model, classified, rules);
  issues.push(...paragraphResult.issues);

  return {
    ruleName: isEditableRuleLibrary(rules) ? rules.name : rules.meta?.name,
    paragraphCount: model.paragraphs.length,
    classifiedCount: paragraphResult.classifiedCount,
    issues: issues.map((issue) => ({ ...issue, ...computeFixHint(issue) })),
    summary: summarizeIssues(issues),
  };
};
