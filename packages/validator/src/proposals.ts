import type { DocModel, Paragraph } from "@word-auto/parser";
import { classifyParagraphDetails } from "./classify.js";
import { extractDocumentProposal } from "./proposals-document.js";
import {
  type CandidateSample,
  type Scalar,
  roundNumber,
  summarizeSamples,
} from "./proposals-shared.js";
import {
  getRoleLabel,
  RULE_FIELD_UNITS,
} from "./rules.js";
import type {
  Role,
  RoleRuleProposal,
  RuleFieldKey,
  RuleProposal,
  RuleProposalField,
  RuleValue,
} from "./types.js";

type FieldSpec = {
  key: RuleFieldKey;
  unit: RuleValue["unit"];
  read: (para: Paragraph) => Scalar | undefined;
};

const textHasCJK = (text: string): boolean => /[一-鿿]/.test(text);
const textHasLatin = (text: string): boolean => /[A-Za-z]/.test(text);

const previewText = (text: string): string =>
  text.replace(/\s+/g, " ").trim().slice(0, 24);

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

const toRuleValue = (value: Scalar, unit: RuleValue["unit"]): RuleValue => ({
  mode: "exact",
  exact: value,
  unit,
});

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
          sampleIndex: para.index,
        }];
  });
  const summary = summarizeSamples(samples, paragraphs.length);
  if (!summary) return null;

  return {
    key: spec.key,
    proposedValue: toRuleValue(summary.primaryValue, spec.unit),
    confidence: summary.confidence,
    confidenceLevel: summary.confidenceLevel,
    confidenceHint: summary.confidenceHint,
    sampleCount: summary.sampleCount,
    coverage: summary.coverage,
    observedCount: summary.observedCount,
    totalCount: summary.totalCount,
    evidence: [
      `角色「${getRoleLabel(role)}」共 ${summary.totalCount} 段，其中 ${summary.observedCount} 段检测到该字段，${summary.sampleCount} 段命中主值`,
      ...summary.evidence.map((item) => item.replace(/^样本 /, "段落 ")),
    ],
    conflicts: summary.conflicts.length > 0
      ? summary.conflicts.map((item) => ({
          value: toRuleValue(item.value, spec.unit),
          sampleCount: item.sampleCount,
          evidence: item.evidence.map((sample) => sample.replace(/^样本 /, "段落 ")),
        }))
      : undefined,
  };
};

const collectParagraphsByRole = (
  model: DocModel,
): {
  byRole: Map<Role, Paragraph[]>;
  classifiedCount: number;
  lowConfidenceCount: number;
} => {
  const classified = classifyParagraphDetails(model.paragraphs);
  const byRole = new Map<Role, Paragraph[]>();
  let classifiedCount = 0;
  let lowConfidenceCount = 0;

  classified.forEach(({ confidence, para, role }) => {
    if (!role) return;
    classifiedCount++;
    if (confidence === "low") lowConfidenceCount++;
    const list = byRole.get(role) ?? [];
    list.push(para);
    byRole.set(role, list);
  });

  return { byRole, classifiedCount, lowConfidenceCount };
};

const buildNotices = (
  model: DocModel,
  classifiedCount: number,
  lowConfidenceCount: number,
  hasDocumentConflicts: boolean,
): string[] => {
  const notices: string[] = [];
  if (classifiedCount < model.paragraphs.length) {
    notices.push(
      `有 ${model.paragraphs.length - classifiedCount} 段未被角色识别，候选结果只基于已识别段落`,
    );
  }
  if (lowConfidenceCount > 0) {
    notices.push(
      `有 ${lowConfidenceCount} 段角色识别置信度低，接受候选前请优先复核相关样本`,
    );
  }
  if (model.sections.length === 0) {
    notices.push("未检测到分节页面设置，文档级页面候选无法自动提取");
  } else if (hasDocumentConflicts) {
    notices.push("部分页面设置在不同分节间存在冲突，接受前请结合模板检查是否需要统一");
  }
  notices.push("行距候选仅统计显式固定/最小行距；多倍行距不会自动折算为 pt");
  return notices;
};

const buildRoleProposals = (byRole: Map<Role, Paragraph[]>): RoleRuleProposal[] =>
  [...byRole.entries()]
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

export const extractRuleProposal = (
  model: DocModel,
  options: { sourceName?: string } = {},
): RuleProposal => {
  const { byRole, classifiedCount, lowConfidenceCount } = collectParagraphsByRole(model);
  const document = extractDocumentProposal(model);
  const hasDocumentConflicts =
    document?.fields.some((field) => field.conflicts && field.conflicts.length > 0) ?? false;

  return {
    sourceName: options.sourceName ?? "未命名文档",
    extractedAt: new Date().toISOString(),
    paragraphCount: model.paragraphs.length,
    classifiedCount,
    unclassifiedCount: model.paragraphs.length - classifiedCount,
    notices: buildNotices(model, classifiedCount, lowConfidenceCount, hasDocumentConflicts),
    document: document ?? undefined,
    roles: buildRoleProposals(byRole),
  };
};
