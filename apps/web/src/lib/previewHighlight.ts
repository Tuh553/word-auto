import type { PreviewParagraphIssue } from "./reportGroups.js";

export interface PreviewBlockLookupTarget {
  text: string;
  previousText?: string | null;
  nextText?: string | null;
  occurrenceIndex?: number;
}

export interface PreviewHighlightTarget {
  text: string;
  previousText?: string | null;
  nextText?: string | null;
  occurrenceIndex?: number;
  issueKey?: string;
  paraIndex: number;
  affectedText?: string | null;
  paragraphIssues?: PreviewParagraphIssue[];
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
  dataset?: { issueKey?: string; paragraphIssueKeys?: string };
  parentElement?: PreviewIssueNodeLike | null;
}

export interface FragmentMatchCandidate {
  issueKey: string;
  range: TextRange;
  severity: "error" | "warn" | "info";
}

const SEVERITY_ORDER = {
  error: 0,
  warn: 1,
  info: 2,
} as const;

export const normalizePreviewText = (text: string | null | undefined): string =>
  (text ?? "").replace(/\s+/g, "");

const getPreviewTextKey = (text: string): string =>
  normalizePreviewText(text).slice(0, 18);

export const getPreviewNeighborText = (
  paragraphs: Array<{ text: string }>,
  paraIndex: number,
  step: -1 | 1,
): string | null => {
  for (
    let current = paraIndex + step;
    current >= 0 && current < paragraphs.length;
    current += step
  ) {
    const text = paragraphs[current]?.text?.trim();
    if (text) return paragraphs[current]?.text ?? null;
  }
  return null;
};

export const getPreviewOccurrenceIndex = (
  paragraphs: Array<{ text: string }>,
  paraIndex: number,
  text: string,
): number => {
  let occurrenceIndex = 0;
  for (let index = 0; index < paraIndex; index++) {
    if ((paragraphs[index]?.text ?? "") === text) occurrenceIndex++;
  }
  return occurrenceIndex;
};

const getNormalizedNeighborText = (
  blockTexts: string[],
  index: number,
  step: -1 | 1,
): string => {
  for (let current = index + step; current >= 0 && current < blockTexts.length; current += step) {
    const normalized = normalizePreviewText(blockTexts[current]);
    if (normalized) return normalized;
  }
  return "";
};

const scorePreviewBlockCandidate = (
  blockTexts: string[],
  index: number,
  target: PreviewBlockLookupTarget,
): number => {
  let score = 0;
  const previousText = normalizePreviewText(target.previousText);
  const nextText = normalizePreviewText(target.nextText);
  if (previousText && getNormalizedNeighborText(blockTexts, index, -1) === previousText) {
    score += 2;
  }
  if (nextText && getNormalizedNeighborText(blockTexts, index, 1) === nextText) {
    score += 2;
  }
  return score;
};

