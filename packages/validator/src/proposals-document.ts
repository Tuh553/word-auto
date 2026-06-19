import { units, type DocModel, type SectionProps } from "@word-auto/parser";
import { DOCUMENT_FIELD_LABELS } from "./rules.js";
import type {
  DocumentRuleKey,
  DocumentRuleProposal,
  DocumentRuleProposalField,
} from "./types.js";
import {
  type CandidateSample,
  summarizeSamples,
} from "./proposals-shared.js";

type DocumentFieldSpec = {
  key: DocumentRuleKey;
  label: string;
  unit: "cm" | "enum";
  read: (section: SectionProps) => string | number | undefined;
};

const cmFromTwips = (value?: number): number | undefined =>
  value == null ? undefined : units.round(units.twipsToCm(value), 2);

const isApprox = (left: number, right: number, tolerance: number): boolean =>
  Math.abs(left - right) <= tolerance;

const detectPaperSize = (section: SectionProps): string | undefined => {
  const width = cmFromTwips(section.pageWidthTwips);
  const height = cmFromTwips(section.pageHeightTwips);
  if (width == null || height == null) return undefined;
  return isApprox(width, 21, 0.1) && isApprox(height, 29.7, 0.1) ? "A4" : undefined;
};

const DOCUMENT_FIELD_SPECS: DocumentFieldSpec[] = [
  {
    key: "paper_size",
    label: DOCUMENT_FIELD_LABELS.paper_size,
    unit: "enum",
    read: detectPaperSize,
  },
  {
    key: "margin_top_cm",
    label: DOCUMENT_FIELD_LABELS.margin_top_cm,
    unit: "cm",
    read: (section) => cmFromTwips(section.marginTopTwips),
  },
  {
    key: "margin_bottom_cm",
    label: DOCUMENT_FIELD_LABELS.margin_bottom_cm,
    unit: "cm",
    read: (section) => cmFromTwips(section.marginBottomTwips),
  },
  {
    key: "margin_left_cm",
    label: DOCUMENT_FIELD_LABELS.margin_left_cm,
    unit: "cm",
    read: (section) => cmFromTwips(section.marginLeftTwips),
  },
  {
    key: "margin_right_cm",
    label: DOCUMENT_FIELD_LABELS.margin_right_cm,
    unit: "cm",
    read: (section) => cmFromTwips(section.marginRightTwips),
  },
  {
    key: "header_distance_cm",
    label: DOCUMENT_FIELD_LABELS.header_distance_cm,
    unit: "cm",
    read: (section) => cmFromTwips(section.headerTwips),
  },
  {
    key: "footer_distance_cm",
    label: DOCUMENT_FIELD_LABELS.footer_distance_cm,
    unit: "cm",
    read: (section) => cmFromTwips(section.footerTwips),
  },
  {
    key: "gutter_cm",
    label: DOCUMENT_FIELD_LABELS.gutter_cm,
    unit: "cm",
    read: (section) => cmFromTwips(section.gutterTwips),
  },
];

const extractDocumentFieldProposal = (
  sections: SectionProps[],
  spec: DocumentFieldSpec,
): DocumentRuleProposalField | null => {
  const samples: CandidateSample[] = sections.flatMap((section, index) => {
    const value = spec.read(section);
    return value == null
      ? []
      : [{
          value,
          preview: `分节 ${index + 1}`,
          sampleIndex: index + 1,
          text: `分节 ${index + 1}`,
        }];
  });
  const summary = summarizeSamples(samples, sections.length);
  if (!summary) return null;

  return {
    key: spec.key,
    label: spec.label,
    unit: spec.unit,
    proposedValue: summary.primaryValue as string | number,
    confidence: summary.confidence,
    confidenceLevel: summary.confidenceLevel,
    confidenceHint: summary.confidenceHint,
    sampleCount: summary.sampleCount,
    coverage: summary.coverage,
    observedCount: summary.observedCount,
    totalCount: summary.totalCount,
    evidence: [
      `页面设置共 ${summary.totalCount} 个分节，其中 ${summary.observedCount} 个分节检测到该字段，${summary.sampleCount} 个分节命中主值`,
      ...summary.evidence,
    ],
    evidenceSamples: summary.evidenceSamples,
    conflicts: summary.conflicts.length > 0
      ? summary.conflicts.map((item) => ({
          value: item.value as string | number,
          sampleCount: item.sampleCount,
          evidence: item.evidence,
          evidenceSamples: item.evidenceSamples,
        }))
      : undefined,
  };
};

export const extractDocumentProposal = (model: DocModel): DocumentRuleProposal | null => {
  if (model.sections.length === 0) return null;
  const fields = DOCUMENT_FIELD_SPECS
    .map((spec) => extractDocumentFieldProposal(model.sections, spec))
    .filter((item): item is DocumentRuleProposalField => item != null);
  if (fields.length === 0) return null;
  return {
    key: "document",
    label: "文档设置",
    totalCount: model.sections.length,
    fields,
  };
};
