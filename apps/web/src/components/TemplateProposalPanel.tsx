import type {
  RoleRuleProposal,
  RuleDraft,
  RuleField,
  RuleFieldKey,
  RuleProposal,
  RuleProposalField,
  RuleValue,
} from "@word-auto/validator";

const LEVEL_LABEL = {
  high: "高",
  medium: "中",
  low: "低",
} as const;

const unitText = (unit?: RuleValue["unit"]): string =>
  unit === "pt" ? " pt" : unit === "chars" ? " 字符" : unit === "level" ? " 级" : "";

const formatScalar = (value: string | number | boolean): string => {
  if (typeof value === "boolean") return value ? "是" : "否";
  return String(value);
};

const formatRuleValue = (value: RuleValue): string => {
  switch (value.mode) {
    case "exact":
      return `${formatScalar(value.exact as string | number | boolean)}${unitText(value.unit)}`;
    case "oneOf":
      return (value.oneOf ?? []).map((item) => formatScalar(item)).join(" / ") || "（空）";
    case "range":
      return `${value.min ?? "?"} ~ ${value.max ?? "?"}${unitText(value.unit)}`;
    case "unset":
      return "不校验";
  }
};

const findDraftField = (
  draft: RuleDraft,
  roleKey: string,
  fieldKey: RuleFieldKey,
): RuleField | undefined =>
  draft.roles.find((item) => item.role === roleKey)?.fields.find((item) => item.key === fieldKey);

const formatCoverage = (field: RuleProposalField): string =>
  `${field.sampleCount}/${field.totalCount}（覆盖率 ${(field.coverage * 100).toFixed(0)}%）`;

const formatTime = (value: string): string =>
  new Date(value).toLocaleString("zh-CN", { hour12: false });

interface Props {
  draft: RuleDraft;
  proposal: RuleProposal | null;
  onExtract: () => void;
  onAcceptField: (role: RoleRuleProposal, field: RuleProposalField) => void;
  onAcceptRole: (role: RoleRuleProposal) => void;
}

export function TemplateProposalPanel({
  draft,
  proposal,
  onExtract,
  onAcceptField,
  onAcceptRole,
}: Props) {
  if (!proposal) {
    return (
      <section className="card proposal-card">
        <div className="proposal-head">
          <div>
            <h2>模板候选提取</h2>
            <p>上传标准模板或样本文档 `.docx`，按现有 parser + classify 聚合角色字段候选。</p>
          </div>
          <button className="primary" onClick={onExtract}>上传并提取候选</button>
        </div>
        <div className="proposal-empty">
          当前还没有候选结果。提取后会展示字段建议值、覆盖率、冲突项和可信提示，并可接受到草稿。
        </div>
      </section>
    );
  }

  return (
    <section className="card proposal-card">
      <div className="proposal-head">
        <div>
          <h2>模板候选提取</h2>
          <div className="proposal-meta">
            来源：{proposal.sourceName} · 解析段落 {proposal.paragraphCount} · 已识别 {proposal.classifiedCount} · 提取时间 {formatTime(proposal.extractedAt)}
          </div>
        </div>
        <button className="primary" onClick={onExtract}>重新提取</button>
      </div>

      {proposal.notices.length > 0 && (
        <div className="proposal-notices">
          {proposal.notices.map((notice, index) => (
            <div className="proposal-notice" key={index}>{notice}</div>
          ))}
        </div>
      )}

      <div className="proposal-roles">
        {proposal.roles.map((role) => (
          <article className="proposal-role" key={role.role}>
            <div className="proposal-role-head">
              <div>
                <div className="proposal-role-name">{role.label}</div>
                <div className="proposal-role-meta">{role.role} · {role.totalCount} 段样本 · {role.fields.length} 个字段候选</div>
              </div>
              <button onClick={() => onAcceptRole(role)}>整角色接受到草稿</button>
            </div>

            <div className="proposal-fields">
              {role.fields.map((field) => {
                const current = findDraftField(draft, role.role, field.key);
                return (
                  <div className="proposal-field" key={field.key}>
                    <div className="proposal-field-main">
                      <div>
                        <div className="proposal-field-name">{current?.label ?? field.key}</div>
                        <div className="proposal-field-value">
                          候选：{formatRuleValue(field.proposedValue)}
                        </div>
                        <div className="proposal-field-current">
                          当前草稿：{current ? formatRuleValue(current.value) : "（未配置）"}
                        </div>
                      </div>
                      <button onClick={() => onAcceptField(role, field)}>接受</button>
                    </div>

                    <div className="proposal-field-stats">
                      <span className={`proposal-badge ${field.confidenceLevel}`}>
                        可信度 {LEVEL_LABEL[field.confidenceLevel]} · {field.confidence.toFixed(2)}
                      </span>
                      <span>{formatCoverage(field)}</span>
                      <span>检测到 {field.observedCount} 段显式取值</span>
                    </div>

                    <div className="proposal-field-hint">{field.confidenceHint}</div>

                    {field.conflicts && field.conflicts.length > 0 && (
                      <div className="proposal-conflicts">
                        冲突值：
                        {field.conflicts.map((item, index) => (
                          <span key={index}>
                            {formatRuleValue(item.value)} × {item.sampleCount}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="proposal-evidence">
                      {field.evidence.map((item, index) => (
                        <div key={index}>{item}</div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
