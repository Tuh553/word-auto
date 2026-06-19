import type {
  EditableRuleLibrary,
  ProvenanceEntry,
  Role,
  RuleLibrary,
  StyleRule,
} from "./types.js";

type RulesWithProvenance = RuleLibrary | EditableRuleLibrary;

const ROLE_RULE_FALLBACKS: Partial<Record<Role, Role[]>> = {
  acknowledgement_heading: ["back_matter_heading"],
  acknowledgement_body: ["back_matter_body"],
  appendix_heading: ["back_matter_heading"],
  appendix_subheading: ["appendix_body", "back_matter_body"],
  appendix_list_item: ["appendix_body", "back_matter_body"],
  appendix_signature: ["appendix_body", "back_matter_body"],
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
  page_number_alignment: ["page_setup_comment"],
  page_number_font_latin: ["page_setup_comment"],
  page_number_size_pt: ["page_setup_comment"],
  header_text: ["page_setup_comment"],
  header_font_east_asia: ["page_setup_comment"],
  header_font_latin: ["page_setup_comment"],
  header_size_pt: ["page_setup_comment"],
  header_bottom_border: ["page_setup_comment"],
  keywords_cn_count: ["cn_keywords"],
  keywords_en_count: ["en_keywords"],
  abstract_cn_chars: ["cn_abstract_body"],
  abstract_en_words: ["en_abstract_body"],
  references_count: ["references"],
  references_foreign_fraction: ["references"],
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
  rules: RulesWithProvenance,
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

export const findRuleForRole = (
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

export const findEditableRoleRule = (
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

export const getRoleProvenance = (
  rules: RulesWithProvenance,
  role: Role,
): string | undefined =>
  findProvenanceText(rules, ROLE_PROVENANCE_KEYS[role] ?? []);

export const getFieldProvenance = (
  rules: RulesWithProvenance,
  field: string,
): string | undefined =>
  findProvenanceText(rules, FIELD_PROVENANCE_KEYS[field] ?? []);
