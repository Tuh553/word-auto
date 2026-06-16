import type {
  DocModel,
  HeaderFooterAlignment,
  HeaderFooterParagraph,
  HeaderFooterPart,
  HeaderFooterSegment,
} from "@word-auto/parser";
import { isEditableRuleLibrary } from "./rules.js";
import type {
  EditableRuleLibrary,
  Issue,
  RuleLibrary,
} from "./types.js";
import { getFieldProvenance } from "./validate-rules.js";

type ValidationRules = RuleLibrary | EditableRuleLibrary;

interface DocumentIssueArgs {
  rules: ValidationRules;
  field: string;
  expected: unknown;
  actual: unknown;
  severity: Issue["severity"];
  message: string;
  textPreview: string;
}

const SIZE_TOLERANCE_PT = 0.1;

const createDocumentIssue = ({
  rules,
  field,
  expected,
  actual,
  severity,
  message,
  textPreview,
}: DocumentIssueArgs): Issue => ({
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

const compactText = (text: string): string =>
  text.replace(/\s+/g, "");

const headerParts = (model: DocModel): HeaderFooterPart[] =>
  model.headerParts ?? [];

const footerParts = (model: DocModel): HeaderFooterPart[] =>
  model.footerParts ?? [];

const headerParagraphs = (model: DocModel): HeaderFooterParagraph[] =>
  headerParts(model).flatMap((part) => part.paragraphs);

const headerTextSegments = (model: DocModel): HeaderFooterSegment[] =>
  headerParagraphs(model)
    .flatMap((paragraph) => paragraph.segments)
    .filter((segment) => segment.kind === "text" && segment.text.trim());

const pageNumberSegments = (model: DocModel): HeaderFooterSegment[] =>
  [...footerParts(model), ...headerParts(model)]
    .flatMap((part) => part.paragraphs)
    .flatMap((paragraph) => paragraph.segments)
    .filter((segment) => segment.kind === "pageNumber");

const uniqueValues = (values: Array<string | number | undefined>): Array<string | number> =>
  Array.from(new Set(values.filter((value): value is string | number => value != null)));

const describeValues = (values: Array<string | number | undefined>): string => {
  const actual = uniqueValues(values);
  return actual.length > 0 ? actual.join(" / ") : "(未设置)";
};

const findMismatchedSegments = <T extends string | number>(
  segments: HeaderFooterSegment[],
  expected: T,
  pick: (segment: HeaderFooterSegment) => T | undefined,
  matches: (actual: T | undefined, target: T) => boolean,
): HeaderFooterSegment[] =>
  segments.filter((segment) => !matches(pick(segment), expected));

const sameString = (actual: string | undefined, expected: string): boolean =>
  actual === expected;

const sameSize = (actual: number | undefined, expected: number): boolean =>
  actual != null && Math.abs(actual - expected) <= SIZE_TOLERANCE_PT;

const pageNumberRules = (
  rules: ValidationRules,
) => isEditableRuleLibrary(rules) ? rules.pageNumbers : rules.page_numbers;

const checkHeaderText = (
  model: DocModel,
  rules: ValidationRules,
): Issue[] => {
  const leftText = rules.headers?.left_text;
  if (!leftText) return [];

  const target = compactText(leftText);
  const structuredHeaders = headerParts(model);
  const candidateTexts = structuredHeaders.length > 0
    ? structuredHeaders.map((part) => part.leftText)
    : model.headers;
  const found = candidateTexts.some((text) => compactText(text).includes(target));
  if (found) return [];

  const actual = structuredHeaders.length > 0
    ? structuredHeaders.map((part) => part.leftText || "(左侧无文字)").join(" / ")
    : model.headers.join(" / ");
  return [createDocumentIssue({
    rules,
    field: "header_text",
    expected: leftText,
    actual: actual || "(无页眉文字)",
    severity: "warn",
    message: `页眉应包含「${leftText}」`,
    textPreview: "页眉",
  })];
};

interface HeaderStringFieldCheck {
  model: DocModel;
  rules: ValidationRules;
  field: string;
  expected: string | undefined;
  label: string;
  pick: (segment: HeaderFooterSegment) => string | undefined;
}

const checkHeaderStringField = ({
  model,
  rules,
  field,
  expected,
  label,
  pick,
}: HeaderStringFieldCheck): Issue[] => {
  if (!expected) return [];
  const segments = headerTextSegments(model);
  const mismatches = findMismatchedSegments(segments, expected, pick, sameString);
  if (segments.length > 0 && mismatches.length === 0) return [];
  return [createDocumentIssue({
    rules,
    field,
    expected,
    actual: describeValues(segments.map(pick)),
    severity: "error",
    message: `页眉${label}应为「${expected}」`,
    textPreview: "页眉",
  })];
};

interface SegmentNumberFieldCheck {
  rules: ValidationRules;
  segments: HeaderFooterSegment[];
  field: string;
  expected: number | undefined;
  severity: Issue["severity"];
  message: (expected: number) => string;
  textPreview: string;
  pick: (segment: HeaderFooterSegment) => number | undefined;
}

const checkSegmentNumberField = ({
  rules,
  segments,
  field,
  expected,
  severity,
  message,
  textPreview,
  pick,
}: SegmentNumberFieldCheck): Issue[] => {
  if (expected == null) return [];
  const mismatches = findMismatchedSegments(segments, expected, pick, sameSize);
  if (segments.length > 0 && mismatches.length === 0) return [];
  return [createDocumentIssue({
    rules,
    field,
    expected,
    actual: describeValues(segments.map(pick)),
    severity,
    message: message(expected),
    textPreview,
  })];
};

const checkHeaderSize = (
  model: DocModel,
  rules: ValidationRules,
): Issue[] =>
  checkSegmentNumberField({
    rules,
    segments: headerTextSegments(model),
    field: "header_size_pt",
    expected: rules.headers?.size_pt,
    severity: "error",
    message: (expected) => `页眉字号应为 ${expected}pt`,
    textPreview: "页眉",
    pick: (segment) => segment.effective?.sizePt,
  });

const hasVisibleBottomBorder = (paragraph: HeaderFooterParagraph): boolean => {
  const style = paragraph.bottomBorder?.style;
  return Boolean(style && !["none", "nil"].includes(style));
};

const checkHeaderBottomBorder = (
  model: DocModel,
  rules: ValidationRules,
): Issue[] => {
  const expected = rules.headers?.bottom_border;
  if (expected == null) return [];

  const paragraphs = headerParagraphs(model);
  const withBorder = paragraphs.filter(hasVisibleBottomBorder).length;
  const matches = expected
    ? paragraphs.length > 0 && withBorder === paragraphs.length
    : withBorder === 0;
  if (matches) return [];

  return [createDocumentIssue({
    rules,
    field: "header_bottom_border",
    expected,
    actual: `${withBorder}/${paragraphs.length}`,
    severity: "warn",
    message: expected ? "页眉下方应设置边框线" : "页眉下方不应设置边框线",
    textPreview: "页眉",
  })];
};

const checkPageNumberAlignment = (
  model: DocModel,
  rules: ValidationRules,
): Issue[] => {
  const expected = pageNumberRules(rules)?.alignment as HeaderFooterAlignment | undefined;
  if (!expected) return [];
  const segments = pageNumberSegments(model);
  const mismatches = findMismatchedSegments(
    segments,
    expected,
    (segment) => segment.alignment,
    sameString,
  );
  if (segments.length > 0 && mismatches.length === 0) return [];
  return [createDocumentIssue({
    rules,
    field: "page_number_alignment",
    expected,
    actual: describeValues(segments.map((segment) => segment.alignment)),
    severity: "warn",
    message: `页码位置应为「${expected}」`,
    textPreview: "页码",
  })];
};

const checkPageNumberFont = (
  model: DocModel,
  rules: ValidationRules,
): Issue[] => {
  const expected = pageNumberRules(rules)?.font_latin;
  if (!expected) return [];
  const segments = pageNumberSegments(model);
  const pick = (segment: HeaderFooterSegment) =>
    segment.effective?.fontAscii ?? segment.effective?.fontHAnsi;
  const mismatches = findMismatchedSegments(segments, expected, pick, sameString);
  if (segments.length > 0 && mismatches.length === 0) return [];
  return [createDocumentIssue({
    rules,
    field: "page_number_font_latin",
    expected,
    actual: describeValues(segments.map(pick)),
    severity: "error",
    message: `页码西文字体应为「${expected}」`,
    textPreview: "页码",
  })];
};

const checkPageNumberSize = (
  model: DocModel,
  rules: ValidationRules,
): Issue[] =>
  checkSegmentNumberField({
    rules,
    segments: pageNumberSegments(model),
    field: "page_number_size_pt",
    expected: pageNumberRules(rules)?.size_pt,
    severity: "error",
    message: (expected) => `页码字号应为 ${expected}pt`,
    textPreview: "页码",
    pick: (segment) => segment.effective?.sizePt,
  });

export const checkHeaderFooter = (
  model: DocModel,
  rules: ValidationRules,
): Issue[] => [
  ...checkHeaderText(model, rules),
  ...checkHeaderStringField({
    model,
    rules,
    field: "header_font_east_asia",
    expected: rules.headers?.font_east_asia,
    label: "中文字体",
    pick: (segment) => segment.effective?.fontEastAsia,
  }),
  ...checkHeaderStringField({
    model,
    rules,
    field: "header_font_latin",
    expected: rules.headers?.font_latin,
    label: "西文字体",
    pick: (segment) => segment.effective?.fontAscii ?? segment.effective?.fontHAnsi,
  }),
  ...checkHeaderSize(model, rules),
  ...checkHeaderBottomBorder(model, rules),
  ...checkPageNumberAlignment(model, rules),
  ...checkPageNumberFont(model, rules),
  ...checkPageNumberSize(model, rules),
];
