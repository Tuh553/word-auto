import type {
  ClassifiedParagraph,
  EditableRuleLibrary,
  Issue,
  Role,
  RuleLibrary,
  StatisticRangeRule,
  StatisticsRuleSet,
} from "./types.js";
import { isEditableRuleLibrary } from "./rules.js";
import { normalizeStatisticsRules } from "./statistics-rules.js";
import { getFieldProvenance } from "./validate-rules.js";

type ValidationRules = RuleLibrary | EditableRuleLibrary;
type KeywordLanguage = "cn" | "en";
type AbstractLanguage = "cn" | "en";

interface RangeIssueArgs {
  out: Issue[];
  rules: ValidationRules;
  field: string;
  label: string;
  range: StatisticRangeRule;
  actual: number;
  unit: string;
  severity: Issue["severity"];
}

const CJK_CHAR = /[\u3400-\u9fff]/g;
const ENGLISH_WORD = /[A-Za-z]+(?:[-'][A-Za-z]+)*/g;
const KEYWORD_SPLITTER = /[；;、，,]+/;

const KEYWORD_META: Record<KeywordLanguage, { role: Role; field: string; label: string; prefix: RegExp }> = {
  cn: {
    role: "keywords_cn",
    field: "keywords_cn_count",
    label: "中文关键词数量",
    prefix: /^关键词\s*[:：]?\s*/,
  },
  en: {
    role: "keywords_en",
    field: "keywords_en_count",
    label: "英文关键词数量",
    prefix: /^key\s*words?\s*[:：]?\s*/i,
  },
};

const ABSTRACT_META: Record<AbstractLanguage, { role: Role; field: string; label: string; unit: string }> = {
  cn: {
    role: "abstract_body_cn",
    field: "abstract_cn_chars",
    label: "中文摘要字数",
    unit: "字",
  },
  en: {
    role: "abstract_body_en",
    field: "abstract_en_words",
    label: "英文摘要词数",
    unit: "词",
  },
};

const getStatisticsRules = (
  rules: ValidationRules,
): StatisticsRuleSet | undefined =>
  isEditableRuleLibrary(rules)
    ? rules.statistics
    : rules.statistics ?? normalizeStatisticsRules(rules);

const textForRole = (
  classified: ClassifiedParagraph[],
  role: Role,
): string[] =>
  classified.flatMap((item) => item.role === role ? [item.para.text] : []);

const countMatches = (text: string, pattern: RegExp): number =>
  text.match(pattern)?.length ?? 0;

const countCjkChars = (text: string): number =>
  countMatches(text, CJK_CHAR);

const countEnglishWords = (text: string): number =>
  countMatches(text, ENGLISH_WORD);

const rangeContains = (range: StatisticRangeRule, actual: number): boolean =>
  (range.min == null || actual >= range.min) &&
  (range.max == null || actual <= range.max);

const formatRange = (range: StatisticRangeRule, unit: string): string => {
  if (range.min != null && range.max != null) return `${range.min}-${range.max} ${unit}`;
  if (range.min != null) return `不少于 ${range.min} ${unit}`;
  if (range.max != null) return `不超过 ${range.max} ${unit}`;
  return `规范${unit}数`;
};

const formatRangeMessage = (
  label: string,
  range: StatisticRangeRule,
  actual: number,
  unit: string,
): string => {
  const expected = formatRange(range, unit);
  const connector = expected.startsWith("不") ? "" : "为 ";
  return `${label}应${connector}${expected}，实际 ${actual} ${unit}`;
};

const pushRangeIssue = ({
  out,
  rules,
  field,
  label,
  range,
  actual,
  unit,
  severity,
}: RangeIssueArgs): void => {
  if (rangeContains(range, actual)) return;
  out.push({
    paraIndex: -1,
    role: "document",
    field,
    expected: formatRange(range, unit),
    actual,
    severity,
    message: formatRangeMessage(label, range, actual, unit),
    textPreview: label,
    provenance: getFieldProvenance(rules, field),
  });
};

const countKeywordItems = (
  text: string,
  prefix: RegExp,
): number => {
  const body = text.replace(prefix, "").replace(/[。.;；\s]+$/u, "").trim();
  if (!body) return 0;
  return body.split(KEYWORD_SPLITTER).filter((item) => item.trim()).length;
};

const checkKeywordCount = (
  out: Issue[],
  rules: ValidationRules,
  classified: ClassifiedParagraph[],
  statistics: StatisticsRuleSet,
  language: KeywordLanguage,
): void => {
  const range = statistics.keywords?.[language];
  if (!range) return;
  const meta = KEYWORD_META[language];
  const actual = textForRole(classified, meta.role)
    .reduce((sum, text) => sum + countKeywordItems(text, meta.prefix), 0);
  pushRangeIssue({
    out,
    rules,
    field: meta.field,
    label: meta.label,
    range,
    actual,
    unit: "个",
    severity: "warn",
  });
};

const checkAbstractLength = (
  out: Issue[],
  rules: ValidationRules,
  classified: ClassifiedParagraph[],
  statistics: StatisticsRuleSet,
  language: AbstractLanguage,
): void => {
  const range = statistics.abstract?.[language];
  if (!range) return;
  const meta = ABSTRACT_META[language];
  const text = textForRole(classified, meta.role).join(" ");
  const actual = language === "cn" ? countCjkChars(text) : countEnglishWords(text);
  pushRangeIssue({
    out,
    rules,
    field: meta.field,
    label: meta.label,
    range,
    actual,
    unit: meta.unit,
    severity: "warn",
  });
};

const percent = (fraction: number): string =>
  `${Number((fraction * 100).toFixed(2))}%`;

const isForeignReference = (text: string): boolean =>
  countCjkChars(text) === 0 && countEnglishWords(text) >= 3;

const checkReferenceCount = (
  out: Issue[],
  rules: ValidationRules,
  referenceTexts: string[],
  statistics: StatisticsRuleSet,
): void => {
  const minCount = statistics.references?.min_count;
  if (minCount == null || referenceTexts.length >= minCount) return;
  out.push({
    paraIndex: -1,
    role: "document",
    field: "references_count",
    expected: `不少于 ${minCount} 条`,
    actual: referenceTexts.length,
    severity: "error",
    message: `参考文献应不少于 ${minCount} 条，实际 ${referenceTexts.length} 条`,
    textPreview: "参考文献",
    provenance: getFieldProvenance(rules, "references_count"),
  });
};

const checkForeignReferenceFraction = (
  out: Issue[],
  rules: ValidationRules,
  referenceTexts: string[],
  statistics: StatisticsRuleSet,
): void => {
  const minFraction = statistics.references?.min_foreign_fraction;
  if (minFraction == null || referenceTexts.length === 0) return;
  const foreignCount = referenceTexts.filter(isForeignReference).length;
  const actual = foreignCount / referenceTexts.length;
  if (actual >= minFraction) return;
  out.push({
    paraIndex: -1,
    role: "document",
    field: "references_foreign_fraction",
    expected: `不低于 ${percent(minFraction)}`,
    actual: percent(actual),
    severity: "warn",
    message: `外文参考文献占比应不低于 ${percent(minFraction)}，实际 ${percent(actual)}（${foreignCount}/${referenceTexts.length}）`,
    textPreview: "参考文献",
    provenance: getFieldProvenance(rules, "references_foreign_fraction"),
  });
};

export const checkDocumentStatistics = (
  classified: ClassifiedParagraph[],
  rules: ValidationRules,
): Issue[] => {
  const statistics = getStatisticsRules(rules);
  if (!statistics) return [];

  const out: Issue[] = [];
  checkKeywordCount(out, rules, classified, statistics, "cn");
  checkKeywordCount(out, rules, classified, statistics, "en");
  checkAbstractLength(out, rules, classified, statistics, "cn");
  checkAbstractLength(out, rules, classified, statistics, "en");

  const referenceTexts = textForRole(classified, "reference_body");
  checkReferenceCount(out, rules, referenceTexts, statistics);
  checkForeignReferenceFraction(out, rules, referenceTexts, statistics);
  return out;
};
