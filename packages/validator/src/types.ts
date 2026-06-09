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

export interface RuleLibrary {
  meta?: { name?: string; version?: string };
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
  styles: Record<string, StyleRule>;
  [k: string]: unknown;
}

/** 文档段落被识别到的语义角色，对应 styles 表的 key；'document' 为文档/页面级 */
export type Role =
  | "document"
  | "abstract_title_cn"
  | "abstract_body_cn"
  | "keywords_cn"
  | "abstract_title_en"
  | "abstract_body_en"
  | "keywords_en"
  | "toc_title"
  | "heading1"
  | "heading2"
  | "heading3"
  | "body_text"
  | "reference_heading"
  | "reference_body";

export type Severity = "error" | "warn" | "info";

export interface Issue {
  paraIndex: number;
  role: Role;
  field: string;
  expected: unknown;
  actual: unknown;
  severity: Severity;
  message: string;
  textPreview: string;
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
