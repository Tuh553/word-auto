import type { Issue } from "@word-auto/validator";
import {
  filterIssuesBySeverity,
  formatIssueField,
  formatIssueRole,
  formatSeverity,
  resolveSelectedIssue,
  sortReportIssues,
  type ReportSortBy,
} from "./reportGroups.js";

const DEFAULT_FILE_NAME = "当前文档";
const PROVENANCE_MAX_LENGTH = 48;

export interface CopyTextResult {
  ok: boolean;
  text: string;
  reason?: string;
}

export interface ReportCopyContext {
  fileName?: string | null;
}

interface ReportCopyAvailability {
  canCopyChecklist: boolean;
  canCopyCard: boolean;
  checklistReason?: string;
  cardReason?: string;
}

export interface ReportCopyState {
  availability: ReportCopyAvailability;
  card: CopyTextResult;
  checklist: CopyTextResult;
  resolvedIssue?: Issue;
}

const trimLine = (value: string): string => value.replace(/\s+/g, " ").trim();

const quoteText = (value: string): string => `“${trimLine(value)}”`;

const formatLocation = (issue: Issue): string =>
  issue.paraIndex < 0 ? "文档级问题" : `第 ${issue.paraIndex + 1} 段`;

const formatFileName = (fileName?: string | null): string =>
  trimLine(fileName || "") || DEFAULT_FILE_NAME;

const formatAffectedText = (issue: Issue): string | null => {
  if (issue.affectedText) return quoteText(issue.affectedText);
  const preview = trimLine(issue.textPreview);
  return preview ? quoteText(preview) : null;
};

const summarizeProvenance = (provenance: string): string => {
  const compact = trimLine(provenance);
  if (compact.length <= PROVENANCE_MAX_LENGTH) return compact;
  return `${compact.slice(0, PROVENANCE_MAX_LENGTH)}...`;
};

const appendIssueDetailLines = (lines: string[], issue: Issue): void => {
  const affectedText = formatAffectedText(issue);
  if (affectedText) lines.push(`片段：${affectedText}`);
  if (issue.suggestion) lines.push(`建议：${trimLine(issue.suggestion)}`);
  if (issue.provenance) lines.push(`依据：${summarizeProvenance(issue.provenance)}`);
};

export const buildVisibleIssues = (
  issues: Issue[],
  active: ReadonlySet<Issue["severity"]>,
  sortBy: ReportSortBy,
): Issue[] => sortReportIssues(filterIssuesBySeverity(issues, active), sortBy);

export const resolveCopyCardIssue = (
  visibleIssues: Issue[],
  selectedIssueKey: string | null,
): Issue | undefined => resolveSelectedIssue(visibleIssues, selectedIssueKey);

const getReportCopyAvailability = (
  visibleIssues: Issue[],
  selectedIssueKey: string | null,
): ReportCopyAvailability => {
  const cardIssue = resolveCopyCardIssue(visibleIssues, selectedIssueKey);
  return {
    canCopyChecklist: visibleIssues.length > 0,
    canCopyCard: !!cardIssue,
    checklistReason:
      visibleIssues.length > 0 ? undefined : "当前筛选结果没有可复制的问题",
    cardReason: cardIssue ? undefined : "当前没有可复制的问题卡片",
  };
};

export const buildReportCopyState = ({
  fileName,
  visibleIssues,
  selectedIssueKey,
}: {
  fileName?: string | null;
  visibleIssues: Issue[];
  selectedIssueKey: string | null;
}): ReportCopyState => {
  const availability = getReportCopyAvailability(visibleIssues, selectedIssueKey);
  const resolvedIssue = resolveCopyCardIssue(visibleIssues, selectedIssueKey);
  return {
    availability,
    card: formatIssueCardText(resolvedIssue, { fileName }),
    checklist: formatIssueChecklistText(visibleIssues, { fileName }),
    resolvedIssue,
  };
};

const buildIssueHeader = (issue: Issue): string =>
  `[${formatSeverity(issue.severity)}] ${formatLocation(issue)} · ${formatIssueRole(issue.role)} · ${formatIssueField(issue.field)}`;

export const formatIssueCardText = (
  issue: Issue | undefined,
  context: ReportCopyContext = {},
): CopyTextResult => {
  if (!issue) {
    return {
      ok: false,
      text: "",
      reason: "当前没有可复制的问题卡片",
    };
  }

  const lines = [
    "修订建议卡片",
    `文件：${formatFileName(context.fileName)}`,
    `级别：${formatSeverity(issue.severity)}`,
    `位置：${formatLocation(issue)}`,
    `角色：${formatIssueRole(issue.role)}`,
    `字段：${formatIssueField(issue.field)}`,
    `问题：${trimLine(issue.message)}`,
  ];

  appendIssueDetailLines(lines, issue);

  return {
    ok: true,
    text: lines.join("\n"),
  };
};

export const formatIssueChecklistText = (
  issues: Issue[],
  context: ReportCopyContext = {},
): CopyTextResult => {
  if (issues.length === 0) {
    return {
      ok: false,
      text: "",
      reason: "当前筛选结果没有可复制的问题",
    };
  }

  const lines = [`《${formatFileName(context.fileName)}》修改清单`, ""];
  issues.forEach((issue, index) => {
    lines.push(`${index + 1}. ${buildIssueHeader(issue)}`);
    lines.push(`问题：${trimLine(issue.message)}`);
    appendIssueDetailLines(lines, issue);
    if (index < issues.length - 1) lines.push("");
  });

  return {
    ok: true,
    text: lines.join("\n"),
  };
};

export const writeTextToClipboard = async (
  text: string,
  clipboard: Pick<Clipboard, "writeText"> | null | undefined = globalThis.navigator?.clipboard,
): Promise<void> => {
  if (!clipboard?.writeText) {
    throw new Error("当前环境不支持剪贴板复制");
  }
  await clipboard.writeText(text);
};
