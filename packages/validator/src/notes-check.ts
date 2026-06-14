import type { DocModel, NoteType } from "@word-auto/parser";
import type { ClassifiedParagraph, Role, ValidationIssue } from "./types.js";

const TYPE_LABELS: Record<NoteType, string> = {
  footnote: "脚注",
  endnote: "尾注",
};

const summarizeIds = (ids: string[]): string =>
  ids.slice(0, 5).join(", ") + (ids.length > 5 ? " ..." : "");

export const checkNoteConsistency = (
  model: DocModel,
  classified: ClassifiedParagraph[],
): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const definitions = model.noteDefinitions ?? [];
  const referencedIdsByType: Record<NoteType, Set<string>> = {
    footnote: new Set<string>(),
    endnote: new Set<string>(),
  };

  classified.forEach(({ para, role }, paragraphIndex) => {
    for (const note of para.notes ?? []) {
      referencedIdsByType[note.type].add(note.id);
      if (note.hasDefinition) continue;

      issues.push({
        type: "paragraph",
        paragraphIndex,
        role: (role ?? "unknown") as Role,
        field: "note_reference",
        expected: `存在对应${TYPE_LABELS[note.type]}定义`,
        actual: `${TYPE_LABELS[note.type]}#${note.id}（缺失）`,
        severity: "error",
        message: `${TYPE_LABELS[note.type]}引用「${note.id}」缺少对应定义`,
        textPreview: para.text.slice(0, 24),
        canAutoFix: false,
      });
    }
  });

  for (const type of ["footnote", "endnote"] as const) {
    const orphanDefinitions = definitions
      .filter((definition) => definition.type === type)
      .filter((definition) => !referencedIdsByType[type].has(definition.id));
    if (orphanDefinitions.length === 0) continue;

    issues.push({
      type: "document",
      role: "document",
      field: "note_definition",
      expected: `全部${TYPE_LABELS[type]}定义均被正文引用`,
      actual: `${orphanDefinitions.length} 条未引用（${summarizeIds(orphanDefinitions.map((item) => item.id))}）`,
      severity: "info",
      message: `检测到 ${orphanDefinitions.length} 条${TYPE_LABELS[type]}定义未被正文引用`,
      textPreview: TYPE_LABELS[type],
      canAutoFix: false,
    });
  }

  return issues;
};
