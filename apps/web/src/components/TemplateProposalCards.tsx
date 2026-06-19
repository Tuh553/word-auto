import {
  diffDocumentProposalFieldForDraft,
  diffProposalFieldForDraft,
  getFieldLabel,
  type DocumentRuleProposal,
  type DocumentRuleProposalField,
  type ProposalApplyChange,
  type RoleRuleProposal,
  type RuleDraft,
  type RuleField,
  type RuleFieldKey,
  type RuleProposalField,
} from "@word-auto/validator";
import { RULE_SECTION_LABEL, formatRuleValue } from "./ruleConfigShared.js";
import { ProposalEvidenceDetails } from "./TemplateProposalEvidence.js";

const LEVEL_LABEL = {
  high: "高",
  medium: "中",
  low: "低",
} as const;

type ProposalFieldCardProps = {
  draft: RuleDraft;
  field: RuleProposalField;
  ignored: boolean;
  onAcceptField: (role: RoleRuleProposal, field: RuleProposalField) => void;
  onIgnoreField: () => void;
  onRestoreField: () => void;
  role: RoleRuleProposal;
};

type ProposalFieldDetailsProps = {
  confidence: number;
  confidenceHint: string;
  confidenceLevel: RuleProposalField["confidenceLevel"];
  conflictTexts: string[];
  coverage: number;
  evidence: string[];
  evidenceSamples: RuleProposalField["evidenceSamples"];
  observedCount: number;
  sampleCount: number;
  totalCount: number;
};

type ProposalFieldHeaderProps = {
  currentDisplay: string;
  diff: ProposalApplyChange;
  label: string;
  onAccept: () => void;
  onIgnore: () => void;
  onRestore: () => void;
  proposedDisplay: string;
  ignored: boolean;
};

type ProposalDetailSource = Pick<
  RuleProposalField,
  | "confidence"
  | "confidenceHint"
  | "confidenceLevel"
  | "coverage"
  | "evidence"
  | "evidenceSamples"
  | "observedCount"
  | "sampleCount"
  | "totalCount"
>;

const findDraftField = (
  draft: RuleDraft,
  roleKey: string,
  fieldKey: RuleFieldKey,
): RuleField | undefined =>
  draft.roles.find((item) => item.role === roleKey)?.fields.find((item) => item.key === fieldKey);

const formatCoverage = (
  sampleCount: number,
  totalCount: number,
  coverage: number,
): string =>
  `${sampleCount}/${totalCount}（覆盖率 ${(coverage * 100).toFixed(0)}%）`;

const formatScalar = (value: unknown, unit?: string): string => {
  if (typeof value === "boolean") return value ? "是" : "否";
  if (value == null) return "（未配置）";
  const suffix = unit === "cm" ? " cm" : "";
  return `${String(value)}${suffix}`;
};

const DIFF_LABEL: Record<ProposalApplyChange["status"], string> = {
  added: "新增字段",
  updated: "覆盖已有值",
  enabled: "启用已禁用字段",
  unchanged: "与当前值一致",
};

function ProposalFieldMeta({
  confidence,
  confidenceLevel,
  coverage,
  observedCount,
  sampleCount,
  totalCount,
}: {
  confidence: number;
  confidenceLevel: RuleProposalField["confidenceLevel"];
  coverage: number;
  observedCount: number;
  sampleCount: number;
  totalCount: number;
}) {
  return (
    <div className="proposal-field-stats">
      <span className={`proposal-badge ${confidenceLevel}`}>
        可信度 {LEVEL_LABEL[confidenceLevel]} · {confidence.toFixed(2)}
      </span>
      <span>{formatCoverage(sampleCount, totalCount, coverage)}</span>
      <span>检测到 {observedCount} 个显式取值</span>
    </div>
  );
}

