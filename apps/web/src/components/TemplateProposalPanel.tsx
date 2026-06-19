import type {
  DocumentRuleProposal,
  DocumentRuleProposalField,
  RoleRuleProposal,
  RuleDraft,
  RuleProposal,
  RuleProposalField,
} from "@word-auto/validator";
import type { ProposalFeedback } from "../lib/proposalFeedback.js";
import type { ProposalIgnoreKey } from "../lib/proposalIgnores.js";
import {
  documentFieldProposalIgnoreKey,
  roleFieldProposalIgnoreKey,
  roleProposalIgnoreKey,
} from "../lib/proposalIgnores.js";
import {
  DocumentProposalCard,
  ProposalRoleCard,
} from "./TemplateProposalCards.js";

interface Props {
  draft: RuleDraft;
  ignoredProposalKeys: Set<ProposalIgnoreKey>;
  proposal: RuleProposal | null;
  proposalFeedback: ProposalFeedback | null;
  showIgnoredProposals: boolean;
  templateId: string;
  onExtract: () => void;
  onAcceptDocument: (proposal: DocumentRuleProposal) => void;
  onAcceptDocumentField: (proposal: DocumentRuleProposal, field: DocumentRuleProposalField) => void;
  onAcceptField: (role: RoleRuleProposal, field: RuleProposalField) => void;
  onAcceptRole: (role: RoleRuleProposal) => void;
  onClearFeedback: () => void;
  onIgnoreProposal: (key: ProposalIgnoreKey) => void;
  onRestoreProposal: (key: ProposalIgnoreKey) => void;
  onToggleIgnoredProposals: () => void;
}

const formatTime = (value: string): string =>
  new Date(value).toLocaleString("zh-CN", { hour12: false });

function EmptyProposalState({ onExtract }: { onExtract: () => void }) {
  return (
    <section className="card proposal-card">
      <div className="proposal-head">
        <div>
          <h2>模板候选提取</h2>
          <p>上传标准模板或样本文档 `.docx`，聚合页面设置和角色字段候选。</p>
        </div>
        <button className="primary" onClick={onExtract}>上传并提取候选</button>
      </div>
      <div className="proposal-empty">
        当前还没有候选结果。提取后会展示建议值、当前草稿、差异、冲突项和可信提示。
      </div>
    </section>
  );
}

function ProposalHeader({
  onExtract,
  proposal,
}: {
  onExtract: () => void;
  proposal: RuleProposal;
}) {
  return (
    <div className="proposal-head">
      <div>
        <h2>模板候选提取</h2>
        <div className="proposal-meta">
          来源：{proposal.sourceName} · 页面字段 {proposal.document?.fields.length ?? 0} · 角色 {proposal.roles.length} · 解析段落 {proposal.paragraphCount} · 已识别 {proposal.classifiedCount} · 提取时间 {formatTime(proposal.extractedAt)}
        </div>
      </div>
      <button className="primary" onClick={onExtract}>重新提取</button>
    </div>
  );
}

function ProposalFeedbackPanel({
  feedback,
  onClear,
}: {
  feedback: ProposalFeedback | null;
  onClear: () => void;
}) {
  if (!feedback) return null;
  return (
    <div className={`proposal-feedback ${feedback.kind}`}>
      <div>
        <div className="proposal-feedback-title">{feedback.title}</div>
        {feedback.details.length > 0 && (
          <div className="proposal-feedback-details">
            {feedback.details.slice(0, 8).map((item, index) => (
              <div key={index}>{item}</div>
            ))}
            {feedback.details.length > 8 && <div>另有 {feedback.details.length - 8} 项变更</div>}
          </div>
        )}
      </div>
      <button onClick={onClear}>关闭</button>
    </div>
  );
}

const documentFieldKeys = (
  templateId: string,
  proposal: DocumentRuleProposal,
): Map<string, ProposalIgnoreKey> =>
  new Map(proposal.fields.map((field) => [
    field.key,
    documentFieldProposalIgnoreKey(templateId, field.key),
  ]));

const roleFieldKeys = (
  templateId: string,
  role: RoleRuleProposal,
): Map<string, ProposalIgnoreKey> =>
  new Map(role.fields.map((field) => [
    field.key,
    roleFieldProposalIgnoreKey(templateId, role.role, field.key),
  ]));

const splitDocumentProposal = (
  templateId: string,
  proposal: DocumentRuleProposal | undefined,
  ignoredKeys: Set<ProposalIgnoreKey>,
): {
  ignored?: DocumentRuleProposal;
  visible?: DocumentRuleProposal;
} => {
  if (!proposal) return {};
  const keys = documentFieldKeys(templateId, proposal);
  const visibleFields = proposal.fields.filter((field) => !ignoredKeys.has(keys.get(field.key) ?? ""));
  const ignoredFields = proposal.fields.filter((field) => ignoredKeys.has(keys.get(field.key) ?? ""));
  return {
    visible: visibleFields.length > 0 ? { ...proposal, fields: visibleFields } : undefined,
    ignored: ignoredFields.length > 0 ? { ...proposal, fields: ignoredFields } : undefined,
  };
};

const splitRoleProposal = (
  templateId: string,
  role: RoleRuleProposal,
  ignoredKeys: Set<ProposalIgnoreKey>,
): {
  ignored?: RoleRuleProposal;
  roleKey: ProposalIgnoreKey;
  visible?: RoleRuleProposal;
} => {
  const roleKey = roleProposalIgnoreKey(templateId, role.role);
  const fieldKeys = roleFieldKeys(templateId, role);
  if (ignoredKeys.has(roleKey)) return { ignored: role, roleKey };
  const visibleFields = role.fields.filter((field) => !ignoredKeys.has(fieldKeys.get(field.key) ?? ""));
  const ignoredFields = role.fields.filter((field) => ignoredKeys.has(fieldKeys.get(field.key) ?? ""));
  return {
    roleKey,
    visible: visibleFields.length > 0 ? { ...role, fields: visibleFields } : undefined,
    ignored: ignoredFields.length > 0 ? { ...role, fields: ignoredFields } : undefined,
  };
};

