import type { Severity, ValidationReport } from "@word-auto/validator";

const SEV: Record<Severity, string> = {
  error: "错误",
  warn: "警告",
  info: "提示",
};

interface Props {
  report: ValidationReport;
  active: Set<Severity>;
  onToggle: (s: Severity) => void;
  onSelect: (paraIndex: number) => void;
}

export function ReportPanel({ report, active, onToggle, onSelect }: Props) {
  const { summary } = report;
  const issues = report.issues.filter((i) => active.has(i.severity));

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

      <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8 }}>
        共 {report.paragraphCount} 段，已识别 {report.classifiedCount} 段，
        命中 {report.issues.length} 个问题（当前显示 {issues.length} 个）
      </div>

      {issues.length === 0 ? (
        <div className="empty">没有符合筛选条件的问题 🎉</div>
      ) : (
        issues.map((it, k) => (
          <div
            className={`issue ${it.severity}`}
            key={k}
            onClick={() => onSelect(it.paraIndex)}
          >
            <div className="top">
              <span className={`badge ${it.severity}`}>{SEV[it.severity]}</span>
              <span className="role">
                第 {it.paraIndex + 1} 段 · {it.role}.{it.field}
              </span>
            </div>
            <div className="msg">{it.message}</div>
            <div className="text">「{it.textPreview}」</div>
          </div>
        ))
      )}
    </div>
  );
}