function ProposalFieldDetails({
  confidence,
  confidenceHint,
  confidenceLevel,
  conflictTexts,
  coverage,
  evidence,
  evidenceSamples,
  observedCount,
  sampleCount,
  totalCount,
}: ProposalFieldDetailsProps) {
  return (
    <>
      <ProposalFieldMeta
        confidence={confidence}
        confidenceLevel={confidenceLevel}
        coverage={coverage}
        observedCount={observedCount}
        sampleCount={sampleCount}
        totalCount={totalCount}
      />
      <div className="proposal-field-hint">{confidenceHint}</div>

      {conflictTexts.length > 0 && (
        <div className="proposal-conflicts">
          冲突值：
          {conflictTexts.map((item, index) => (
            <span key={index}>{item}</span>
          ))}
        </div>
      )}

      <ProposalEvidenceDetails evidence={evidence} samples={evidenceSamples} />
    </>
  );
}

function ProposalFieldHeader({
  currentDisplay,
  diff,
  ignored,
  label,
  onAccept,
  onIgnore,
  onRestore,
  proposedDisplay,
}: ProposalFieldHeaderProps) {
  return (
    <div className="proposal-field-main">
      <div>
        <div className="proposal-field-name">
          {label}
          <span className={`proposal-diff ${diff.status}`}>{DIFF_LABEL[diff.status]}</span>
        </div>
        <div className="proposal-field-value">候选：{proposedDisplay}</div>
        <div className="proposal-field-current">
          当前草稿：{currentDisplay}
        </div>
      </div>
      <div className="proposal-field-actions">
        {ignored ? (
          <button onClick={onRestore}>取消忽略</button>
        ) : (
          <>
            <button onClick={onIgnore}>忽略</button>
            <button onClick={onAccept}>接受字段</button>
          </>
        )}
      </div>
    </div>
  );
}

const renderProposalFieldDetails = (
  field: ProposalDetailSource,
  conflictTexts: string[],
) => (
  <ProposalFieldDetails
    confidence={field.confidence}
    confidenceHint={field.confidenceHint}
    confidenceLevel={field.confidenceLevel}
    conflictTexts={conflictTexts}
    coverage={field.coverage}
    evidence={field.evidence}
    evidenceSamples={field.evidenceSamples}
    observedCount={field.observedCount}
    sampleCount={field.sampleCount}
    totalCount={field.totalCount}
  />
);

function ProposalFieldCard({
  draft,
  field,
  ignored,
  onAcceptField,
  onIgnoreField,
  onRestoreField,
  role,
}: ProposalFieldCardProps) {
  const current = findDraftField(draft, role.role, field.key);
  const diff = diffProposalFieldForDraft(draft, role, field);

  return (
    <div className={`proposal-field ${ignored ? "ignored" : ""}`}>
      <ProposalFieldHeader
        currentDisplay={current ? formatRuleValue(current.value) : "（未配置）"}
        diff={diff}
        ignored={ignored}
        label={current?.label ?? getFieldLabel(field.key)}
        onAccept={() => onAcceptField(role, field)}
        onIgnore={onIgnoreField}
        onRestore={onRestoreField}
        proposedDisplay={formatRuleValue(field.proposedValue)}
      />
      {renderProposalFieldDetails(
        field,
        (field.conflicts ?? []).map(
          (item) => `${formatRuleValue(item.value)} × ${item.sampleCount}`,
        ),
      )}
    </div>
  );
}

function DocumentProposalFieldCard({
  draft,
  field,
  ignored,
  onAcceptDocumentField,
  onIgnoreField,
  onRestoreField,
  proposal,
}: {
  draft: RuleDraft;
  field: DocumentRuleProposalField;
  ignored: boolean;
  onAcceptDocumentField: (proposal: DocumentRuleProposal, field: DocumentRuleProposalField) => void;
  onIgnoreField: () => void;
  onRestoreField: () => void;
  proposal: DocumentRuleProposal;
}) {
  const diff = diffDocumentProposalFieldForDraft(draft, proposal, field);

  return (
    <div className={`proposal-field ${ignored ? "ignored" : ""}`}>
      <ProposalFieldHeader
        currentDisplay={formatScalar(diff.previousValue, field.unit)}
        diff={diff}
        ignored={ignored}
        label={field.label}
        onAccept={() => onAcceptDocumentField(proposal, field)}
        onIgnore={onIgnoreField}
        onRestore={onRestoreField}
        proposedDisplay={formatScalar(field.proposedValue, field.unit)}
      />
      {renderProposalFieldDetails(
        field,
        (field.conflicts ?? []).map(
          (item) => `${formatScalar(item.value, field.unit)} × ${item.sampleCount}`,
        ),
      )}
    </div>
  );
}

