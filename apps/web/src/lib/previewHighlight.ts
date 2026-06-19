export interface PreviewHighlightTarget {
  issueKey?: string;
  paraIndex: number;
  text: string;
  affectedText?: string | null;
}

export interface TextRange {
  start: number;
  end: number;
}

export const normalizePreviewText = (text: string | null | undefined): string =>
  (text ?? "").replace(/\s+/g, "");

const getPreviewTextKey = (text: string): string =>
  normalizePreviewText(text).slice(0, 18);

export const findPreviewBlockTextIndex = (
  blockTexts: string[],
  targetText: string,
): number => {
  const key = getPreviewTextKey(targetText);
  if (key.length < 3) return -1;
  return blockTexts.findIndex((text) => normalizePreviewText(text).includes(key));
};

const buildNormalizedIndex = (text: string) => {
  const indexes: number[] = [];
  let normalized = "";
  for (let index = 0; index < text.length; index++) {
    const char = text[index] ?? "";
    if (/\s/.test(char)) continue;
    normalized += char;
    indexes.push(index);
  }
  return { indexes, normalized };
};

export const findNormalizedTextRange = (
  text: string,
  targetText: string | null | undefined,
): TextRange | null => {
  const needle = normalizePreviewText(targetText);
  if (!needle) return null;
  const { indexes, normalized } = buildNormalizedIndex(text);
  const normalizedStart = normalized.indexOf(needle);
  if (normalizedStart < 0) return null;
  const normalizedEnd = normalizedStart + needle.length - 1;
  const start = indexes[normalizedStart];
  const end = indexes[normalizedEnd];
  if (start == null || end == null) return null;
  return { start, end: end + 1 };
};
