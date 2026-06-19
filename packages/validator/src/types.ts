import type { Field, Paragraph } from "@word-auto/parser";
import type {
  LegacyAbstractRules,
  LegacyKeywordRules,
  LegacyReferenceRules,
  StatisticsRuleSet,
} from "./statistics-types.js";
export type * from "./statistics-types.js";

// 规则库类型（对应 chongqing-thesis-phase1.json）。只声明校验用得到的字段，其余宽松放行。

export interface StyleRule {
  base_style?: string;
  font_east_asia?: string;
  font_latin?: string;
  size_pt?: number;
  bold?: boolean;
  alignment?: string;
  line_spacing_pt?: number;
  spacing_before_pt?: number;
  spacing_after_pt?: number;
  first_line_indent_chars?: number;
  hanging_indent_chars?: number;
  left_indent_chars?: number;
  outline_level?: number;
}

export interface ProvenanceEntry {
  index?: number;
  text?: string;
  [k: string]: unknown;
}

export interface RuleSourceMetadata {
  template_path?: string;
  note?: string;
  extracted_by?: string;
  provenance?: Record<string, string | ProvenanceEntry | undefined>;
  [k: string]: unknown;
}

export interface RuleLibrary {
  meta?: { name?: string; version?: string };
  source?: RuleSourceMetadata;
  document?: {
    paper_size?: string;
    margin_top_cm?: number;
    margin_bottom_cm?: number;
    margin_left_cm?: number;
    margin_right_cm?: number;
    header_distance_cm?: number;
    footer_distance_cm?: number;
    gutter_cm?: number;
  };
  page_numbers?: {
    front_matter_format?: string;
    body_format?: string;
    body_restart_at?: number;
    alignment?: string;
    font_latin?: string;
    size_pt?: number;
  };
  headers?: {
    left_text?: string;
    font_east_asia?: string;
    font_latin?: string;
    size_pt?: number;
    bottom_border?: boolean;
    [k: string]: unknown;
  };
  abstract?: LegacyAbstractRules;
  keywords?: LegacyKeywordRules;
  references?: LegacyReferenceRules;
  statistics?: StatisticsRuleSet;
  styles: Record<string, StyleRule>;
  [k: string]: unknown;
}

export type LegacyStyleRule = StyleRule;
export type LegacyRuleLibrary = RuleLibrary;

export type RuleFieldKey =
  | "fontFamilyCn"
  | "fontFamilyLatin"
  | "fontSizePt"
  | "bold"
  | "align"
  | "lineHeightPt"
  | "spaceBeforePt"
  | "spaceAfterPt"
  | "firstLineIndentChars"
  | "hangingIndentChars"
  | "leftIndentChars"
  | "outlineLevel";

export type RuleFieldSeverity = "error" | "warn" | "info";
export type RuleValueMode = "exact" | "oneOf" | "range" | "unset";
export type RuleValueUnit = "pt" | "chars" | "enum" | "bool" | "level";

export interface RuleValue {
  mode: RuleValueMode;
  exact?: string | number | boolean;
  oneOf?: Array<string | number | boolean>;
  min?: number;
  max?: number;
  unit?: RuleValueUnit;
}

export interface RuleField {
  key: RuleFieldKey;
  label: string;
  enabled: boolean;
  severity: RuleFieldSeverity;
  value: RuleValue;
  note?: string;
}

export interface RuleProposalEvidenceSample {
  sampleIndex: number;
  text: string;
  value: string | number | boolean;
  role?: Role;
  roleLabel?: string;
  roleConfidence?: RoleConfidence;
  roleConfidenceReason?: string;
}

export interface RuleProposalConflict<T> {
  value: T;
  sampleCount: number;
  evidence: string[];
  evidenceSamples?: RuleProposalEvidenceSample[];
}

export interface RuleProposalFieldStats {
  confidence: number;
  confidenceLevel: "high" | "medium" | "low";
  confidenceHint: string;
  sampleCount: number;
  coverage: number;
  observedCount: number;
  totalCount: number;
  evidence: string[];
  evidenceSamples?: RuleProposalEvidenceSample[];
}

