import { useState } from "react";
import { parseDocx } from "@word-auto/parser";
import {
  applyProposalFieldToDraft,
  applyProposalRoleToDraft,
  extractRuleProposal,
  type RuleProposal,
} from "@word-auto/validator";
import { getFriendlyAnalyzeErrorMessage } from "../lib/analyze.js";
import type { RuleLibraryRecord } from "../lib/ruleLibraries.js";

type ProposalRole = RuleProposal["roles"][number];
type ProposalField = ProposalRole["fields"][number];

type RuleProposalOptions = {
  currentLibrary: RuleLibraryRecord | undefined;
  setRuleMessage: (message: string | null) => void;
  updateLibrary: (updater: (record: RuleLibraryRecord) => RuleLibraryRecord) => void;
};

export const useRuleProposals = ({
  currentLibrary,
  setRuleMessage,
  updateLibrary,
}: RuleProposalOptions) => {
  const [proposals, setProposals] = useState<Record<string, RuleProposal>>({});
  const currentProposal = currentLibrary ? proposals[currentLibrary.id] ?? null : null;

  const extractProposalFromFile = async (candidateFile: File) => {
    if (!currentLibrary) return;
    try {
      const model = parseDocx(new Uint8Array(await candidateFile.arrayBuffer()));
      const proposal = extractRuleProposal(model, { sourceName: candidateFile.name });
      setProposals((prev) => ({ ...prev, [currentLibrary.id]: proposal }));
      setRuleMessage(
        `已从「${candidateFile.name}」提取 ${proposal.roles.length} 个角色候选，可接受到当前草稿`,
      );
    } catch (cause) {
      setRuleMessage("候选提取失败：" + getFriendlyAnalyzeErrorMessage(cause));
    }
  };

  const acceptProposalField = (role: ProposalRole, field: ProposalField) => {
    updateLibrary((record) => ({
      ...record,
      draft: applyProposalFieldToDraft(record.draft, role, field),
    }));
    setRuleMessage(`已将 ${role.label} / ${field.key} 候选写入草稿`);
  };

  const acceptProposalRole = (role: ProposalRole) => {
    updateLibrary((record) => ({
      ...record,
      draft: applyProposalRoleToDraft(record.draft, role),
    }));
    setRuleMessage(`已将 ${role.label} 的 ${role.fields.length} 个候选写入草稿`);
  };

  return {
    currentProposal,
    acceptProposalField,
    acceptProposalRole,
    extractProposalFromFile,
  };
};
