import type { Issue, Role, Severity } from "@word-auto/validator";
import type { PreviewHighlightTarget } from "./previewHighlight.js";

export type ReportGroupBy = "section" | "role" | "severity" | "field";
export type ReportSortBy = "paragraph" | "severity";

export interface ReportIssueGroup {
  key: string;
  label: string;
  issues: Issue[];
}

export interface PreviewIssueTarget {
  issueKey: string;
  paraIndex: number;
  text: string;
  issues: PreviewParagraphIssue[];
}

export interface PreviewParagraphIssue {
  issueKey: string;
  affectedText: string | null;
  severity: Severity;
}

const SEVERITY_LABELS: Record<Severity, string> = {
  error: "错误",
  warn: "警告",
  info: "提示",
};

const SEVERITY_ORDER: Record<Severity, number> = {
  error: 0,
  warn: 1,
  info: 2,
};

const ROLE_LABELS: Record<Role, string> = {
  document: "文档设置",
  heading: "标题（通用）",
  unknown: "未识别",
  abstract_title_cn: "中文摘要标题",
  abstract_body_cn: "中文摘要正文",
  keywords_cn: "中文关键词",
  abstract_title_en: "英文摘要标题",
  abstract_body_en: "英文摘要正文",
  keywords_en: "英文关键词",
  toc_title: "目录标题",
  toc1: "目录一级条目",
  toc2: "目录二级条目",
  toc3: "目录三级条目",
  heading1: "一级标题",
  heading2: "二级标题",
  heading3: "三级标题",
  body_text: "正文",
  figure_caption: "图题注",
  table_caption: "表题注",
  source_note: "资料来源",
  formula_line: "公式编号行",
  reference_heading: "参考文献标题",
  reference_body: "参考文献正文",
  acknowledgement_heading: "致谢标题",
  acknowledgement_body: "致谢正文",
  appendix_heading: "附录标题",
  appendix_subheading: "附录小标题",
  appendix_list_item: "附录清单",
  appendix_signature: "附录落款",
  appendix_body: "附录正文",
  achievement_heading: "成果标题",
  achievement_body: "成果正文",
  back_matter_heading: "后置章节标题",
  back_matter_body: "后置章节正文",
  table_cell: "表格段落",
};

const FIELD_LABELS: Record<string, string> = {
  font_east_asia: "中文字体",
  font_latin: "西文字体",
  size_pt: "字号",
  bold: "加粗",
  alignment: "对齐",
  line_spacing_pt: "行距",
  spacing_before_pt: "段前距",
  spacing_after_pt: "段后距",
  first_line_indent_chars: "首行缩进",
  hanging_indent_chars: "悬挂缩进",
  left_indent_chars: "左缩进",
  outline_level: "大纲级别",
  paper_size: "纸张",
  margin_top_cm: "上边距",
  margin_bottom_cm: "下边距",
  margin_left_cm: "左边距",
  margin_right_cm: "右边距",
  header_distance_cm: "页眉距",
  footer_distance_cm: "页脚距",
  gutter_cm: "装订线",
  page_number_front: "前置部分页码",
  page_number_body: "正文页码",
  page_number_alignment: "页码位置",
  page_number_font_latin: "页码西文字体",
  page_number_size_pt: "页码字号",
  header_text: "页眉内容",
  header_font_east_asia: "页眉中文字体",
  header_font_latin: "页眉西文字体",
  header_size_pt: "页眉字号",
  header_bottom_border: "页眉线",
  caption_reference: "交叉引用",
  keywords_cn_count: "中文关键词数量",
  keywords_en_count: "英文关键词数量",
  abstract_cn_chars: "中文摘要字数",
  abstract_en_words: "英文摘要词数",
  references_count: "参考文献条数",
  references_foreign_fraction: "外文参考文献占比",
};

const SECTION_LABELS = {
  cn_abstract: "中文摘要",
  en_abstract: "英文摘要",
  toc: "目录",
  body: "正文",
  references: "参考文献",
  acknowledgement: "致谢",
  appendix: "附录",
  achievement: "成果",
  back_matter: "后置部分",
  document: "文档级",
} as const;

type SectionKey = keyof typeof SECTION_LABELS;

const SECTION_ORDER: Record<SectionKey, number> = {
  cn_abstract: 0,
  en_abstract: 1,
  toc: 2,
  body: 3,
  references: 4,
  acknowledgement: 5,
  appendix: 6,
  achievement: 7,
  back_matter: 8,
  document: 9,
};

