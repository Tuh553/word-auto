import type { ProposalApplyResult } from "@word-auto/validator";

export type ProposalFeedback = {
  kind: "success" | "error" | "info";
  title: string;
  details: string[];
};

export const formatProposalApplyResult = (
  result: ProposalApplyResult,
  scopeLabel: string,
  conflictCount: number,
): ProposalFeedback => {
  const details = result.changes.map((change) => {
    const verb = change.status === "added"
      ? "新增"
      : change.status === "updated"
        ? "覆盖"
        : change.status === "enabled"
          ? "启用"
          : "保持不变";
    return `${verb} ${change.targetLabel} / ${change.fieldLabel}`;
  });
  if (conflictCount > 0) {
    details.push(`本次接受包含 ${conflictCount} 个有冲突样本的候选字段，建议回看模板原文`);
  }
  const changedCount = result.changes.filter((change) => change.status !== "unchanged").length;
  return changedCount === 0
    ? {
        kind: "info",
        title: `${scopeLabel}与当前草稿已一致，没有新增写入`,
        details,
      }
    : {
        kind: "success",
        title: `${scopeLabel}已写入草稿，共 ${changedCount} 项发生变化`,
        details,
      };
};

export const errorProposalFeedback = (
  title: string,
  message: string,
): ProposalFeedback => ({
  kind: "error",
  title,
  details: [message],
});