type ProposalListProps = {
  draft: RuleDraft;
  documentSplit: ReturnType<typeof splitDocumentProposal>;
  mode: "visible" | "ignored";
  roleSplits: Array<ReturnType<typeof splitRoleProposal>>;
  templateId: string;
  onAcceptDocument: (proposal: DocumentRuleProposal) => void;
  onAcceptDocumentField: (proposal: DocumentRuleProposal, field: DocumentRuleProposalField) => void;
  onAcceptField: (role: RoleRuleProposal, field: RuleProposalField) => void;
  onAcceptRole: (role: RoleRuleProposal) => void;
  onIgnoreProposal: (key: ProposalIgnoreKey) => void;
  onRestoreProposal: (key: ProposalIgnoreKey) => void;
};

const proposalListClass = (mode: ProposalListProps["mode"]): string =>
  mode === "visible" ? "proposal-roles" : "proposal-ignored";

function ProposalList({
  draft,
  documentSplit,
  mode,
  roleSplits,
  templateId,
  onAcceptDocument,
  onAcceptDocumentField,
  onAcceptField,
  onAcceptRole,
  onIgnoreProposal,
  onRestoreProposal,
}: ProposalListProps) {
  const documentProposal = mode === "visible" ? documentSplit.visible : documentSplit.ignored;
  const roleKey = mode === "visible" ? "visible" : "ignored";
  const ignored = mode === "ignored";

  return (
    <div className={proposalListClass(mode)}>
      {ignored && <div className="proposal-ignored-title">已忽略</div>}
      {documentProposal && (
        <DocumentProposalCard
          draft={draft}
          fieldIgnoreKeys={documentFieldKeys(templateId, documentProposal)}
          ignored={ignored}
          onAcceptDocument={onAcceptDocument}
          onAcceptDocumentField={onAcceptDocumentField}
          onIgnoreField={onIgnoreProposal}
          onRestoreField={onRestoreProposal}
          proposal={documentProposal}
        />
      )}
      {roleSplits.map((split) => split[roleKey] && (
        <ProposalRoleCard
          key={split[roleKey].role}
          draft={draft}
          fieldIgnoreKeys={roleFieldKeys(templateId, split[roleKey])}
          ignored={ignored}
          onAcceptField={onAcceptField}
          onAcceptRole={onAcceptRole}
          onIgnoreField={onIgnoreProposal}
          onIgnoreRole={() => onIgnoreProposal(split.roleKey)}
          onRestoreField={onRestoreProposal}
          onRestoreRole={() => onRestoreProposal(split.roleKey)}
          role={split[roleKey]}
        />
      ))}
    </div>
  );
}

export function TemplateProposalPanel({
  draft,
  ignoredProposalKeys,
  proposal,
  proposalFeedback,
  showIgnoredProposals,
  templateId,
  onAcceptDocument,
  onAcceptDocumentField,
  onAcceptField,
  onAcceptRole,
  onClearFeedback,
  onExtract,
  onIgnoreProposal,
  onRestoreProposal,
  onToggleIgnoredProposals,
}: Props) {
  if (!proposal) return <EmptyProposalState onExtract={onExtract} />;
  const documentSplit = splitDocumentProposal(templateId, proposal.document, ignoredProposalKeys);
  const roleSplits = proposal.roles.map((role) =>
    splitRoleProposal(templateId, role, ignoredProposalKeys),
  );
  const ignoredCount =
    (documentSplit.ignored?.fields.length ?? 0) +
    roleSplits.reduce(
      (count, item) => count + (item.ignored ? item.ignored.fields.length : 0),
      0,
    );

  return (
    <section className="card proposal-card">
      <ProposalHeader onExtract={onExtract} proposal={proposal} />
      <ProposalFeedbackPanel feedback={proposalFeedback} onClear={onClearFeedback} />

      {proposal.notices.length > 0 && (
        <div className="proposal-notices">
          {proposal.notices.map((notice, index) => (
            <div className="proposal-notice" key={index}>{notice}</div>
          ))}
        </div>
      )}

      {ignoredCount > 0 && (
        <div className="proposal-ignore-toggle">
          <span>已忽略 {ignoredCount} 个候选</span>
          <button onClick={onToggleIgnoredProposals}>
            {showIgnoredProposals ? "隐藏已忽略" : "显示已忽略"}
          </button>
        </div>
      )}

      <ProposalList
        draft={draft}
        documentSplit={documentSplit}
        mode="visible"
        roleSplits={roleSplits}
        templateId={templateId}
        onAcceptDocument={onAcceptDocument}
        onAcceptDocumentField={onAcceptDocumentField}
        onAcceptField={onAcceptField}
        onAcceptRole={onAcceptRole}
        onIgnoreProposal={onIgnoreProposal}
        onRestoreProposal={onRestoreProposal}
      />
      {showIgnoredProposals && ignoredCount > 0 && (
        <ProposalList
          draft={draft}
          documentSplit={documentSplit}
          mode="ignored"
          roleSplits={roleSplits}
          templateId={templateId}
          onAcceptDocument={onAcceptDocument}
          onAcceptDocumentField={onAcceptDocumentField}
          onAcceptField={onAcceptField}
          onAcceptRole={onAcceptRole}
          onIgnoreProposal={onIgnoreProposal}
          onRestoreProposal={onRestoreProposal}
        />
      )}
    </section>
  );
}