export interface RoleRuleSet {
  role: string;
  label: string;
  fields: RuleField[];
}

export interface DocumentRuleSet {
  paper_size?: string;
  margin_top_cm?: number;
  margin_bottom_cm?: number;
  margin_left_cm?: number;
  margin_right_cm?: number;
  header_distance_cm?: number;
  footer_distance_cm?: number;
  gutter_cm?: number;
}

export interface PageNumberRuleSet {
  front_matter_format?: string;
  body_format?: string;
  body_restart_at?: number;
  alignment?: string;
  font_latin?: string;
  size_pt?: number;
}

export interface HeaderRuleSet {
  left_text?: string;
  font_east_asia?: string;
  font_latin?: string;
  size_pt?: number;
  bottom_border?: boolean;
}

export type DocumentRuleKey = keyof DocumentRuleSet;
export type PageNumberRuleKey = keyof PageNumberRuleSet;
export type HeaderRuleKey = keyof HeaderRuleSet;

export interface EditableRuleLibrary {
  id: string;
  name: string;
  version: string;
  basedOn?: string;
  source?: RuleSourceMetadata;
  document?: DocumentRuleSet;
  pageNumbers?: PageNumberRuleSet;
  headers?: HeaderRuleSet;
  statistics?: StatisticsRuleSet;
  roles: RoleRuleSet[];
}

export interface RuleDraft extends EditableRuleLibrary {
  status: "draft";
  updatedAt?: string;
}

export interface RuleProposalField extends RuleProposalFieldStats {
  key: RuleFieldKey;
  proposedValue: RuleValue;
  conflicts?: Array<RuleProposalConflict<RuleValue>>;
}

export interface DocumentRuleProposalField extends RuleProposalFieldStats {
  key: DocumentRuleKey;
  label: string;
  unit: "cm" | "enum";
  proposedValue: string | number;
  conflicts?: Array<RuleProposalConflict<string | number>>;
}

export interface DocumentRuleProposal {
  key: "document";
  label: string;
  totalCount: number;
  fields: DocumentRuleProposalField[];
}

export interface RoleRuleProposal {
  role: Role;
  label: string;
  totalCount: number;
  fields: RuleProposalField[];
}

export interface RuleProposal {
  sourceName: string;
  extractedAt: string;
  paragraphCount: number;
  classifiedCount: number;
  unclassifiedCount: number;
  notices: string[];
  document?: DocumentRuleProposal;
  roles: RoleRuleProposal[];
}

export type ProposalApplyStatus = "added" | "updated" | "enabled" | "unchanged";

export interface ProposalApplyChange {
  scope: "document" | "role";
  targetKey: string;
  targetLabel: string;
  fieldKey: string;
  fieldLabel: string;
  previousValue: unknown;
  nextValue: unknown;
  status: ProposalApplyStatus;
}

export interface ProposalApplyResult {
  draft: RuleDraft;
  changes: ProposalApplyChange[];
}

// ── 规则合法性校验（lint）：对规则库「配置本身」做静态检查，不依赖真实 .docx ──
// 与 validate.ts（校验文档是否符合规则）区分：lint 校验「规则是否写得合法、自洽」。

export type RuleLintLevel = "error" | "warn" | "info";

/**
 * 一条规则合法性问题。`role` / `field` 为定位锚点，供前端做字段级/角色级提示：
 * - 都为空：库级问题（如缺少必填角色）
 * - 仅 `role`：角色级问题
 * - `role` + `field`：字段级问题
 */
export interface RuleLintItem {
  level: RuleLintLevel;
  /** 机器可读的问题码，前端可据此做特定渲染（见 lint.ts 中的常量） */
  code: string;
  role?: string;
  field?: RuleFieldKey;
  message: string;
}

export interface RuleLintResult {
  /** 无 error 即视为可发布（warn / info 不阻断发布） */
  ok: boolean;
  errors: RuleLintItem[];
  warnings: RuleLintItem[];
  infos: RuleLintItem[];
}

