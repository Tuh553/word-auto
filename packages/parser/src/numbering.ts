// numbering.xml 解析：自动编号定义与实例

import { attr, parseXml } from "./ooxml.js";
import type {
  AbstractNumbering,
  NumberingDefinitions,
  NumberingInstance,
  NumberingLevel,
  ParagraphNumbering,
} from "./types.js";

/** 编号格式 */
export type NumberFormat =
  | "decimal" // 1, 2, 3
  | "upperRoman" // I, II, III
  | "lowerRoman" // i, ii, iii
  | "upperLetter" // A, B, C
  | "lowerLetter" // a, b, c
  | "chineseCounting" // 一, 二, 三
  | "chineseCountingThousand" // 一千, 二千
  | "ideographDigital" // 一, 二, 三
  | "ideographTraditional" // 甲, 乙, 丙
  | "bullet" // •
  | "none"; // 无编号

const parseNumberFormat = (fmt: string | undefined): NumberFormat => {
  switch (fmt) {
    case "decimal":
      return "decimal";
    case "upperRoman":
      return "upperRoman";
    case "lowerRoman":
      return "lowerRoman";
    case "upperLetter":
      return "upperLetter";
    case "lowerLetter":
      return "lowerLetter";
    case "chineseCounting":
    case "chineseCountingThousand":
    case "ideographDigital":
    case "ideographTraditional":
      return fmt as NumberFormat;
    case "bullet":
      return "bullet";
    case "none":
      return "none";
    default:
      return "decimal";
  }
};

const parseLevel = (lvlNode: any): NumberingLevel | undefined => {
  const ilvl = attr(lvlNode, "w:ilvl");
  if (ilvl == null) return undefined;

  const startVal = attr(lvlNode["w:start"], "w:val") ?? "1";
  const numFmtVal = attr(lvlNode["w:numFmt"], "w:val");
  const lvlTextVal = attr(lvlNode["w:lvlText"], "w:val") ?? "%1";
  const lvlRestartVal = attr(lvlNode["w:lvlRestart"], "w:val");

  return {
    ilvl: Number(ilvl),
    start: Number(startVal),
    numFmt: parseNumberFormat(numFmtVal),
    lvlText: lvlTextVal,
    lvlRestart: lvlRestartVal ? Number(lvlRestartVal) : undefined,
  };
};

const parseAbstractNum = (node: any): AbstractNumbering | undefined => {
  const abstractNumId = attr(node, "w:abstractNumId");
  if (!abstractNumId) return undefined;

  const multiLevelTypeVal = attr(node["w:multiLevelType"], "w:val") as
    | "multilevel"
    | "singleLevel"
    | "hybridMultilevel"
    | undefined;

  const lvlNodes: any[] = Array.isArray(node["w:lvl"])
    ? node["w:lvl"]
    : node["w:lvl"]
      ? [node["w:lvl"]]
      : [];

  const levels: NumberingLevel[] = [];
  for (const lvl of lvlNodes) {
    const parsed = parseLevel(lvl);
    if (parsed) levels.push(parsed);
  }

  return {
    abstractNumId,
    multiLevelType: multiLevelTypeVal,
    levels,
  };
};

const parseNum = (node: any): NumberingInstance | undefined => {
  const numId = attr(node, "w:numId");
  const abstractNumId = attr(node["w:abstractNumId"], "w:val");
  if (!numId || !abstractNumId) return undefined;

  // 解析 lvlOverride（可选）
  const overrideNodes: any[] = Array.isArray(node["w:lvlOverride"])
    ? node["w:lvlOverride"]
    : node["w:lvlOverride"]
      ? [node["w:lvlOverride"]]
      : [];

  const lvlOverride = new Map<number, { start?: number }>();
  for (const ov of overrideNodes) {
    const ilvl = attr(ov, "w:ilvl");
    const startVal = attr(ov["w:startOverride"], "w:val");
    if (ilvl != null) {
      lvlOverride.set(Number(ilvl), {
        start: startVal ? Number(startVal) : undefined,
      });
    }
  }

  return {
    numId,
    abstractNumId,
    lvlOverride: lvlOverride.size > 0 ? lvlOverride : undefined,
  };
};

/**
 * 解析 numbering.xml
 */
export const parseNumbering = (xml: string): NumberingDefinitions => {
  const root = parseXml(xml);
  const numberingRoot = root["w:numbering"];
  if (!numberingRoot) {
    return { abstractNums: new Map(), nums: new Map() };
  }

  const abstractNums = new Map<string, AbstractNumbering>();
  const nums = new Map<string, NumberingInstance>();

  // 解析 abstractNum
  const abstractNumNodes: any[] = Array.isArray(
    numberingRoot["w:abstractNum"],
  )
    ? numberingRoot["w:abstractNum"]
    : numberingRoot["w:abstractNum"]
      ? [numberingRoot["w:abstractNum"]]
      : [];

  for (const node of abstractNumNodes) {
    const parsed = parseAbstractNum(node);
    if (parsed) abstractNums.set(parsed.abstractNumId, parsed);
  }

  // 解析 num
  const numNodes: any[] = Array.isArray(numberingRoot["w:num"])
    ? numberingRoot["w:num"]
    : numberingRoot["w:num"]
      ? [numberingRoot["w:num"]]
      : [];

  for (const node of numNodes) {
    const parsed = parseNum(node);
    if (parsed) nums.set(parsed.numId, parsed);
  }

  return { abstractNums, nums };
};

/**
 * 从段落 pPr 中提取编号引用（numPr）
 */
export const extractParagraphNumbering = (
  pPr: any,
): ParagraphNumbering | undefined => {
  if (!pPr || typeof pPr !== "object") return undefined;
  const numPr = pPr["w:numPr"];
  if (!numPr) return undefined;

  const numId = attr(numPr["w:numId"], "w:val");
  const ilvl = attr(numPr["w:ilvl"], "w:val");

  if (numId && ilvl !== undefined) {
    return { numId, ilvl: Number(ilvl) };
  }
  return undefined;
};

/**
 * 解析编号实例，获取某级别的有效定义（考虑 lvlOverride）
 */
export const resolveNumberingLevel = (
  defs: NumberingDefinitions,
  numId: string,
  ilvl: number,
): NumberingLevel | undefined => {
  const num = defs.nums.get(numId);
  if (!num) return undefined;

  const abstractNum = defs.abstractNums.get(num.abstractNumId);
  if (!abstractNum) return undefined;

  const level = abstractNum.levels.find((l) => l.ilvl === ilvl);
  if (!level) return undefined;

  // 应用 lvlOverride
  const override = num.lvlOverride?.get(ilvl);
  if (override?.start !== undefined) {
    return { ...level, start: override.start };
  }

  return level;
};
