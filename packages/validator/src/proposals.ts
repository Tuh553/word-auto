import type { DocModel, Paragraph } from "@word-auto/parser";
import { classifyParagraphs } from "./classify.js";
import {
  buildRuleField,
  getRoleLabel,
  RULE_FIELD_ORDER,
  RULE_FIELD_UNITS,
} from "./rules.js";
import type {
  Role,
  RoleRuleProposal,
  RuleDraft,
  RuleField,
  RuleFieldKey,
  RuleProposal,
  RuleProposalField,
  RuleValue,
} from "./types.js";

type Scalar = string | number | boolean;

type CandidateSample = {
  value: Scalar;
  preview: string;
  paraIndex: number;
};

type FieldSpec = {
  key: RuleFieldKey;
  unit: RuleValue["unit"];
  read: (para: Paragraph) => Scalar | undefined;
};

const textHasCJK = (text: string): boolean => /[一-鿿]/.test(text);
const textHasLatin = (text: string): boolean => /[A-Za-z]/.test(text);

const previewText = (text: string): string =>
  text.replace(/\s+/g, " ").trim().slice(0, 24);

const roundNumber = (value: number, digits = 2): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const normalizeAlign = (alignment?: string): string | undefined => {
  if (!alignment) return undefined;
  const map: Record<string, string> = {
    both: "justify",
    distribute: "justify",
    start: "left",
    end: "right",
  };
  return map[alignment] ?? alignment;
};

const outlineComparable = (value: number | undefined): number =>
  value == null ? 10 : value + 1;

const FIELD_SPECS: FieldSpec[] = [
  {
    key: "fontFamilyCn",
    unit: RULE_FIELD_UNITS.fontFamilyCn,
    read: (para) => textHasCJK(para.text) ? para.effective.fontEastAsia : undefined,
  },
  {
    key: "fontFamilyLatin",
    unit: RULE_FIELD_UNITS.fontFamilyLatin,
    read: (para) => textHasLatin(para.text) ? para.effective.fontAscii : undefined,
  },
  {
    key: "fontSizePt",
    unit: RULE_FIELD_UNITS.fontSizePt,
    read: (para) =>
      para.effective.sizePt == null ? undefined : roundNumber(para.effective.sizePt, 2),
  },
  {
    key: "bold",
    unit: RULE_FIELD_UNITS.bold,
    read: (para) => !!para.effective.bold,
  },
  {
    key: "align",
    unit: RULE_FIELD_UNITS.align,
    read: (para) => normalizeAlign(para.effective.alignment),
  },
  {
    key: "lineHeightPt",
    unit: RULE_FIELD_UNITS.lineHeightPt,
    read: (para) =>
      para.effective.lineSpacing?.pt == null
        ? undefined
        : roundNumber(para.effective.lineSpacing.pt, 1),
  },
  {
    key: "spaceBeforePt",
    unit: RULE_FIELD_UNITS.spaceBeforePt,
    read: (para) =>
      para.effective.spacingBeforePt == null
        ? undefined
        : roundNumber(para.effective.spacingBeforePt, 1),
  },
  {
    key: "spaceAfterPt",
    unit: RULE_FIELD_UNITS.spaceAfterPt,
    read: (para) =>
      para.effective.spacingAfterPt == null
        ? undefined
        : roundNumber(para.effective.spacingAfterPt, 1),
  },
  {
    key: "firstLineIndentChars",
    unit: RULE_FIELD_UNITS.firstLineIndentChars,
    read: (para) =>
      para.effective.firstLineIndentChars == null
        ? undefined
        : roundNumber(para.effective.firstLineIndentChars, 1),
  },
  {
    key: "hangingIndentChars",
    unit: RULE_FIELD_UNITS.hangingIndentChars,
    read: (para) =>
      para.effective.hangingIndentChars == null
        ? undefined
        : roundNumber(para.effective.hangingIndentChars, 1),
  },
  {
    key: "leftIndentChars",
    unit: RULE_FIELD_UNITS.leftIndentChars,
    read: (para) =>
      para.effective.leftIndentChars == null
        ? undefined
        : roundNumber(para.effective.leftIndentChars, 1),
  },
  {
    key: "outlineLevel",
    unit: RULE_FIELD_UNITS.outlineLevel,
    read: (para) => outlineComparable(para.effective.outlineLevel),
  },
];

const toKey = (value: Scalar): string => JSON.stringify(value);

const toRuleValue = (value: Scalar, unit: RuleValue["unit"]): RuleValue => ({
  mode: "exact",
  exact: value,
  unit,
});

const confidenceLevelOf = (confidence: number): "high" | "medium" | "low" => {
  if (confidence >= 0.85) return "high";
  if (confidence >= 0.6) return "medium";
  return "low";
};

const confidenceHintOf = (
  confidence: number,
  coverage: number,
  totalCount: number,
  conflictCount: number,
): string => {
  if (totalCount < 2) return "样本过少，仅供人工参考";
  if (confidence >= 0.85 && conflictCount === 0) return "主值集中，可直接进入草稿复核";
  if (coverage >= 0.6) return "存在少量冲突，建议接受后结合原文抽查";
  return "覆盖不足或冲突偏多，建议先检查样本质量与角色识别";
};

