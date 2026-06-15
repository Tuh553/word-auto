// 编号连续性检测：标题题序、图表题注连号

import type { DocModel } from "@word-auto/parser";
import { buildCaptionReferenceGraph } from "./caption-links.js";
import type { ClassifiedParagraph, ValidationIssue } from "./types.js";

// 预编译正则表达式（模块级常量，避免重复创建）
const RE_CHINESE_CHAPTER = /^第?([一二三四五六七八九十]+)[章节条款]/;
const RE_ARABIC_CHAPTER = /^第?\s*(\d+)\s*[章节条款]/;
const RE_MULTI_LEVEL = /^(\d+(?:\.\d+)+)[.、\s]/;
const RE_SINGLE_LEVEL = /^(\d+)(?:[.、]\s*|\s+(?=\S))/;
const RE_PAREN = /^\((\d+)\)|^（(\d+)）/;
const RE_CAPTION = /^[图表]\s*(\d+)(?:[-.](\d+))?/;

type CaptionLabel = "图" | "表";
type CaptionKind = "figure" | "table";
type ClassifiedParagraphWithRole = ClassifiedParagraph & {
  role: NonNullable<ClassifiedParagraph["role"]>;
};
type CaptionSequenceState = {
  currentChapter: number | null;
  lastMajor: number;
  lastMinor: number;
};
type CaptionIssueInput = {
  actual: number | string;
  cp: ClassifiedParagraphWithRole;
  expected: number | string;
  fixHint: string;
  message: string;
  severity?: ValidationIssue["severity"];
};
type MultiLevelCaptionCheckInput = {
  captionLabel: CaptionLabel;
  cp: ClassifiedParagraphWithRole;
  major: number;
  minor: number;
  state: CaptionSequenceState;
};

/** 中文数字转阿拉伯数字 */
const chineseToNumber = (text: string): number | null => {
  const map: Record<string, number> = {
    一: 1, 二: 2, 三: 3, 四: 4, 五: 5,
    六: 6, 七: 7, 八: 8, 九: 9, 十: 10,
  };
  return map[text] ?? null;
};

/** 提取段落文本中的编号（支持多种格式） */
const extractNumber = (text: string): number | null => {
  // 匹配：1、1.、第1章、第1节、1.1、1.1.1、(1)、（1）等
  // 注意：标题编号优先级高于图表编号，避免"第一章"被误匹配为"图1"

  const trimmed = text.trim();

  // 先匹配中文章节
  const chineseMatch = trimmed.match(RE_CHINESE_CHAPTER);
  if (chineseMatch) {
    return chineseToNumber(chineseMatch[1]);
  }

  // 匹配阿拉伯数字章节
  const arabicChapterMatch = trimmed.match(RE_ARABIC_CHAPTER);
  if (arabicChapterMatch) {
    return Number(arabicChapterMatch[1]);
  }

  // 匹配多级编号（如 1.1、1.1.1），提取最后一级
  const multiLevelMatch = trimmed.match(RE_MULTI_LEVEL);
  if (multiLevelMatch) {
    const levels = multiLevelMatch[1].split('.');
    return Number(levels[levels.length - 1]);
  }

  // 匹配单级编号（如 1.、1、）
  const singleMatch = trimmed.match(RE_SINGLE_LEVEL);
  if (singleMatch) {
    return Number(singleMatch[1]);
  }

  // 匹配括号编号
  const parenMatch = trimmed.match(RE_PAREN);
  if (parenMatch) {
    return Number(parenMatch[1] || parenMatch[2]);
  }

  return null;
};

/** 提取题注编号（图/表题注的完整编号，如 "1-1" -> [1, 1]） */
const extractCaptionNumber = (text: string): number[] | null => {
  // 匹配：图1-1、表2.3、图3
  const match = text.trim().match(RE_CAPTION);
  if (!match) return null;

  const major = Number(match[1]);
  const minor = match[2] ? Number(match[2]) : undefined;
  return minor !== undefined ? [major, minor] : [major];
};

const pushCaptionIssue = (
  issues: ValidationIssue[],
  {
    actual,
    cp,
    expected,
    fixHint,
    message,
    severity = "error",
  }: CaptionIssueInput,
): void => {
  issues.push({
    type: "paragraph",
    paragraphIndex: cp.para.index,
    role: cp.role,
    field: "caption_sequence",
    severity,
    message,
    actual,
    expected,
    canAutoFix: false,
    fixHint,
  });
};

/** 检测标题题序连续性（各级标题独立递增，不跳号） */
export const checkHeadingSequence = (
  classified: ClassifiedParagraph[],
): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];

  // 按 outlineLevel 分组，跟踪每级的上一个编号
  const lastNumber = new Map<number, number>();

  for (const cp of classified) {
    const level = cp.para.effective.outlineLevel;
    if (level === undefined || level > 8) continue; // 非标题
    if (!cp.role) continue; // 跳过未分类段落
    // 支持通用 "heading" 或具体 "heading1/2/3" 角色
    if (!cp.role.startsWith("heading")) continue;

    const num = extractNumber(cp.para.text);
    if (num === null) continue; // 无法提取编号，跳过

    const expected = (lastNumber.get(level) ?? 0) + 1;
    if (num !== expected) {
      issues.push({
        type: "paragraph",
        paragraphIndex: cp.para.index,
        role: cp.role,
        field: "heading_sequence",
        severity: "error",
        message: `${level + 1} 级标题编号不连续：期望 ${expected}，实际 ${num}`,
        actual: num,
        expected,
        canAutoFix: false,
        fixHint: `手动调整标题编号为 ${expected}，或检查是否遗漏了中间的标题。`,
      });
    }

    lastNumber.set(level, num);

    // 下级标题重置：如果当前是 N 级标题，清空所有 > N 级的计数器
    for (let l = level + 1; l <= 8; l++) {
      lastNumber.delete(l);
    }
  }

  return issues;
};

