import type { Severity, ValidationReport } from "@word-auto/validator";
import {
  buildReportGroups,
  formatIssueField,
  formatIssueRole,
  type ReportGroupBy,
  type ReportSortBy,
} from "../lib/reportGroups.js";

const SEV: Record<Severity, string> = {
  error: "错误",
  warn: "警告",
  info: "提示",
};

interface Props {
  report: ValidationReport;
  active: Set<Severity>;
  groupBy: ReportGroupBy;
  sortBy: ReportSortBy;
  onToggle: (s: Severity) => void;
  onGroupByChange: (groupBy: ReportGroupBy) => void;
  onSortByChange: (sortBy: ReportSortBy) => void;
  onSelect: (paraIndex: number) => void;
}

const GROUP_OPTIONS: Array<{ value: ReportGroupBy; label: string }> = [
  { value: "section", label: "语义章节" },
  { value: "role", label: "角色" },
  { value: "severity", label: "严重级" },
  { value: "field", label: "字段" },
];

const SORT_OPTIONS: Array<{ value: ReportSortBy; label: string }> = [
  { value: "paragraph", label: "段落顺序" },
  { value: "severity", label: "严重级优先" },
];

function ReportStats({ summary }: { summary: ValidationReport["summary"] }) {
  return (
    <div className="stats">
      {(["error", "warn", "info"] as Severity[]).map((severity) => (
        <div className={`stat ${severity}`} key={severity}>
          <div className="n">{summary[severity]}</div>
          <div className="l">{SEV[severity]}</div>
        </div>
      ))}
    </div>
  );
}

function SeverityChips({
  active,
  onToggle,
}: Pick<Props, "active" | "onToggle">) {
  return (
    <div className="filter-chips">
      {(["error", "warn", "info"] as Severity[]).map((severity) => (
        <span
          key={severity}
          className={`chip ${active.has(severity) ? "on" : ""}`}
          onClick={() => onToggle(severity)}
        >
          {SEV[severity]}
        </span>
      ))}
    </div>
  );
}

function ReportToolbar({
  groupBy,
  onGroupByChange,
  onSortByChange,
  sortBy,
}: Pick<Props, "groupBy" | "onGroupByChange" | "onSortByChange" | "sortBy">) {
  return (
    <div className="report-toolbar">
      <label className="report-toolbar-row">
        <span>分组方式</span>
        <select
          value={groupBy}
          onChange={(event) => onGroupByChange(event.target.value as ReportGroupBy)}
        >
          {GROUP_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              按{option.label}分组
            </option>
          ))}
        </select>
      </label>
      <label className="report-toolbar-row">
        <span>组内排序</span>
        <select
          value={sortBy}
          onChange={(event) => onSortByChange(event.target.value as ReportSortBy)}
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function ReportSummary({
  classifiedCount,
  issues,
  paragraphCount,
  totalIssues,
}: {
  classifiedCount: number;
  issues: number;
  paragraphCount: number;
  totalIssues: number;
}) {
  return (
    <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8 }}>
      共 {paragraphCount} 段，已识别 {classifiedCount} 段，
      命中 {totalIssues} 个问题（当前显示 {issues} 个）
    </div>
  );
}

function ReportIssueCard({
  issue,
  onSelect,
}: {
  issue: ValidationReport["issues"][number];
  onSelect: (paraIndex: number) => void;
}) {
  return (
    <div
      className={`issue ${issue.severity}`}
      onClick={() => onSelect(issue.paraIndex)}
    >
      <div className="top">
        <span className={`badge ${issue.severity}`}>{SEV[issue.severity]}</span>
        <span className="role">
          {issue.paraIndex < 0 ? "文档级问题" : `第 ${issue.paraIndex + 1} 段`} ·{" "}
          {formatIssueRole(issue.role)} · {formatIssueField(issue.field)}
        </span>
      </div>
      <div className="msg">{issue.message}</div>
      {issue.affectedText ? (
        <div className="text">
          片段 {issue.startRunIndex == null ? "" : `#${issue.startRunIndex + 1}`}：
          「{issue.affectedText}」
        </div>
      ) : (
        <div className="text">「{issue.textPreview}」</div>
      )}
      {issue.suggestion ? (
        <div className="fix-hint">
          <span className={`fix-tag ${issue.fixability ?? "manual"}`}>
            {issue.fixability === "auto" ? "可自动修复" : "需手动处理"}
          </span>
          <span className="fix-text">{issue.suggestion}</span>
        </div>
      ) : null}
      {issue.provenance ? (
        <details
          className="provenance"
          onClick={(event) => event.stopPropagation()}
        >
          <summary>规范依据</summary>
          <div>{issue.provenance}</div>
        </details>
      ) : null}
    </div>
  );
}

function ReportGroups({
  groups,
  onSelect,
}: {
  groups: ReturnType<typeof buildReportGroups>;
  onSelect: (paraIndex: number) => void;
}) {
  return (
    <>
      {groups.map((group) => (
        <section className="report-group" key={group.key}>
          <div className="report-group-head">
            <div className="report-group-title">{group.label}</div>
            <div className="report-group-meta">共 {group.issues.length} 项</div>
          </div>
          {group.issues.map((issue, index) => (
            <ReportIssueCard
              key={`${group.key}:${index}:${issue.paraIndex}:${issue.field}`}
              issue={issue}
              onSelect={onSelect}
            />
          ))}
        </section>
      ))}
    </>
  );
}

export function ReportPanel({
  report,
  active,
  groupBy,
  sortBy,
  onToggle,
  onGroupByChange,
  onSortByChange,
  onSelect,
}: Props) {
  const { summary } = report;
  const issues = report.issues.filter((i) => active.has(i.severity));
  const groups = buildReportGroups(issues, groupBy, sortBy);

  return (
    <div className="report-wrap">
      <ReportStats summary={summary} />
      <SeverityChips active={active} onToggle={onToggle} />
      <ReportToolbar
        groupBy={groupBy}
        onGroupByChange={onGroupByChange}
        onSortByChange={onSortByChange}
        sortBy={sortBy}
      />
      <ReportSummary
        classifiedCount={report.classifiedCount}
        issues={issues.length}
        paragraphCount={report.paragraphCount}
        totalIssues={report.issues.length}
      />

      {issues.length === 0 ? (
        <div className="empty">没有符合筛选条件的问题 🎉</div>
      ) : (
        <ReportGroups groups={groups} onSelect={onSelect} />
      )}
    </div>
  );
}
