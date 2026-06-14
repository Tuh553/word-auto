import type { Field, Paragraph } from "@word-auto/parser";

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
  };
  headers?: {
    left_text?: string;
    [k: string]: unknown;
  };
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
}

export interface HeaderRuleSet {
  left_text?: string;
}

export interface EditableRuleLibrary {
  id: string;
  name: string;
  version: string;
  basedOn?: string;
  source?: RuleSourceMetadata;
  document?: DocumentRuleSet;
  pageNumbers?: PageNumberRuleSet;
  headers?: HeaderRuleSet;
  roles: RoleRuleSet[];
}

export interface RuleDraft extends EditableRuleLibrary {
  status: "draft";
  updatedAt?: string;
}

export interface RuleProposalField {
  key: RuleFieldKey;
  proposedValue: RuleValue;
  confidence: number;
  confidenceLevel: "high" | "medium" | "low";
  confidenceHint: string;
  sampleCount: number;
  coverage: number;
  observedCount: number;
  totalCount: number;
  evidence: string[];
  conflicts?: Array<{
    value: RuleValue;
    sampleCount: number;
    evidence: string[];
  }>;
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
  roles: RoleRuleProposal[];
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
  | "appendix_body"
  | "achievement_heading"
  | "achievement_body"
  | "back_matter_heading"
  | "back_matter_body"
  | "table_cell"
  | "unknown";

export type Severity = "error" | "warn" | "info";

/** 带角色的已分类段落 */
export interface ClassifiedParagraph {
  para: Paragraph;
  role: Role | null;
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
