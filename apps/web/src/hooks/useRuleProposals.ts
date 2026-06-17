import { useState, type Dispatch, type SetStateAction } from "react";
import { parseDocx } from "@word-auto/parser";
import {
  applyDocumentProposalFieldToDraftWithResult,
  applyDocumentProposalToDraftWithResult,
  applyProposalFieldToDraftWithResult,
  applyProposalRoleToDraftWithResult,
  extractRuleProposal,
  type DocumentRuleProposal,
  type DocumentRuleProposalField,
  type ProposalApplyResult,
  type RuleProposal,
} from "@word-auto/validator";
import { getFriendlyAnalyzeErrorMessage } from "../lib/analyze.js";
import {
  errorProposalFeedback,
  formatProposalApplyResult,
  type ProposalFeedback,
} from "../lib/proposalFeedback.js";
import type { RuleLibraryRecord } from "../lib/ruleLibraries.js";

type ProposalRole = RuleProposal["roles"][number];
type ProposalField = ProposalRole["fields"][number];

type RuleProposalOptions = {
  currentLibrary: RuleLibraryRecord | undefined;
  setRuleMessage: (message: string | null) => void;
  updateLibrary: (updater: (record: RuleLibraryRecord) => RuleLibraryRecord) => void;
};

type ProposalSetters = {
  setProposalFeedback: (feedback: ProposalFeedback | null) => void;
  setProposals: Dispatch<SetStateAction<Record<string, RuleProposal>>>;
  setRuleMessage: (message: string | null) => void;
};

const updateDraftWithResult = (
  currentLibrary: RuleLibraryRecord | undefined,
  updateLibrary: RuleProposalOptions["updateLibrary"],
  apply: (record: RuleLibraryRecord) => ProposalApplyResult,
): ProposalApplyResult | null => {
  if (!currentLibrary) return null;
  const result = apply(currentLibrary);
  updateLibrary((record) => ({
    ...record,
    draft: result.draft,
  }));
  return result;
};

const conflictCountOf = (
  fields: Array<{ conflicts?: unknown[] }>,
): number =>
  fields.filter((field) => (field.conflicts?.length ?? 0) > 0).length;

const handleExtractProposal = async (
  currentLibrary: RuleLibraryRecord | undefined,
  candidateFile: File,
  setters: ProposalSetters,
): Promise<void> => {
  if (!currentLibrary) return;
  try {
    const model = parseDocx(new Uint8Array(await candidateFile.arrayBuffer()));
    const proposal = extractRuleProposal(model, { sourceName: candidateFile.name });
    setters.setProposals((prev) => ({ ...prev, [currentLibrary.id]: proposal }));
    setters.setProposalFeedback(null);
    setters.setRuleMessage(
      `已从「${candidateFile.name}」提取 ${proposal.document?.fields.length ?? 0} 个文档字段和 ${proposal.roles.length} 个角色候选`,
    );
  } catch (cause) {
    const message = getFriendlyAnalyzeErrorMessage(cause);
    setters.setProposalFeedback(errorProposalFeedback("候选提取失败", message));
    setters.setRuleMessage("候选提取失败：" + message);
  }
};

const handleAcceptResult = (
  result: ProposalApplyResult | null,
  scopeLabel: string,
  conflictCount: number,
  setters: Pick<ProposalSetters, "setProposalFeedback" | "setRuleMessage">,
  message: string,
): void => {
  if (!result) return;
  setters.setProposalFeedback(formatProposalApplyResult(result, scopeLabel, conflictCount));
  setters.setRuleMessage(message);
};

const acceptDraftChange = (
  context: {
    apply: (record: RuleLibraryRecord) => ProposalApplyResult;
    conflictCount: number;
    currentLibrary: RuleLibraryRecord | undefined;
    labels: { scope: string; success: string; error: string };
    setters: Pick<ProposalSetters, "setProposalFeedback" | "setRuleMessage">;
    updateLibrary: RuleProposalOptions["updateLibrary"];
  },
): void => {
  try {
    const result = updateDraftWithResult(
      context.currentLibrary,
      context.updateLibrary,
      context.apply,
    );
    handleAcceptResult(
      result,
      context.labels.scope,
      context.conflictCount,
      context.setters,
      context.labels.success,
    );
  } catch (cause) {
    context.setters.setProposalFeedback(
      errorProposalFeedback(context.labels.error, getFriendlyAnalyzeErrorMessage(cause)),
    );
  }
};

export const useRuleProposals = ({
  currentLibrary,
  setRuleMessage,
  updateLibrary,
}: RuleProposalOptions) => {
  const [proposals, setProposals] = useState<Record<string, RuleProposal>>({});
  const [proposalFeedback, setProposalFeedback] = useState<ProposalFeedback | null>(null);
  const currentProposal = currentLibrary ? proposals[currentLibrary.id] ?? null : null;
  const setters = { setProposalFeedback, setProposals, setRuleMessage };

  const acceptProposalField = (role: ProposalRole, field: ProposalField) => {
    acceptDraftChange({
      apply: (record) => applyProposalFieldToDraftWithResult(record.draft, role, field),
      conflictCount: field.conflicts?.length ?? 0,
      currentLibrary,
      labels: {
        scope: `${role.label} / ${field.key}`,
        success: `已处理 ${role.label} / ${field.key} 候选`,
        error: `接受 ${role.label} / ${field.key} 失败`,
      },
      setters,
      updateLibrary,
    });
  };

  const acceptProposalRole = (role: ProposalRole) => {
    acceptDraftChange({
      apply: (record) => applyProposalRoleToDraftWithResult(record.draft, role),
      conflictCount: conflictCountOf(role.fields),
      currentLibrary,
      labels: {
        scope: role.label,
        success: `已处理 ${role.label} 候选`,
        error: `接受 ${role.label} 失败`,
      },
      setters,
      updateLibrary,
    });
  };

  const acceptDocumentProposalField = (
    documentProposal: DocumentRuleProposal,
    field: DocumentRuleProposalField,
  ) => {
    acceptDraftChange({
      apply: (record) => applyDocumentProposalFieldToDraftWithResult(record.draft, documentProposal, field),
      conflictCount: field.conflicts?.length ?? 0,
      currentLibrary,
      labels: {
        scope: `${documentProposal.label} / ${field.label}`,
        success: `已处理 ${field.label} 页面设置候选`,
        error: `接受 ${field.label} 页面设置失败`,
      },
      setters,
      updateLibrary,
    });
  };

  const acceptDocumentProposal = (documentProposal: DocumentRuleProposal) => {
    acceptDraftChange({
      apply: (record) => applyDocumentProposalToDraftWithResult(record.draft, documentProposal),
      conflictCount: conflictCountOf(documentProposal.fields),
      currentLibrary,
      labels: {
        scope: documentProposal.label,
        success: `已处理 ${documentProposal.label} 候选`,
        error: `接受 ${documentProposal.label} 失败`,
      },
      setters,
      updateLibrary,
    });
  };

  return {
    currentProposal,
    proposalFeedback,
    clearProposalFeedback: () => setProposalFeedback(null),
    acceptDocumentProposal,
    acceptDocumentProposalField,
    acceptProposalField,
    acceptProposalRole,
    extractProposalFromFile: (file: File) =>
      handleExtractProposal(currentLibrary, file, setters),
  };
};
