import type {
  EditableRuleLibrary,
  HeaderRuleSet,
  LegacyRuleLibrary,
  PageNumberRuleSet,
  Role,
  RoleRuleSet,
  RuleField,
  RuleFieldKey,
  RuleLibrary,
  StyleRule,
} from "./types.js";

const ROLE_LABELS: Record<Exclude<Role, "document">, string> = {
  abstract_title_cn: "中文摘要标题",
  abstract_body_cn: "中文摘要正文",
  keywords_cn: "中文关键词",
  abstract_title_en: "英文摘要标题",
  abstract_body_en: "英文摘要正文",
  keywords_en: "英文关键词",
  toc_title: "目录标题",
  toc1: "一级目录项",
  toc2: "二级目录项",
  toc3: "三级目录项",
  heading1: "一级标题",
  heading2: "二级标题",
  heading3: "三级标题",
  body_text: "正文",
  reference_heading: "参考文献标题",
  reference_body: "参考文献正文",
  table_cell: "表格单元格",
};

const roleLabel = (role: string): string =>
  ROLE_LABELS[role as Exclude<Role, "document">] ?? role;

const FIELD_LABELS: Record<RuleFieldKey, string> = {
  fontFamilyCn: "中文字体",
  fontFamilyLatin: "西文字体",
  fontSizePt: "字号",
  bold: "加粗",
  align: "对齐",
  lineHeightPt: "行距",
  spaceBeforePt: "段前",
  spaceAfterPt: "段后",
  firstLineIndentChars: "首行缩进",
  hangingIndentChars: "悬挂缩进",
  leftIndentChars: "左缩进",
  outlineLevel: "大纲级别",
};

type StyleFieldSpec = {
  legacyKey: keyof StyleRule;
  key: RuleFieldKey;
  unit: "pt" | "chars" | "enum" | "bool" | "level";
};

const STYLE_FIELD_SPECS: StyleFieldSpec[] = [
  { legacyKey: "font_east_asia", key: "fontFamilyCn", unit: "enum" },
  { legacyKey: "font_latin", key: "fontFamilyLatin", unit: "enum" },
  { legacyKey: "size_pt", key: "fontSizePt", unit: "pt" },
  { legacyKey: "bold", key: "bold", unit: "bool" },
  { legacyKey: "alignment", key: "align", unit: "enum" },
  { legacyKey: "line_spacing_pt", key: "lineHeightPt", unit: "pt" },
  { legacyKey: "spacing_before_pt", key: "spaceBeforePt", unit: "pt" },
  { legacyKey: "spacing_after_pt", key: "spaceAfterPt", unit: "pt" },
  { legacyKey: "first_line_indent_chars", key: "firstLineIndentChars", unit: "chars" },
  { legacyKey: "hanging_indent_chars", key: "hangingIndentChars", unit: "chars" },
  { legacyKey: "left_indent_chars", key: "leftIndentChars", unit: "chars" },
  { legacyKey: "outline_level", key: "outlineLevel", unit: "level" },
];

const roleEntries = (styles: RuleLibrary["styles"] = {}): RoleRuleSet[] =>
  Object.entries(styles).map(([role, styleRule]) => ({
    role,
    label: roleLabel(role),
    fields: styleRuleToFields(styleRule),
  }));

const styleRuleToFields = (styleRule: StyleRule): RuleField[] =>
  STYLE_FIELD_SPECS.flatMap((spec) => {
    const raw = styleRule[spec.legacyKey];
    if (raw == null) return [];
    return [{
      key: spec.key,
      label: FIELD_LABELS[spec.key],
      enabled: true,
      severity: spec.key === "fontFamilyCn" || spec.key === "fontFamilyLatin" || spec.key === "fontSizePt"
        ? "error"
        : "warn",
      value: {
        mode: "exact",
        exact: raw as string | number | boolean,
        unit: spec.unit,
      },
    }];
  });

const fieldValueToLegacy = (fields: RuleField[], key: RuleFieldKey): string | number | boolean | undefined => {
  const field = fields.find((item) => item.key === key && item.enabled);
  if (!field) return undefined;
  if (field.value.mode !== "exact") return undefined;
  return field.value.exact;
};

const fieldsToStyleRule = (fields: RuleField[]): StyleRule => {
  const styleRule: StyleRule = {};
  const write = (legacyKey: keyof StyleRule, key: RuleFieldKey): void => {
    const value = fieldValueToLegacy(fields, key);
    if (value != null) {
      styleRule[legacyKey] = value as never;
    }
  };

  write("font_east_asia", "fontFamilyCn");
  write("font_latin", "fontFamilyLatin");
  write("size_pt", "fontSizePt");
  write("bold", "bold");
  write("alignment", "align");
  write("line_spacing_pt", "lineHeightPt");
  write("spacing_before_pt", "spaceBeforePt");
  write("spacing_after_pt", "spaceAfterPt");
  write("first_line_indent_chars", "firstLineIndentChars");
  write("hanging_indent_chars", "hangingIndentChars");
  write("left_indent_chars", "leftIndentChars");
  write("outline_level", "outlineLevel");
  return styleRule;
};

const normalizeDocument = (doc: LegacyRuleLibrary["document"]) =>
  doc ? {
    paper_size: doc.paper_size,
    margin_top_cm: doc.margin_top_cm,
    margin_bottom_cm: doc.margin_bottom_cm,
    margin_left_cm: doc.margin_left_cm,
    margin_right_cm: doc.margin_right_cm,
    header_distance_cm: doc.header_distance_cm,
    footer_distance_cm: doc.footer_distance_cm,
    gutter_cm: doc.gutter_cm,
  } : undefined;

const normalizePageNumbers = (pn: LegacyRuleLibrary["page_numbers"]): PageNumberRuleSet | undefined =>
  pn ? {
    front_matter_format: pn.front_matter_format,
    body_format: pn.body_format,
    body_restart_at: pn.body_restart_at,
  } : undefined;

const normalizeHeaders = (headers: LegacyRuleLibrary["headers"]): HeaderRuleSet | undefined =>
  headers ? { left_text: headers.left_text } : undefined;

export const isEditableRuleLibrary = (input: unknown): input is EditableRuleLibrary =>
  typeof input === "object" &&
  input !== null &&
  "roles" in input &&
  Array.isArray((input as { roles?: unknown[] }).roles);

export const normalizeRuleLibrary = (
  input: LegacyRuleLibrary | EditableRuleLibrary,
): EditableRuleLibrary => {
  if (isEditableRuleLibrary(input)) return input;
  return {
    id: input.meta?.name?.toLowerCase().replace(/\s+/g, "-") ?? "rule-library",
    name: input.meta?.name ?? "未命名规则库",
    version: input.meta?.version ?? "0.0.0",
    document: normalizeDocument(input.document),
    pageNumbers: normalizePageNumbers(input.page_numbers),
    headers: normalizeHeaders(input.headers),
    roles: roleEntries(input.styles),
  };
};

export const toLegacyRuleLibrary = (
  input: LegacyRuleLibrary | EditableRuleLibrary,
): LegacyRuleLibrary => {
  if (!isEditableRuleLibrary(input)) return input;

  const styles = Object.fromEntries(
    input.roles.map((roleRule) => [roleRule.role, fieldsToStyleRule(roleRule.fields)]),
  );

  return {
    meta: {
      name: input.name,
      version: input.version,
    },
    document: input.document,
    page_numbers: input.pageNumbers,
    headers: input.headers ? { ...input.headers } : undefined,
    styles,
  };
};