export function DocumentProposalCard({
  draft,
  fieldIgnoreKeys,
  ignored,
  onAcceptDocument,
  onAcceptDocumentField,
  onIgnoreField,
  onRestoreField,
  proposal,
}: {
  draft: RuleDraft;
  fieldIgnoreKeys: Map<string, string>;
  ignored: boolean;
  onAcceptDocument: (proposal: DocumentRuleProposal) => void;
  onAcceptDocumentField: (proposal: DocumentRuleProposal, field: DocumentRuleProposalField) => void;
  onIgnoreField: (key: string) => void;
  onRestoreField: (key: string) => void;
  proposal: DocumentRuleProposal;
}) {
  return (
    <article className={`proposal-role ${ignored ? "ignored" : ""}`}>
      <div className="proposal-role-head">
        <div>
          <div className="proposal-role-name">{proposal.label}</div>
          <div className="proposal-role-meta">
            {RULE_SECTION_LABEL.document} · {proposal.totalCount} 个分节样本 · {proposal.fields.length} 个字段候选
          </div>
        </div>
        {!ignored && <button onClick={() => onAcceptDocument(proposal)}>整组接受到草稿</button>}
      </div>

      <div className="proposal-fields">
        {proposal.fields.map((field) => (
          <DocumentProposalFieldCard
            key={field.key}
            draft={draft}
            field={field}
            ignored={ignored}
            onAcceptDocumentField={onAcceptDocumentField}
            onIgnoreField={() => onIgnoreField(fieldIgnoreKeys.get(field.key) ?? "")}
            onRestoreField={() => onRestoreField(fieldIgnoreKeys.get(field.key) ?? "")}
            proposal={proposal}
          />
        ))}
      </div>
    </article>
  );
}

export function ProposalRoleCard({
  draft,
  fieldIgnoreKeys,
  ignored,
  onAcceptField,
  onIgnoreField,
  onIgnoreRole,
  onRestoreField,
  onRestoreRole,
  onAcceptRole,
  role,
}: {
  draft: RuleDraft;
  fieldIgnoreKeys: Map<string, string>;
  ignored: boolean;
  onAcceptField: (role: RoleRuleProposal, field: RuleProposalField) => void;
  onIgnoreField: (key: string) => void;
  onIgnoreRole: () => void;
  onRestoreField: (key: string) => void;
  onRestoreRole: () => void;
  onAcceptRole: (role: RoleRuleProposal) => void;
  role: RoleRuleProposal;
}) {
  return (
    <article className={`proposal-role ${ignored ? "ignored" : ""}`}>
      <div className="proposal-role-head">
        <div>
          <div className="proposal-role-name">{role.label}</div>
          <div className="proposal-role-meta">{role.totalCount} 段样本 · {role.fields.length} 个字段候选</div>
        </div>
        <div className="proposal-field-actions">
          {ignored ? (
            <button onClick={onRestoreRole}>取消忽略角色</button>
          ) : (
            <>
              <button onClick={onIgnoreRole}>忽略角色</button>
              <button onClick={() => onAcceptRole(role)}>整角色接受到草稿</button>
            </>
          )}
        </div>
      </div>

      <div className="proposal-fields">
        {role.fields.map((field) => (
          <ProposalFieldCard
            key={field.key}
            draft={draft}
            field={field}
            ignored={ignored}
            onAcceptField={onAcceptField}
            onIgnoreField={() => onIgnoreField(fieldIgnoreKeys.get(field.key) ?? "")}
            onRestoreField={() => onRestoreField(fieldIgnoreKeys.get(field.key) ?? "")}
            role={role}
          />
        ))}
      </div>
    </article>
  );
}
