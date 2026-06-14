import { buildCaptionReferenceGraph } from "./caption-links.js";
import type { ClassifiedParagraph, ValidationIssue } from "./types.js";

const CAPTION_BOOKMARK_EXPECTED = "已存在的图/表/公式题注书签";

export const checkCaptionReferenceValidity = (
  classified: ClassifiedParagraph[],
): ValidationIssue[] => {
  const graph = buildCaptionReferenceGraph(classified);
  const issues: ValidationIssue[] = [];

  for (const reference of graph.references) {
    if (!reference.bookmarkExists) {
      issues.push({
        type: "paragraph",
        paragraphIndex: reference.paragraphIndex,
        role: reference.role ?? "unknown",
        field: "caption_reference",
        expected: CAPTION_BOOKMARK_EXPECTED,
        actual: `${reference.bookmark}（不存在）`,
        severity: "error",
        message: `${reference.type} 引用的书签「${reference.bookmark}」不存在`,
        canAutoFix: false,
        fixHint:
          `请在 Word 中更新该 ${reference.type} 交叉引用，改为指向现有图/表/公式题注，或补回书签「${reference.bookmark}」后再更新域。`,
      });
      continue;
    }

    if (reference.targetCaption) continue;

    issues.push({
      type: "paragraph",
      paragraphIndex: reference.paragraphIndex,
      role: reference.role ?? "unknown",
      field: "caption_reference",
      expected: CAPTION_BOOKMARK_EXPECTED,
      actual: `${reference.bookmark}（存在但不是题注）`,
      severity: "warn",
      message:
        `${reference.type} 引用的书签「${reference.bookmark}」存在，但目标不是图/表/公式题注`,
      canAutoFix: false,
      fixHint:
        `请核对该 ${reference.type} 交叉引用是否应指向图/表/公式题注；若是，请在 Word 中重新插入对应题注交叉引用。`,
    });
  }

  return issues;
};
