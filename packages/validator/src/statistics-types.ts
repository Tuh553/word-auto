export interface StatisticRangeRule {
  min?: number;
  max?: number;
}

export interface KeywordStatisticsRuleSet {
  cn?: StatisticRangeRule;
  en?: StatisticRangeRule;
}

export interface AbstractStatisticsRuleSet {
  cn?: StatisticRangeRule;
  en?: StatisticRangeRule;
}

export interface ReferenceStatisticsRuleSet {
  min_count?: number;
  min_foreign_fraction?: number;
}

export interface StatisticsRuleSet {
  keywords?: KeywordStatisticsRuleSet;
  abstract?: AbstractStatisticsRuleSet;
  references?: ReferenceStatisticsRuleSet;
}

export interface LegacyKeywordRule {
  recommended_count_min?: number;
  recommended_count_max?: number;
  [k: string]: unknown;
}

export interface LegacyKeywordRules {
  cn?: LegacyKeywordRule;
  en?: LegacyKeywordRule;
  [k: string]: unknown;
}

export interface LegacyAbstractWordCount {
  min?: number;
  max?: number;
  master_min?: number;
  master_max?: number;
  doctor_min?: number;
  doctor_max?: number;
  [k: string]: unknown;
}

export interface LegacyAbstractRule {
  recommended_word_count?: LegacyAbstractWordCount;
  [k: string]: unknown;
}

export interface LegacyAbstractRules {
  cn?: LegacyAbstractRule;
  en?: LegacyAbstractRule;
  [k: string]: unknown;
}

export interface LegacyReferenceRules {
  minimum_count?: number | Record<string, number | undefined>;
  minimum_foreign_language_fraction?: number;
  [k: string]: unknown;
}
