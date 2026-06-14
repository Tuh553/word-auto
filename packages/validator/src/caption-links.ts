import type { Field } from "@word-auto/parser";
import type {
  CaptionKind,
  CaptionReference,
  CaptionReferenceGraph,
  CaptionTarget,
  ClassifiedParagraph,
  Role,
} from "./types.js";

const normalizeSequenceName = (sequence: string | undefined): CaptionKind | null => {
  const value = sequence?.trim().toLowerCase();
  if (!value) return null;
  if (value === "figure" || value === "fig") return "figure";
  if (value === "table" || value === "tbl") return "table";
  if (value === "equation" || value === "eq") return "equation";
  return null;
};

const roleForCaptionKind = (kind: CaptionKind): Role =>
  kind === "figure" ? "figure_caption" : kind === "table" ? "table_caption" : "formula_line";

const matchesCaptionRole = (kind: CaptionKind, role: Role | null): role is Role =>
  role === roleForCaptionKind(kind);

const parseCaptionNumber = (displayText: string): number[] | null => {
  const normalized = displayText.trim().replace(/^[（(]\s*|\s*[)）]$/g, "").replace(/[－—．]/g, "-");
  if (!normalized) return null;
  const parts = normalized.split(/[-.]/).filter(Boolean);
  if (parts.length === 0 || parts.some((part) => !/^\d+$/.test(part))) return null;
  return parts.map(Number);
};

const findCaptionField = (
  fields: Field[] | undefined,
  kind: CaptionKind,
): { field: Field; fieldIndex: number } | null => {
  if (!fields) return null;
  for (let fieldIndex = 0; fieldIndex < fields.length; fieldIndex += 1) {
    const field = fields[fieldIndex]!;
    if (field.type !== "SEQ") continue;
    if (normalizeSequenceName(field.sequence) !== kind) continue;
    return { field, fieldIndex };
  }
  return null;
};

const collectBookmarks = (classified: ClassifiedParagraph[]): Set<string> => {
  const out = new Set<string>();
  for (const { para } of classified) {
    for (const bookmark of para.bookmarks ?? []) {
      out.add(bookmark.name);
    }
  }
  return out;
};

export const buildCaptionReferenceGraph = (
  classified: ClassifiedParagraph[],
): CaptionReferenceGraph => {
  const captions: CaptionTarget[] = [];
  const captionsByBookmark = new Map<string, CaptionTarget>();
  const bookmarks = collectBookmarks(classified);

  for (const { para, role } of classified) {
    for (const kind of ["figure", "table", "equation"] as const) {
      if (!matchesCaptionRole(kind, role)) continue;
      const match = findCaptionField(para.fields, kind);
      if (!match) continue;

      const bookmarkNames = [...new Set((para.bookmarks ?? []).map((bookmark) => bookmark.name))];
      const caption: CaptionTarget = {
        kind,
        role,
        paragraphIndex: para.index,
        fieldIndex: match.fieldIndex,
        sequenceName: match.field.sequence ?? kind,
        numberText: match.field.displayText.trim(),
        numberParts: parseCaptionNumber(match.field.displayText) ?? [],
        bookmarkNames,
        field: match.field,
      };
      captions.push(caption);
      for (const bookmarkName of bookmarkNames) {
        if (!captionsByBookmark.has(bookmarkName)) {
          captionsByBookmark.set(bookmarkName, caption);
        }
      }
    }
  }

  const references: CaptionReference[] = [];
  for (const { para, role } of classified) {
    for (let fieldIndex = 0; fieldIndex < (para.fields?.length ?? 0); fieldIndex += 1) {
      const field = para.fields?.[fieldIndex];
      if (!field) continue;
      if ((field.type !== "REF" && field.type !== "PAGEREF") || !field.bookmark) continue;

      references.push({
        type: field.type,
        paragraphIndex: para.index,
        role,
        fieldIndex,
        bookmark: field.bookmark,
        displayText: field.displayText,
        bookmarkExists: bookmarks.has(field.bookmark),
        targetCaption: captionsByBookmark.get(field.bookmark),
        field,
      });
    }
  }

  return {
    captions,
    references,
    bookmarks,
    captionsByBookmark,
  };
};
