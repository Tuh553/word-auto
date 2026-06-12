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
      <div className="stats">
        {(["error", "warn", "info"] as Severity[]).map((s) => (
          <div className={`stat ${s}`} key={s}>
            <div className="n">{summary[s]}</div>
            <div className="l">{SEV[s]}</div>
          </div>
        ))}
      </div>

      <div className="filter-chips">
        {(["error", "warn", "info"] as Severity[]).map((s) => (
          <span
            key={s}
            className={`chip ${active.has(s) ? "on" : ""}`}
            onClick={() => onToggle(s)}
          >
            {SEV[s]}
          </span>
        ))}
      </div>

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

      <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8 }}>
        共 {report.paragraphCount} 段，已识别 {report.classifiedCount} 段，
        命中 {report.issues.length} 个问题（当前显示 {issues.length} 个）
      </div>

      {issues.length === 0 ? (
        <div className="empty">没有符合筛选条件的问题 🎉</div>
      ) : (
        groups.map((group) => (
          <section className="report-group" key={group.key}>
            <div className="report-group-head">
              <div className="report-group-title">{group.label}</div>
              <div className="report-group-meta">共 {group.issues.length} 项</div>
            </div>
            {group.issues.map((it, index) => (
              <div
                className={`issue ${it.severity}`}
                key={`${group.key}:${index}:${it.paraIndex}:${it.field}`}
                onClick={() => onSelect(it.paraIndex)}
              >
                <div className="top">
                  <span className={`badge ${it.severity}`}>{SEV[it.severity]}</span>
                  <span className="role">
                    {it.paraIndex < 0 ? "文档级问题" : `第 ${it.paraIndex + 1} 段`} ·{" "}
                    {formatIssueRole(it.role)} · {formatIssueField(it.field)}
                  </span>
                </div>
                <div className="msg">{it.message}</div>
                <div className="text">「{it.textPreview}」</div>
                {it.suggestion ? (
                  <div className="fix-hint">
                    <span className={`fix-tag ${it.fixability ?? "manual"}`}>
                      {it.fixability === "auto" ? "可自动修复" : "需手动处理"}
                    </span>
                    <span className="fix-text">{it.suggestion}</span>
                  </div>
                ) : null}
                {it.provenance ? (
                  <details
                    className="provenance"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <summary>规范依据</summary>
                    <div>{it.provenance}</div>
                  </details>
                ) : null}
              </div>
            ))}
          </section>
        ))
      )}
    </div>
  );
}