export const findPreviewBlockTextIndex = (
  blockTexts: string[],
  target: PreviewBlockLookupTarget | string,
): number => {
  const targetInfo = typeof target === "string" ? { text: target } : target;
  const normalizedTarget = normalizePreviewText(targetInfo.text);
  const key = getPreviewTextKey(targetInfo.text);
  if (key.length < 3 || !normalizedTarget) return -1;

  const exactMatches = blockTexts.flatMap((text, index) =>
    normalizePreviewText(text) === normalizedTarget ? [index] : [],
  );
  const candidates = exactMatches.length > 0
    ? exactMatches
    : blockTexts.flatMap((text, index) =>
      normalizePreviewText(text).includes(key) ? [index] : [],
    );
  if (candidates.length === 0) return -1;
  if (candidates.length === 1) return candidates[0] ?? -1;

  const targetOccurrenceIndex = targetInfo.occurrenceIndex ?? 0;
  return candidates
    .map((index, occurrenceIndex) => ({
      contextScore: scorePreviewBlockCandidate(blockTexts, index, targetInfo),
      index,
      occurrenceIndex,
    }))
    .sort((left, right) =>
      right.contextScore - left.contextScore ||
      Math.abs(left.occurrenceIndex - targetOccurrenceIndex) -
        Math.abs(right.occurrenceIndex - targetOccurrenceIndex) ||
      left.index - right.index
    )[0]?.index ?? -1;
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

export const findPreviewParagraphIssueKeysFromNode = (
  node: PreviewIssueNodeLike | null | undefined,
): string[] => {
  let current = node ?? null;
  while (current) {
    const issueKeys = current.dataset?.paragraphIssueKeys;
    if (issueKeys) return issueKeys.split("|").filter(Boolean);
    current = current.parentElement ?? null;
  }
  return [];
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

const collectNormalizedTextRanges = (
  text: string,
  targetText: string | null | undefined,
): TextRange[] => {
  const needle = normalizePreviewText(targetText);
  if (!needle) return [];
  const { indexes, normalized } = buildNormalizedIndex(text);
  if (!normalized.includes(needle)) return [];
  const ranges: TextRange[] = [];
  let searchStart = 0;
  while (searchStart < normalized.length) {
    const normalizedStart = normalized.indexOf(needle, searchStart);
    if (normalizedStart < 0) break;
    const normalizedEnd = normalizedStart + needle.length - 1;
    const start = indexes[normalizedStart];
    const end = indexes[normalizedEnd];
    if (start != null && end != null) {
      ranges.push({ end: end + 1, start });
    }
    searchStart = normalizedStart + needle.length;
  }
  return ranges;
};

export const findNormalizedTextRange = (
  text: string,
  targetText: string | null | undefined,
): TextRange | null => {
  return collectNormalizedTextRanges(text, targetText)[0] ?? null;
};

export const findFragmentMatchCandidates = (
  text: string,
  issues: PreviewParagraphIssue[],
): FragmentMatchCandidate[] =>
  issues.flatMap((issue) =>
    collectNormalizedTextRanges(text, issue.affectedText).map((range) => ({
      issueKey: issue.issueKey,
      range,
      severity: issue.severity,
    }))
  );

export const findBestFragmentMatch = (
  text: string,
  target: PreviewHighlightTarget | null,
): FragmentMatchCandidate | null => {
  if (!target?.affectedText || !target.issueKey) return null;
  const paragraphIssues = target.paragraphIssues ?? [];
  const allMatches = findFragmentMatchCandidates(text, paragraphIssues);
  const targetMatches = allMatches.filter((match) => match.issueKey === target.issueKey);
  if (targetMatches.length !== 1) return null;
  return targetMatches[0] ?? null;
};

export const pickParagraphIssueKey = (
  paragraphIssueKeys: string[],
  target: PreviewHighlightTarget | null,
): string | null => {
  if (paragraphIssueKeys.length === 0) return null;
  if (!target?.paragraphIssues?.length) return paragraphIssueKeys[0] ?? null;
  const issueOrder = new Map(
    target.paragraphIssues.map((issue, index) => [issue.issueKey, index] as const),
  );
  return [...paragraphIssueKeys]
    .sort((left, right) => {
      const leftIssue = target.paragraphIssues?.find((issue) => issue.issueKey === left);
      const rightIssue = target.paragraphIssues?.find((issue) => issue.issueKey === right);
      const severityOrder =
        (leftIssue ? SEVERITY_ORDER[leftIssue.severity] : Number.MAX_SAFE_INTEGER) -
        (rightIssue ? SEVERITY_ORDER[rightIssue.severity] : Number.MAX_SAFE_INTEGER);
      if (severityOrder !== 0) return severityOrder;
      return (
        (issueOrder.get(left) ?? Number.MAX_SAFE_INTEGER) -
        (issueOrder.get(right) ?? Number.MAX_SAFE_INTEGER)
      );
    })[0] ?? null;
};