/** 文档段落被识别到的语义角色，对应 styles 表的 key；'document' 为文档/页面级 */
export type Role =
  | "document"
  | "heading"
  | "abstract_title_cn"
  | "abstract_body_cn"
  | "keywords_cn"
  | "abstract_title_en"
  | "abstract_body_en"
  | "keywords_en"
  | "toc_title"
  | "toc1"
  | "toc2"
  | "toc3"
  | "heading1"
  | "heading2"
  | "heading3"
  | "body_text"
  | "figure_caption"
  | "table_caption"
  | "source_note"
  | "formula_line"
  | "reference_heading"
  | "reference_body"
  | "acknowledgement_heading"
  | "acknowledgement_body"
  | "appendix_heading"
  | "appendix_subheading"
  | "appendix_list_item"
  | "appendix_signature"
  | "appendix_body"
  | "achievement_heading"
  | "achievement_body"
  | "back_matter_heading"
  | "back_matter_body"
  | "table_cell"
  | "unknown";

export type Severity = "error" | "warn" | "info";
export type RoleConfidence = "high" | "medium" | "low";

/** 带角色的已分类段落 */
export interface ClassifiedParagraph {
  para: Paragraph;
  role: Role | null;
  confidence?: RoleConfidence;
  reason?: string;
}

export interface ClassifiedParagraphDetail extends ClassifiedParagraph {
  confidence: RoleConfidence;
}

export type CaptionKind = "figure" | "table" | "equation";

export interface CaptionTarget {
  kind: CaptionKind;
  role: Role;
  paragraphIndex: number;
  fieldIndex: number;
  sequenceName: string;
  numberText: string;
  numberParts: number[];
  bookmarkNames: string[];
  field: Field;
}

export interface CaptionReference {
  type: "REF" | "PAGEREF";
  paragraphIndex: number;
  role: Role | null;
  fieldIndex: number;
  bookmark: string;
  displayText: string;
  bookmarkExists: boolean;
  targetCaption?: CaptionTarget;
  field: Field;
}

export interface CaptionReferenceGraph {
  captions: CaptionTarget[];
  references: CaptionReference[];
  bookmarks: Set<string>;
  captionsByBookmark: Map<string, CaptionTarget>;
}

/** 校验问题类型 */
export type IssueType = "paragraph" | "document";

/** 校验问题（段落级或文档级） */
export interface ValidationIssue {
  type: IssueType;
  paragraphIndex?: number;
  role: Role;
  field: string;
  expected: unknown;
  actual: unknown;
  severity: Severity;
  message: string;
  textPreview?: string;
  startRunIndex?: number;
  endRunIndex?: number;
  affectedText?: string;
  roleConfidence?: RoleConfidence;
  roleConfidenceReason?: string;
  provenance?: string;
  /** 可操作的人话修复指引 */
  suggestion?: string;
  /** 可修复性：auto=工具可机械改写；manual=需人工确认 */
  canAutoFix: boolean;
  fixHint?: string;
}

/** 旧 Issue 类型（向后兼容） */
export interface Issue {
  paraIndex: number;
  role: Role;
  field: string;
  expected: unknown;
  actual: unknown;
  severity: Severity;
  message: string;
  textPreview: string;
  startRunIndex?: number;
  endRunIndex?: number;
  affectedText?: string;
  roleConfidence?: RoleConfidence;
  roleConfidenceReason?: string;
  provenance?: string;
  /** 可操作的人话修复指引（如「请将该段落字号调整为 12pt」） */
  suggestion?: string;
  /** 可修复性：auto=工具可机械改写对应 OOXML 属性；manual=需人工确认/处理 */
  fixability?: "auto" | "manual";
}

export interface ValidationReport {
  ruleName?: string;
  paragraphCount: number;
  classifiedCount: number;
  issues: Issue[];
  summary: {
    error: number;
    warn: number;
    info: number;
    byRole: Record<string, number>;
  };
}
