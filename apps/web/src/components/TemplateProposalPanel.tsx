import type {
  DocumentRuleProposal,
  DocumentRuleProposalField,
  RoleRuleProposal,
  RuleDraft,
  RuleProposal,
  RuleProposalField,
} from "@word-auto/validator";
import type { ProposalFeedback } from "../lib/proposalFeedback.js";
import {
  DocumentProposalCard,
  ProposalRoleCard,
} from "./TemplateProposalCards.js";

interface Props {
  draft: RuleDraft;
  proposal: RuleProposal | null;
  proposalFeedback: ProposalFeedback | null;
  onExtract: () => void;
  onAcceptDocument: (proposal: DocumentRuleProposal) => void;
  onAcceptDocumentField: (proposal: DocumentRuleProposal, field: DocumentRuleProposalField) => void;
  onAcceptField: (role: RoleRuleProposal, field: RuleProposalField) => void;
  onAcceptRole: (role: RoleRuleProposal) => void;
  onClearFeedback: () => void;
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

export function TemplateProposalPanel({
  draft,
  proposal,
  proposalFeedback,
  onAcceptDocument,
  onAcceptDocumentField,
  onAcceptField,
  onAcceptRole,
  onClearFeedback,
  onExtract,
}: Props) {
  if (!proposal) return <EmptyProposalState onExtract={onExtract} />;

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

      <div className="proposal-roles">
        {proposal.document && (
          <DocumentProposalCard
            draft={draft}
            onAcceptDocument={onAcceptDocument}
            onAcceptDocumentField={onAcceptDocumentField}
            proposal={proposal.document}
          />
        )}
        {proposal.roles.map((role) => (
          <ProposalRoleCard
            key={role.role}
            draft={draft}
            onAcceptField={onAcceptField}
            onAcceptRole={onAcceptRole}
            role={role}
          />
        ))}
      </div>
    </section>
  );
}
