import type {
  LegacyAbstractRule,
  LegacyAbstractWordCount,
  LegacyKeywordRule,
  LegacyReferenceRules,
  LegacyRuleLibrary,
  StatisticRangeRule,
  StatisticsRuleSet,
} from "./types.js";

const finiteNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const normalizeRange = (
  min: unknown,
  max: unknown,
): StatisticRangeRule | undefined => {
  const range = {
    min: finiteNumber(min),
    max: finiteNumber(max),
  };
  return range.min == null && range.max == null ? undefined : range;
};

const normalizeKeywordRange = (
  rule: LegacyKeywordRule | undefined,
): StatisticRangeRule | undefined =>
  normalizeRange(rule?.recommended_count_min, rule?.recommended_count_max);

const normalizeAbstractRange = (
  rule: LegacyAbstractWordCount | undefined,
): StatisticRangeRule | undefined =>
  // MVP 暂无学位类型选择器；内置专业学位模板优先采用 master 统计阈值。
  normalizeRange(
    rule?.min ?? rule?.master_min ?? rule?.doctor_min,
    rule?.max ?? rule?.master_max ?? rule?.doctor_max,
  );

const firstFiniteValue = (
  values: Record<string, number | undefined>,
): number | undefined => {
  for (const value of Object.values(values)) {
    const normalized = finiteNumber(value);
    if (normalized != null) return normalized;
  }
  return undefined;
};

const normalizeReferenceMinCount = (
  value: LegacyReferenceRules["minimum_count"],
): number | undefined => {
  const direct = finiteNumber(value);
  if (direct != null || typeof value !== "object" || value === null) return direct;
  // MVP 暂无学位类型选择器；内置专业学位模板优先采用 master 统计阈值。
  return finiteNumber(value.master) ?? finiteNumber(value.doctor) ?? firstFiniteValue(value);
};

const withRange = (
  range: StatisticRangeRule | undefined,
): StatisticRangeRule | undefined =>
  range ? { ...range } : undefined;

const keywordRules = (
  cn: StatisticRangeRule | undefined,
  en: StatisticRangeRule | undefined,
): StatisticsRuleSet["keywords"] =>
  cn || en ? { ...(cn ? { cn: withRange(cn) } : {}), ...(en ? { en: withRange(en) } : {}) } : undefined;

const abstractRules = (
  cn: StatisticRangeRule | undefined,
  en: StatisticRangeRule | undefined,
): StatisticsRuleSet["abstract"] =>
  cn || en ? { ...(cn ? { cn: withRange(cn) } : {}), ...(en ? { en: withRange(en) } : {}) } : undefined;

const referenceRules = (
  minCount: number | undefined,
  minFraction: number | undefined,
): StatisticsRuleSet["references"] =>
  minCount != null || minFraction != null
    ? {
      ...(minCount != null ? { min_count: minCount } : {}),
      ...(minFraction != null ? { min_foreign_fraction: minFraction } : {}),
    }
    : undefined;

export const normalizeStatisticsRules = (
  input: LegacyRuleLibrary,
): StatisticsRuleSet | undefined => {
  const keywordsCn = normalizeKeywordRange(input.keywords?.cn);
  const keywordsEn = normalizeKeywordRange(input.keywords?.en);
  const abstractCn = normalizeAbstractRange(input.abstract?.cn?.recommended_word_count);
  const abstractEn = normalizeAbstractRange(input.abstract?.en?.recommended_word_count);
  const referenceMinCount = normalizeReferenceMinCount(input.references?.minimum_count);
  const referenceMinFraction = finiteNumber(input.references?.minimum_foreign_language_fraction);
  const keywords = keywordRules(keywordsCn, keywordsEn);
  const abstract = abstractRules(abstractCn, abstractEn);
  const references = referenceRules(referenceMinCount, referenceMinFraction);
  const statistics: StatisticsRuleSet = {
    ...(keywords ? { keywords } : {}),
    ...(abstract ? { abstract } : {}),
    ...(references ? { references } : {}),
  };

  return Object.keys(statistics).length > 0 ? statistics : undefined;
};

const legacyAbstractRule = (
  range: StatisticRangeRule | undefined,
): LegacyAbstractRule | undefined =>
  range ? { recommended_word_count: { min: range.min, max: range.max } } : undefined;

const legacyKeywordRule = (
  range: StatisticRangeRule | undefined,
): LegacyKeywordRule | undefined =>
  range ? {
    recommended_count_min: range.min,
    recommended_count_max: range.max,
  } : undefined;

export const statisticsToLegacy = (
  statistics: StatisticsRuleSet | undefined,
): Pick<LegacyRuleLibrary, "abstract" | "keywords" | "references"> => ({
  abstract: statistics?.abstract ? {
    cn: legacyAbstractRule(statistics.abstract.cn),
    en: legacyAbstractRule(statistics.abstract.en),
  } : undefined,
  keywords: statistics?.keywords ? {
    cn: legacyKeywordRule(statistics.keywords.cn),
    en: legacyKeywordRule(statistics.keywords.en),
  } : undefined,
  references: statistics?.references ? {
    minimum_count: statistics.references.min_count,
    minimum_foreign_language_fraction: statistics.references.min_foreign_fraction,
  } : undefined,
});
