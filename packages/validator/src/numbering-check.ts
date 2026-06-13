// 编号连续性检测：标题题序、图表题注连号

import type { DocModel } from "@word-auto/parser";
import type { ClassifiedParagraph, ValidationIssue } from "./types.js";

// 预编译正则表达式（模块级常量，避免重复创建）
const RE_CHINESE_CHAPTER = /^第?([一二三四五六七八九十]+)[章节条款]/;
const RE_ARABIC_CHAPTER = /^第?\s*(\d+)\s*[章节条款]/;
const RE_MULTI_LEVEL = /^(\d+(?:\.\d+)+)[.、\s]/;
const RE_SINGLE_LEVEL = /^(\d+)[.、]\s*/;
const RE_PAREN = /^\((\d+)\)|^（(\d+)）/;
const RE_CAPTION = /^[图表]\s*(\d+)(?:[-.](\d+))?/;

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

/** 通用题注连号检测（图/表） */
const checkCaptionSequence = (
  classified: ClassifiedParagraph[],
  captionRole: "figure_caption" | "table_caption",
  captionLabel: "图" | "表",
): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  let lastMajor = 0;
  let lastMinor = 0;
  let currentChapter: number | null = null;

  for (const cp of classified) {
    if (!cp.role) continue; // 跳过未分类段落
    // 跟踪章节变化（一级标题）
    if (cp.role === "heading" && cp.para.effective.outlineLevel === 0) {
      const chapterNum = extractNumber(cp.para.text);
      if (chapterNum !== null) {
        currentChapter = chapterNum;
        lastMinor = 0; // 新章节，次编号重置
        lastMajor = 0; // 新章节，主编号也重置
      }
    }

    if (cp.role !== captionRole) continue;

    const nums = extractCaptionNumber(cp.para.text);
    if (!nums) continue;

    const [major, minor] = nums;

    // 单级编号（图1、图2）
    if (minor === undefined) {
      const expected = lastMajor + 1;
      if (major !== expected) {
        issues.push({
          type: "paragraph",
          paragraphIndex: cp.para.index,
          role: cp.role,
          field: "caption_sequence",
          severity: "error",
          message: `${captionLabel}题注编号不连续：期望 ${expected}，实际 ${major}`,
          actual: major,
          expected,
          canAutoFix: false,
          fixHint: `手动调整为"${captionLabel} ${expected}"，或检查是否遗漏${captionLabel}题注。`,
        });
      }
      lastMajor = major;
    }
    // 两级编号（图1-1、图1-2）
    else {
      // 主编号应与当前章节一致（如果有章节跟踪）
      if (currentChapter !== null && major !== currentChapter) {
        issues.push({
          type: "paragraph",
          paragraphIndex: cp.para.index,
          role: cp.role,
          field: "caption_sequence",
          severity: "warn",
          message: `${captionLabel}题注章节编号与当前章节不符：期望 ${currentChapter}-*，实际 ${major}-${minor}`,
          actual: `${major}-${minor}`,
          expected: `${currentChapter}-*`,
          canAutoFix: false,
          fixHint: `检查${captionLabel}题注是否应为"${captionLabel} ${currentChapter}-${minor}"。`,
        });
      }

      // 检测次编号连续性
      if (major === lastMajor) {
        const expectedMinor = lastMinor + 1;
        if (minor !== expectedMinor) {
          issues.push({
            type: "paragraph",
            paragraphIndex: cp.para.index,
            role: cp.role,
            field: "caption_sequence",
            severity: "error",
            message: `${captionLabel}题注次编号不连续：期望 ${major}-${expectedMinor}，实际 ${major}-${minor}`,
            actual: `${major}-${minor}`,
            expected: `${major}-${expectedMinor}`,
            canAutoFix: false,
            fixHint: `手动调整为"${captionLabel} ${major}-${expectedMinor}"。`,
          });
        }
      } else {
        // 主编号变化，次编号应从 1 开始
        if (minor !== 1) {
          issues.push({
            type: "paragraph",
            paragraphIndex: cp.para.index,
            role: cp.role,
            field: "caption_sequence",
            severity: "error",
            message: `${captionLabel}题注主编号变化后次编号应从 1 开始：实际 ${major}-${minor}`,
            actual: `${major}-${minor}`,
            expected: `${major}-1`,
            canAutoFix: false,
            fixHint: `手动调整为"${captionLabel} ${major}-1"。`,
          });
        }
      }

      lastMajor = major;
      lastMinor = minor;
    }
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
  return [
    ...checkHeadingSequence(classified),
    ...checkFigureCaptionSequence(classified),
    ...checkTableCaptionSequence(classified),
  ];
};
