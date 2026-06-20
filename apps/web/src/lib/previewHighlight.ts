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

export interface PreviewIssueCandidate {
  issueKey: string;
  top: number;
  bottom: number;
}

export interface PreviewViewport {
  clientHeight: number;
  scrollTop: number;
}

export interface PreviewIssueNodeLike {
  dataset?: { issueKey?: string };
  parentElement?: PreviewIssueNodeLike | null;
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

const byTopThenBottom = (
  left: PreviewIssueCandidate,
  right: PreviewIssueCandidate,
): number => left.top - right.top || left.bottom - right.bottom;

export const findPreviewIssueKeyFromNode = (
  node: PreviewIssueNodeLike | null | undefined,
): string | null => {
  let current = node ?? null;
  while (current) {
    const issueKey = current.dataset?.issueKey;
    if (issueKey) return issueKey;
    current = current.parentElement ?? null;
  }
  return null;
};

export const pickPreviewIssueInViewport = (
  candidates: PreviewIssueCandidate[],
  viewport: PreviewViewport,
): string | null => {
  const viewportTop = viewport.scrollTop;
  const viewportBottom = viewport.scrollTop + viewport.clientHeight;
  const viewportCenter = viewport.scrollTop + viewport.clientHeight / 2;
  const visible = candidates
    .filter((candidate) =>
      candidate.bottom > viewportTop && candidate.top < viewportBottom
    )
    .sort(byTopThenBottom);
  if (visible.length === 0) return null;

  const centerHits = visible.filter((candidate) =>
    candidate.top <= viewportCenter && candidate.bottom >= viewportCenter
  );
  if (centerHits.length > 0) {
    return [...centerHits]
      .sort((left, right) =>
        Math.abs((left.top + left.bottom) / 2 - viewportCenter) -
          Math.abs((right.top + right.bottom) / 2 - viewportCenter) ||
        byTopThenBottom(left, right)
      )[0]?.issueKey ?? null;
  }

  return visible[0]?.issueKey ?? null;
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
