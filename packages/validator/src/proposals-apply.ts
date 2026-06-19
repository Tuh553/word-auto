import {
  buildRuleField,
  getFieldLabel,
  RULE_FIELD_ORDER,
} from "./rules.js";
import type {
  DocumentRuleProposal,
  DocumentRuleProposalField,
  ProposalApplyChange,
  ProposalApplyResult,
  RoleRuleProposal,
  RuleDraft,
  RuleField,
  RuleProposalField,
} from "./types.js";

const sortFields = (fields: RuleField[]): RuleField[] =>
  [...fields].sort(
    (left, right) =>
      RULE_FIELD_ORDER.indexOf(left.key) - RULE_FIELD_ORDER.indexOf(right.key),
  );

const sameValue = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

const buildApplyResult = (
  draft: RuleDraft,
  changes: ProposalApplyChange[],
): ProposalApplyResult => ({
  draft,
  changes,
});

const applyRoleField = (
  draft: RuleDraft,
  roleProposal: RoleRuleProposal,
  fieldProposal: RuleProposalField,
): ProposalApplyResult => {
  const next = structuredClone(draft);
  let roleRule = next.roles.find((item) => item.role === roleProposal.role);
  if (!roleRule) {
    roleRule = {
      role: roleProposal.role,
      label: roleProposal.label,
      fields: [],
    };
    next.roles.push(roleRule);
  } else {
    roleRule.label = roleProposal.label;
  }

  const nextValue = structuredClone(fieldProposal.proposedValue);
  const existing = roleRule.fields.find((item) => item.key === fieldProposal.key);
  const previousValue = existing ? structuredClone(existing.value) : undefined;
  const status = !existing
    ? "added"
    : !existing.enabled && sameValue(existing.value, nextValue)
      ? "enabled"
      : sameValue(existing.value, nextValue) && existing.enabled
        ? "unchanged"
        : "updated";

  if (existing) {
    existing.enabled = true;
    existing.value = nextValue;
  } else {
    roleRule.fields.push(buildRuleField(fieldProposal.key, nextValue));
    roleRule.fields = sortFields(roleRule.fields);
  }

  return buildApplyResult(next, [{
    scope: "role",
    targetKey: roleProposal.role,
    targetLabel: roleProposal.label,
    fieldKey: fieldProposal.key,
    fieldLabel: getFieldLabel(fieldProposal.key),
    previousValue,
    nextValue,
    status,
  }]);
};

export const applyProposalFieldToDraft = (
  draft: RuleDraft,
  roleProposal: RoleRuleProposal,
  fieldProposal: RuleProposalField,
): RuleDraft =>
  applyRoleField(draft, roleProposal, fieldProposal).draft;

export const applyProposalFieldToDraftWithResult = (
  draft: RuleDraft,
  roleProposal: RoleRuleProposal,
  fieldProposal: RuleProposalField,
): ProposalApplyResult =>
  applyRoleField(draft, roleProposal, fieldProposal);

export const diffProposalFieldForDraft = (
  draft: RuleDraft,
  roleProposal: RoleRuleProposal,
  fieldProposal: RuleProposalField,
): ProposalApplyChange =>
  applyRoleField(draft, roleProposal, fieldProposal).changes[0];

export const applyDocumentProposalFieldToDraftWithResult = (
  draft: RuleDraft,
  documentProposal: DocumentRuleProposal,
  fieldProposal: DocumentRuleProposalField,
): ProposalApplyResult => {
  const next = structuredClone(draft);
  if (!next.document) next.document = {};
  const previousValue = next.document[fieldProposal.key];
  const nextValue = fieldProposal.proposedValue;
  const status = previousValue == null
    ? "added"
    : sameValue(previousValue, nextValue)
      ? "unchanged"
      : "updated";
  next.document[fieldProposal.key] = nextValue as never;
  return buildApplyResult(next, [{
    scope: "document",
    targetKey: documentProposal.key,
    targetLabel: documentProposal.label,
    fieldKey: fieldProposal.key,
    fieldLabel: fieldProposal.label,
    previousValue,
    nextValue,
    status,
  }]);
};

export const diffDocumentProposalFieldForDraft = (
  draft: RuleDraft,
  documentProposal: DocumentRuleProposal,
  fieldProposal: DocumentRuleProposalField,
): ProposalApplyChange =>
  applyDocumentProposalFieldToDraftWithResult(draft, documentProposal, fieldProposal).changes[0];

export const applyProposalRoleToDraft = (
  draft: RuleDraft,
  roleProposal: RoleRuleProposal,
): RuleDraft =>
  applyProposalRoleToDraftWithResult(draft, roleProposal).draft;

export const applyProposalRoleToDraftWithResult = (
  draft: RuleDraft,
  roleProposal: RoleRuleProposal,
): ProposalApplyResult => {
  let current = draft;
  const changes: ProposalApplyChange[] = [];
  for (const field of roleProposal.fields) {
    const result = applyRoleField(current, roleProposal, field);
    current = result.draft;
    changes.push(...result.changes);
  }
  return buildApplyResult(current, changes);
};

export const applyDocumentProposalToDraftWithResult = (
  draft: RuleDraft,
  documentProposal: DocumentRuleProposal,
): ProposalApplyResult => {
  let current = draft;
  const changes: ProposalApplyChange[] = [];
  for (const field of documentProposal.fields) {
    const result = applyDocumentProposalFieldToDraftWithResult(current, documentProposal, field);
    current = result.draft;
    changes.push(...result.changes);
  }
  return buildApplyResult(current, changes);
};