const extractFieldProposal = (
  role: Role,
  paragraphs: Paragraph[],
  spec: FieldSpec,
): RuleProposalField | null => {
  const samples: CandidateSample[] = paragraphs.flatMap((para) => {
    const value = spec.read(para);
    return value == null
      ? []
      : [{
          value,
          preview: previewText(para.text),
          paraIndex: para.index,
        }];
  });

  if (samples.length === 0) return null;

  const groups = new Map<string, CandidateSample[]>();
  for (const sample of samples) {
    const key = toKey(sample.value);
    const arr = groups.get(key) ?? [];
    arr.push(sample);
    groups.set(key, arr);
  }

  const ordered = [...groups.entries()]
    .map(([key, values]) => ({ key, values, value: JSON.parse(key) as Scalar }))
    .sort((left, right) => right.values.length - left.values.length || left.key.localeCompare(right.key));

  const primary = ordered[0];
  const sampleCount = primary.values.length;
  const observedCount = samples.length;
  const totalCount = paragraphs.length;
  const coverage = totalCount === 0 ? 0 : roundNumber(sampleCount / totalCount, 2);
  const dominance = observedCount === 0 ? 0 : sampleCount / observedCount;
  const sampleFactor = Math.min(1, observedCount / 5);
  const confidence = roundNumber((dominance * 0.7 + coverage * 0.3) * (0.6 + sampleFactor * 0.4), 2);
  const conflicts = ordered.slice(1).map((item) => ({
    value: toRuleValue(item.value, spec.unit),
    sampleCount: item.values.length,
    evidence: item.values.slice(0, 3).map(
      (sample) => `段落 ${sample.paraIndex}: ${sample.preview}`,
    ),
  }));
  const evidence = primary.values.slice(0, 3).map(
    (sample) => `段落 ${sample.paraIndex}: ${sample.preview}`,
  );

  return {
    key: spec.key,
    proposedValue: toRuleValue(primary.value, spec.unit),
    confidence,
    confidenceLevel: confidenceLevelOf(confidence),
    confidenceHint: confidenceHintOf(confidence, coverage, totalCount, conflicts.length),
    sampleCount,
    coverage,
    observedCount,
    totalCount,
    evidence: [
      `角色「${getRoleLabel(role)}」共 ${totalCount} 段，其中 ${observedCount} 段检测到该字段，${sampleCount} 段命中主值`,
      ...evidence,
    ],
    conflicts: conflicts.length > 0 ? conflicts : undefined,
  };
};

export const extractRuleProposal = (
  model: DocModel,
  options: { sourceName?: string } = {},
): RuleProposal => {
  const roles = classifyParagraphs(model.paragraphs);
  const byRole = new Map<Role, Paragraph[]>();
  let classifiedCount = 0;

  model.paragraphs.forEach((para, index) => {
    const role = roles[index];
    if (!role) return;
    classifiedCount++;
    const list = byRole.get(role) ?? [];
    list.push(para);
    byRole.set(role, list);
  });

  const notices: string[] = [];
  if (classifiedCount < model.paragraphs.length) {
    notices.push(
      `有 ${model.paragraphs.length - classifiedCount} 段未被角色识别，候选结果只基于已识别段落`,
    );
  }
  notices.push("行距候选仅统计显式固定/最小行距；多倍行距不会自动折算为 pt");

  const roleProposals: RoleRuleProposal[] = [...byRole.entries()]
    .map(([role, paragraphs]) => ({
      role,
      label: getRoleLabel(role),
      totalCount: paragraphs.length,
      fields: FIELD_SPECS
        .map((spec) => extractFieldProposal(role, paragraphs, spec))
        .filter((item): item is RuleProposalField => item != null),
    }))
    .filter((role) => role.fields.length > 0)
    .sort((left, right) => right.totalCount - left.totalCount || left.role.localeCompare(right.role));

  return {
    sourceName: options.sourceName ?? "未命名文档",
    extractedAt: new Date().toISOString(),
    paragraphCount: model.paragraphs.length,
    classifiedCount,
    unclassifiedCount: model.paragraphs.length - classifiedCount,
    notices,
    roles: roleProposals,
  };
};

const sortFields = (fields: RuleField[]): RuleField[] =>
  [...fields].sort(
    (left, right) =>
      RULE_FIELD_ORDER.indexOf(left.key) - RULE_FIELD_ORDER.indexOf(right.key),
  );

export const applyProposalFieldToDraft = (
  draft: RuleDraft,
  roleProposal: RoleRuleProposal,
  fieldProposal: RuleProposalField,
): RuleDraft => {
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

  const existing = roleRule.fields.find((item) => item.key === fieldProposal.key);
  if (existing) {
    existing.enabled = true;
    existing.value = structuredClone(fieldProposal.proposedValue);
  } else {
    roleRule.fields.push(buildRuleField(fieldProposal.key, structuredClone(fieldProposal.proposedValue)));
    roleRule.fields = sortFields(roleRule.fields);
  }
  return next;
};

export const applyProposalRoleToDraft = (
  draft: RuleDraft,
  roleProposal: RoleRuleProposal,
): RuleDraft =>
  roleProposal.fields.reduce(
    (current, field) => applyProposalFieldToDraft(current, roleProposal, field),
    draft,
  );
