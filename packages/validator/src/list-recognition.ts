// 列表识别：基于 numbering.xml 识别有序/无序列表

import type { Paragraph, NumberingDefinitions } from "@word-auto/parser";

/** 列表类型 */
export type ListType = "ordered" | "unordered" | "none";

/** 列表项信息 */
export interface ListItem {
  paragraphIndex: number;
  listType: ListType;
  level: number;
  numId: string;
}

/**
 * 识别段落是否为列表项
 */
export const recognizeList = (
  para: Paragraph,
  numbering: NumberingDefinitions,
): ListItem | null => {
  // 没有编号引用，不是列表
  if (!para.numbering) return null;

  const { numId, ilvl } = para.numbering;

  // 获取编号定义
  const numInstance = numbering.nums.get(numId);
  if (!numInstance) return null;

  const abstractNum = numbering.abstractNums.get(numInstance.abstractNumId);
  if (!abstractNum) return null;

  const level = abstractNum.levels.find((l) => l.ilvl === ilvl);
  if (!level) return null;

  // 判断有序/无序：根据 numFmt
  // bullet = 无序列表
  // decimal/upperRoman/lowerRoman/upperLetter/lowerLetter 等 = 有序列表
  const listType: ListType =
    level.numFmt === "bullet" ? "unordered" : "ordered";

  return {
    paragraphIndex: para.index,
    listType,
    level: ilvl,
    numId,
  };
};

/**
 * 识别文档中所有列表项
 */
export const recognizeAllLists = (
  paragraphs: Paragraph[],
  numbering: NumberingDefinitions,
): ListItem[] => {
  const lists: ListItem[] = [];

  for (const para of paragraphs) {
    const item = recognizeList(para, numbering);
    if (item) lists.push(item);
  }

  return lists;
};

/**
 * 分组连续的列表项
 */
export interface ListGroup {
  type: ListType;
  numId: string;
  items: ListItem[];
}

export const groupLists = (items: ListItem[]): ListGroup[] => {
  const groups: ListGroup[] = [];
  let current: ListGroup | null = null;

  for (const item of items) {
    // 如果 numId 或类型变化，开始新组
    if (
      !current ||
      current.numId !== item.numId ||
      current.type !== item.listType
    ) {
      current = {
        type: item.listType,
        numId: item.numId,
        items: [item],
      };
      groups.push(current);
    } else {
      // 连续的列表项
      current.items.push(item);
    }
  }

  return groups;
};
