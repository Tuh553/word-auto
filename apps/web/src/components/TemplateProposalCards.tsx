import {
  getFieldLabel,
  type DocumentRuleKey,
  type DocumentRuleProposal,
  type DocumentRuleProposalField,
  type RoleRuleProposal,
  type RuleDraft,
  type RuleField,
  type RuleFieldKey,
  type RuleProposalField,
} from "@word-auto/validator";
import { RULE_SECTION_LABEL, formatRuleValue } from "./ruleConfigShared.js";

const LEVEL_LABEL = {
  high: "高",
  medium: "中",
  low: "低",
} as const;

type ProposalFieldCardProps = {
  draft: RuleDraft;
  field: RuleProposalField;
  onAcceptField: (role: RoleRuleProposal, field: RuleProposalField) => void;
  role: RoleRuleProposal;
};

type ProposalFieldDetailsProps = {
  confidence: number;
  confidenceHint: string;
  confidenceLevel: RuleProposalField["confidenceLevel"];
  conflictTexts: string[];
  coverage: number;
  evidence: string[];
  observedCount: number;
  sampleCount: number;
  totalCount: number;
};

type ProposalFieldHeaderProps = {
  currentDisplay: string;
  currentExists: boolean;
  currentValue: unknown;
  label: string;
  onAccept: () => void;
  proposedDisplay: string;
  proposedValue: unknown;
};

type ProposalDetailSource = Pick<
  RuleProposalField,
  | "confidence"
  | "confidenceHint"
  | "confidenceLevel"
  | "coverage"
  | "evidence"
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

const sameValue = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

const diffLabel = (
  current: unknown,
  proposed: unknown,
  currentExists: boolean,
): string => {
  if (!currentExists) return "将新增";
  return sameValue(current, proposed) ? "无变化" : "将覆盖";
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

      <div className="proposal-evidence">
        {evidence.map((item, index) => (
          <div key={index}>{item}</div>
        ))}
      </div>
    </>
  );
}

function ProposalFieldHeader({
  currentDisplay,
  currentExists,
  currentValue,
  label,
  onAccept,
  proposedDisplay,
  proposedValue,
}: ProposalFieldHeaderProps) {
  return (
    <div className="proposal-field-main">
      <div>
        <div className="proposal-field-name">
          {label}
          <span className="proposal-diff">{diffLabel(currentValue, proposedValue, currentExists)}</span>
        </div>
        <div className="proposal-field-value">候选：{proposedDisplay}</div>
        <div className="proposal-field-current">当前草稿：{currentDisplay}</div>
      </div>
      <button onClick={onAccept}>接受字段</button>
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
    observedCount={field.observedCount}
    sampleCount={field.sampleCount}
    totalCount={field.totalCount}
  />
);

function ProposalFieldCard({
  draft,
  field,
  onAcceptField,
  role,
}: ProposalFieldCardProps) {
  const current = findDraftField(draft, role.role, field.key);
  const currentValue = current?.value;
  const proposedValue = field.proposedValue;

  return (
    <div className="proposal-field">
      <ProposalFieldHeader
        currentDisplay={current ? formatRuleValue(current.value) : "（未配置）"}
        currentExists={current != null}
        currentValue={currentValue}
        label={current?.label ?? getFieldLabel(field.key)}
        onAccept={() => onAcceptField(role, field)}
        proposedDisplay={formatRuleValue(proposedValue)}
        proposedValue={proposedValue}
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
  onAcceptDocumentField,
  proposal,
}: {
  draft: RuleDraft;
  field: DocumentRuleProposalField;
  onAcceptDocumentField: (proposal: DocumentRuleProposal, field: DocumentRuleProposalField) => void;
  proposal: DocumentRuleProposal;
}) {
  const currentValue = draft.document?.[field.key as DocumentRuleKey];
  const currentExists = currentValue != null;

  return (
    <div className="proposal-field">
      <ProposalFieldHeader
        currentDisplay={formatScalar(currentValue, field.unit)}
        currentExists={currentExists}
        currentValue={currentValue}
        label={field.label}
        onAccept={() => onAcceptDocumentField(proposal, field)}
        proposedDisplay={formatScalar(field.proposedValue, field.unit)}
        proposedValue={field.proposedValue}
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
  onAcceptDocument,
  onAcceptDocumentField,
  proposal,
}: {
  draft: RuleDraft;
  onAcceptDocument: (proposal: DocumentRuleProposal) => void;
  onAcceptDocumentField: (proposal: DocumentRuleProposal, field: DocumentRuleProposalField) => void;
  proposal: DocumentRuleProposal;
}) {
  return (
    <article className="proposal-role">
      <div className="proposal-role-head">
        <div>
          <div className="proposal-role-name">{proposal.label}</div>
          <div className="proposal-role-meta">
            {RULE_SECTION_LABEL.document} · {proposal.totalCount} 个分节样本 · {proposal.fields.length} 个字段候选
          </div>
        </div>
        <button onClick={() => onAcceptDocument(proposal)}>整组接受到草稿</button>
      </div>

      <div className="proposal-fields">
        {proposal.fields.map((field) => (
          <DocumentProposalFieldCard
            key={field.key}
            draft={draft}
            field={field}
            onAcceptDocumentField={onAcceptDocumentField}
            proposal={proposal}
          />
        ))}
      </div>
    </article>
  );
}

export function ProposalRoleCard({
  draft,
  onAcceptField,
  onAcceptRole,
  role,
}: {
  draft: RuleDraft;
  onAcceptField: (role: RoleRuleProposal, field: RuleProposalField) => void;
  onAcceptRole: (role: RoleRuleProposal) => void;
  role: RoleRuleProposal;
}) {
  return (
    <article className="proposal-role">
      <div className="proposal-role-head">
        <div>
          <div className="proposal-role-name">{role.label}</div>
          <div className="proposal-role-meta">{role.totalCount} 段样本 · {role.fields.length} 个字段候选</div>
        </div>
        <button onClick={() => onAcceptRole(role)}>整角色接受到草稿</button>
      </div>

      <div className="proposal-fields">
        {role.fields.map((field) => (
          <ProposalFieldCard
            key={field.key}
            draft={draft}
            field={field}
            onAcceptField={onAcceptField}
            role={role}
          />
        ))}
      </div>
    </article>
  );
}