const ROLE_ORDER: Record<Role, number> = {
  unknown: 0,
  heading: 1,
  abstract_title_cn: 2,
  abstract_body_cn: 3,
  keywords_cn: 4,
  abstract_title_en: 5,
  abstract_body_en: 6,
  keywords_en: 7,
  toc_title: 8,
  toc1: 9,
  toc2: 10,
  toc3: 11,
  heading1: 12,
  heading2: 13,
  heading3: 14,
  body_text: 15,
  figure_caption: 16,
  table_caption: 17,
  source_note: 18,
  formula_line: 19,
  table_cell: 20,
  reference_heading: 21,
  reference_body: 22,
  acknowledgement_heading: 23,
  acknowledgement_body: 24,
  appendix_heading: 25,
  appendix_subheading: 26,
  appendix_list_item: 27,
  appendix_signature: 28,
  appendix_body: 29,
  achievement_heading: 30,
  achievement_body: 31,
  back_matter_heading: 32,
  back_matter_body: 33,
  document: 34,
};

const ROLE_SECTION_MAP: Partial<Record<Role, SectionKey>> = {
  abstract_title_cn: "cn_abstract",
  abstract_body_cn: "cn_abstract",
  keywords_cn: "cn_abstract",
  abstract_title_en: "en_abstract",
  abstract_body_en: "en_abstract",
  keywords_en: "en_abstract",
  toc_title: "toc",
  toc1: "toc",
  toc2: "toc",
  toc3: "toc",
  reference_heading: "references",
  reference_body: "references",
  acknowledgement_heading: "acknowledgement",
  acknowledgement_body: "acknowledgement",
  appendix_heading: "appendix",
  appendix_subheading: "appendix",
  appendix_list_item: "appendix",
  appendix_signature: "appendix",
  appendix_body: "appendix",
  achievement_heading: "achievement",
  achievement_body: "achievement",
  back_matter_heading: "back_matter",
  back_matter_body: "back_matter",
  document: "document",
};

const roleToSection = (role: Role): SectionKey =>
  ROLE_SECTION_MAP[role] ?? "body";

const paraOrder = (issue: Issue): number =>
  issue.paraIndex >= 0 ? issue.paraIndex : Number.MAX_SAFE_INTEGER;

const compareByParagraph = (left: Issue, right: Issue): number =>
  paraOrder(left) - paraOrder(right) ||
  SEVERITY_ORDER[left.severity] - SEVERITY_ORDER[right.severity] ||
  left.role.localeCompare(right.role) ||
  left.field.localeCompare(right.field);

const compareBySeverity = (left: Issue, right: Issue): number =>
  SEVERITY_ORDER[left.severity] - SEVERITY_ORDER[right.severity] ||
  paraOrder(left) - paraOrder(right) ||
  left.role.localeCompare(right.role) ||
  left.field.localeCompare(right.field);

export const sortReportIssues = (issues: Issue[], sortBy: ReportSortBy): Issue[] =>
  [...issues].sort(sortBy === "severity" ? compareBySeverity : compareByParagraph);

const compareGroups = (
  left: ReportIssueGroup,
  right: ReportIssueGroup,
  groupBy: ReportGroupBy,
): number => {
  if (groupBy === "severity") {
    return SEVERITY_ORDER[left.key as Severity] - SEVERITY_ORDER[right.key as Severity];
  }
  if (groupBy === "section") {
    return SECTION_ORDER[left.key as SectionKey] - SECTION_ORDER[right.key as SectionKey];
  }
  if (groupBy === "role") {
    return ROLE_ORDER[left.key as Role] - ROLE_ORDER[right.key as Role];
  }
  if (groupBy === "field") {
    return left.label.localeCompare(right.label, "zh-Hans-CN");
  }
  return 0;
};

const getGroupMeta = (
  issue: Issue,
  groupBy: ReportGroupBy,
): Pick<ReportIssueGroup, "key" | "label"> => {
  switch (groupBy) {
    case "severity":
      return {
        key: issue.severity,
        label: SEVERITY_LABELS[issue.severity],
      };
    case "role":
      return {
        key: issue.role,
        label: ROLE_LABELS[issue.role] ?? issue.role,
      };
    case "field":
      return {
        key: issue.field,
        label: FIELD_LABELS[issue.field] ?? issue.field,
      };
    case "section": {
      const key = roleToSection(issue.role);
      return {
        key,
        label: SECTION_LABELS[key],
      };
    }
  }
};