const buildCaptionNumbers = (
  classified: ClassifiedParagraph[],
  kind: CaptionKind,
): Map<number, number[]> => {
  const graph = buildCaptionReferenceGraph(classified);
  return new Map(
    graph.captions
      .filter((caption) => caption.kind === kind && caption.numberParts.length > 0)
      .map((caption) => [caption.paragraphIndex, caption.numberParts] as const),
  );
};

const updateCaptionChapterState = (
  state: CaptionSequenceState,
  cp: ClassifiedParagraph,
): CaptionSequenceState => {
  if (!cp.role?.startsWith("heading") || cp.para.effective.outlineLevel !== 0) {
    return state;
  }

  const chapterNum = extractNumber(cp.para.text);
  if (chapterNum === null) {
    return state;
  }

  return {
    currentChapter: chapterNum,
    lastMajor: 0,
    lastMinor: 0,
  };
};

const checkSingleLevelCaption = (
  issues: ValidationIssue[],
  cp: ClassifiedParagraphWithRole,
  captionLabel: CaptionLabel,
  state: CaptionSequenceState,
  major: number,
): CaptionSequenceState => {
  const expected = state.lastMajor + 1;
  if (major !== expected) {
    pushCaptionIssue(issues, {
      cp,
      message: `${captionLabel}题注编号不连续：期望 ${expected}，实际 ${major}`,
      actual: major,
      expected,
      fixHint: `手动调整为"${captionLabel} ${expected}"，或检查是否遗漏${captionLabel}题注。`,
    });
  }

  return { ...state, lastMajor: major };
};

const checkMultiLevelCaption = (
  issues: ValidationIssue[],
  {
    captionLabel,
    cp,
    major,
    minor,
    state,
  }: MultiLevelCaptionCheckInput,
): CaptionSequenceState => {
  if (state.currentChapter !== null && major !== state.currentChapter) {
    pushCaptionIssue(issues, {
      cp,
      severity: "warn",
      message: `${captionLabel}题注章节编号与当前章节不符：期望 ${state.currentChapter}-*，实际 ${major}-${minor}`,
      actual: `${major}-${minor}`,
      expected: `${state.currentChapter}-*`,
      fixHint: `检查${captionLabel}题注是否应为"${captionLabel} ${state.currentChapter}-${minor}"。`,
    });
  }

  if (major === state.lastMajor) {
    const expectedMinor = state.lastMinor + 1;
    if (minor !== expectedMinor) {
      pushCaptionIssue(issues, {
        cp,
        message: `${captionLabel}题注次编号不连续：期望 ${major}-${expectedMinor}，实际 ${major}-${minor}`,
        actual: `${major}-${minor}`,
        expected: `${major}-${expectedMinor}`,
        fixHint: `手动调整为"${captionLabel} ${major}-${expectedMinor}"。`,
      });
    }
  } else if (minor !== 1) {
    pushCaptionIssue(issues, {
      cp,
      message: `${captionLabel}题注主编号变化后次编号应从 1 开始：实际 ${major}-${minor}`,
      actual: `${major}-${minor}`,
      expected: `${major}-1`,
      fixHint: `手动调整为"${captionLabel} ${major}-1"。`,
    });
  }

  return { ...state, lastMajor: major, lastMinor: minor };
};

/** 通用题注连号检测（图/表） */
const checkCaptionSequence = (
  classified: ClassifiedParagraph[],
  captionRole: "figure_caption" | "table_caption",
  captionLabel: CaptionLabel,
): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const kind: CaptionKind = captionRole === "figure_caption" ? "figure" : "table";
  const captionNumbers = buildCaptionNumbers(classified, kind);
  let state: CaptionSequenceState = {
    currentChapter: null,
    lastMajor: 0,
    lastMinor: 0,
  };

  for (const cp of classified) {
    if (!cp.role) continue; // 跳过未分类段落
    const withRole = cp as ClassifiedParagraphWithRole;
    state = updateCaptionChapterState(state, withRole);

    if (withRole.role !== captionRole) continue;

    const nums = captionNumbers.get(withRole.para.index)
      ?? extractCaptionNumber(withRole.para.text);
    if (!nums) continue;

    const [major, minor] = nums;

    if (minor === undefined) {
      state = checkSingleLevelCaption(issues, withRole, captionLabel, state, major);
      continue;
    }

    state = checkMultiLevelCaption(issues, {
      cp: withRole,
      captionLabel,
      state,
      major,
      minor,
    });
  }

  return issues;
};

/** 检测图题注连号（图 1 → 图 2 → 图 3） */
export const checkFigureCaptionSequence = (
  classified: ClassifiedParagraph[],
): ValidationIssue[] => checkCaptionSequence(classified, "figure_caption", "图");

/** 检测表题注连号（表 1 → 表 2 → 表 3） */
export const checkTableCaptionSequence = (
  classified: ClassifiedParagraph[],
): ValidationIssue[] => checkCaptionSequence(classified, "table_caption", "表");

/** 检测所有编号连续性（标题 + 图表题注） */
export const checkNumberingSequence = (
  model: DocModel,
  classified: ClassifiedParagraph[],
): ValidationIssue[] => {
  void model;
  return [
    ...checkHeadingSequence(classified),
    ...checkFigureCaptionSequence(classified),
    ...checkTableCaptionSequence(classified),
  ];
};