export const formatIssueRole = (role: Role): string =>
  ROLE_LABELS[role] ?? role;

export const formatIssueField = (field: string): string =>
  FIELD_LABELS[field] ?? field;

export const formatSeverity = (severity: Severity): string =>
  SEVERITY_LABELS[severity];

export const filterIssuesBySeverity = (
  issues: Issue[],
  active: ReadonlySet<Severity>,
): Issue[] => issues.filter((issue) => active.has(issue.severity));

export const buildReportGroups = (
  issues: Issue[],
  groupBy: ReportGroupBy,
  sortBy: ReportSortBy,
): ReportIssueGroup[] => {
  const groups = new Map<string, ReportIssueGroup>();

  for (const issue of sortReportIssues(issues, sortBy)) {
    const meta = getGroupMeta(issue, groupBy);
    const group = groups.get(meta.key);
    if (group) {
      group.issues.push(issue);
      continue;
    }
    groups.set(meta.key, {
      key: meta.key,
      label: meta.label,
      issues: [issue],
    });
  }

  return [...groups.values()].sort((left, right) => compareGroups(left, right, groupBy));
};

export const findFirstNavigableIssue = (issues: Issue[]): Issue | undefined =>
  sortReportIssues(issues, "paragraph").find((issue) => issue.paraIndex >= 0);

export const getIssueKey = (issue: Issue): string =>
  [
    issue.paraIndex,
    issue.severity,
    issue.role,
    issue.field,
    issue.message,
    JSON.stringify(issue.expected),
    JSON.stringify(issue.actual),
    issue.affectedText ?? issue.textPreview,
  ]
    .map((part) => encodeURIComponent(String(part ?? "")))
    .join("|");

export const findIssueByKey = (
  issues: Issue[],
  issueKey: string | null,
): Issue | undefined =>
  issueKey ? issues.find((issue) => getIssueKey(issue) === issueKey) : undefined;

export const findVisibleIssueForParagraph = (
  issues: Issue[],
  paraIndex: number,
): Issue | undefined =>
  sortReportIssues(issues, "paragraph").find((issue) => issue.paraIndex === paraIndex);

export const findVisibleIssuesForParagraph = (
  issues: Issue[],
  paraIndex: number,
): Issue[] =>
  sortReportIssues(issues, "paragraph").filter((issue) => issue.paraIndex === paraIndex);

export const resolveSelectedIssue = (
  issues: Issue[],
  selectedIssueKey: string | null,
): Issue | undefined =>
  findIssueByKey(issues, selectedIssueKey) ?? findFirstNavigableIssue(issues);

export const buildPreviewIssueTargets = (
  issues: Issue[],
  paragraphs: Array<{ text: string }>,
): PreviewIssueTarget[] => {
  const targets = new Map<number, PreviewIssueTarget>();
  for (const issue of sortReportIssues(issues, "paragraph")) {
    if (issue.paraIndex < 0) continue;
    const text = paragraphs[issue.paraIndex]?.text;
    if (!text) continue;
    const target = targets.get(issue.paraIndex);
    const previewIssue = {
      affectedText: issue.affectedText ?? null,
      issueKey: getIssueKey(issue),
      severity: issue.severity,
    };
    if (target) {
      target.issues.push(previewIssue);
      continue;
    }
    targets.set(issue.paraIndex, {
      issueKey: getIssueKey(issue),
      issues: [previewIssue],
      paraIndex: issue.paraIndex,
      text,
    });
  }
  return [...targets.values()];
};

export const buildPreviewHighlightTarget = (
  issue: Issue | undefined,
  paragraphs: Array<{ text: string }>,
  visibleIssues: Issue[],
): PreviewHighlightTarget | null => {
  if (!issue || issue.paraIndex < 0) return null;
  const text = paragraphs[issue.paraIndex]?.text;
  if (!text) return null;
  return {
    affectedText: issue.affectedText ?? null,
    issueKey: getIssueKey(issue),
    paragraphIssues: findVisibleIssuesForParagraph(visibleIssues, issue.paraIndex).map(
      (visibleIssue) => ({
        affectedText: visibleIssue.affectedText ?? null,
        issueKey: getIssueKey(visibleIssue),
        severity: visibleIssue.severity,
      }),
    ),
    paraIndex: issue.paraIndex,
    text,
  };
};
