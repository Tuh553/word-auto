import { XMLParser } from "fast-xml-parser";
import { resolveThemeFont, type ThemeFonts } from "./theme.js";
import type {
  LineSpacing,
  ParagraphStructure,
  ParaProps,
  RunProps,
  SectionProps,
} from "./types.js";

const XML_ARRAY_TAGS = new Set(["w:p", "w:r", "w:style", "w:tbl", "w:tr", "w:tc"]);

// 保留命名空间前缀（w:、w14: 等并存），属性前缀统一为 @_，属性值不做类型推断（字体名等需保持字符串）。
const xmlParserOptions = {
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseAttributeValue: false,
  parseTagValue: false,
  trimValues: false,
  // 强制这些节点始终为数组，避免“单个 vs 多个”分支
  isArray: (name: string) => XML_ARRAY_TAGS.has(name),
};

const xmlParser = new XMLParser(xmlParserOptions);
const orderedXmlParser = new XMLParser({
  ...xmlParserOptions,
  preserveOrder: true,
});

export const parseXml = (text: string): any => xmlParser.parse(text);
export const parseXmlPreserveOrder = (text: string): any => orderedXmlParser.parse(text);

/** 读取元素属性 */
export const attr = (node: any, name: string): string | undefined => {
  if (node == null || typeof node !== "object") return undefined;
  const v = node[`@_${name}`];
  return v == null ? undefined : String(v);
};

export const toArray = <T>(value: T | T[] | undefined): T[] => {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
};

export const readTextNode = (node: unknown): string => {
  if (node == null) return "";
  if (Array.isArray(node)) return node.map(readTextNode).join("");
  if (typeof node === "string") return node;
  if (typeof node === "object") {
    const text = (node as Record<string, unknown>)["#text"];
    return typeof text === "string" ? text : "";
  }
  return "";
};

export const collectNodeText = (
  node: unknown,
  options?: { skipInstrText?: boolean },
): string => {
  if (node == null || typeof node !== "object") return "";
  if (Array.isArray(node)) return node.map((item) => collectNodeText(item, options)).join("");

  let text = "";
  for (const [key, value] of Object.entries(node)) {
    if (key === "w:t") {
      text += readTextNode(value);
      continue;
    }
    if (options?.skipInstrText && key === "w:instrText") continue;
    text += collectNodeText(value, options);
  }
  return text;
};

/** 递归收集节点下的所有 w:p 段落节点（含表格 / 嵌套容器内的段落）。 */
export const collectParagraphNodes = (node: unknown, out: any[] = []): any[] => {
  if (node == null || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    for (const item of node) collectParagraphNodes(item, out);
    return out;
  }

  for (const [key, value] of Object.entries(node)) {
    if (key === "w:p") {
      for (const paragraph of toArray(value as any)) {
        out.push(paragraph);
        collectParagraphNodes(paragraph, out);
      }
      continue;
    }
    collectParagraphNodes(value, out);
  }
  return out;
};

/** 布尔型开关元素（w:b / w:i 等）：存在即 true，除非显式 val 为 0/false/off */
const boolEl = (el: any): boolean => {
  if (el === undefined) return false;
  const v = attr(el, "w:val");
  if (v === undefined) return true;
  return !["0", "false", "off"].includes(v.toLowerCase());
};

const num = (v: string | undefined): number | undefined => {
  if (v === undefined) return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : n;
};

const makeLineSpacing = (line: number, rule: string): LineSpacing => {
  if (rule === "exact" || rule === "atLeast") {
    return { value: line / 20, rule, pt: line / 20 };
  }
  // 默认 auto：line 单位为 1/240 行 → 倍数
  return { value: line / 240, rule: "auto", multiple: line / 240 };
};

const emptyStructure = (): ParagraphStructure => ({
  drawingCount: 0,
  mathCount: 0,
  embeddedObjectCount: 0,
});

/** 递归收集段落内的结构信号，供 classify 做特殊正文元素识别。 */
export const collectParagraphStructure = (
  node: any,
  acc: ParagraphStructure = emptyStructure(),
): ParagraphStructure => {
  if (node == null || typeof node !== "object") return acc;
  if (Array.isArray(node)) {
    for (const item of node) collectParagraphStructure(item, acc);
    return acc;
  }

  for (const [key, value] of Object.entries(node)) {
    switch (key) {
      case "w:drawing":
        acc.drawingCount += Array.isArray(value) ? value.length : 1;
        break;
      case "m:oMath":
      case "m:oMathPara":
        acc.mathCount += Array.isArray(value) ? value.length : 1;
        break;
      case "w:object":
        acc.embeddedObjectCount += Array.isArray(value) ? value.length : 1;
        break;
      default:
        break;
    }
    collectParagraphStructure(value, acc);
  }

  return acc;
};

/**
 * OOXML 通用测量值 → twips。兼容整数(twips) 与带单位写法(pt/cm/mm/in/pc)。
 * 某些文档把 pgMar/ind 等写成 "85.05pt"/"3cm" 而非整数 twips。
 */
const measureToTwips = (v: string | undefined): number | undefined => {
  if (v === undefined) return undefined;
  const m = /^(-?[\d.]+)(pt|cm|mm|in|pc)?$/.exec(v.trim());
  if (!m) return undefined;
  const n = Number(m[1]);
  if (Number.isNaN(n)) return undefined;
  switch (m[2]) {
    case "pt":
      return n * 20;
    case "pc":
      return n * 240;
    case "in":
      return n * 1440;
    case "cm":
      return Math.round(n * (1440 / 2.54));
    case "mm":
      return Math.round(n * (144 / 2.54));
    default:
      return n; // 无单位 = twips
  }
};

const applyIndentProps = (props: ParaProps, ind: any): void => {
  const fl = measureToTwips(attr(ind, "w:firstLine"));
  const flc = num(attr(ind, "w:firstLineChars"));
  const hg = measureToTwips(attr(ind, "w:hanging"));
  const hgc = num(attr(ind, "w:hangingChars"));
  const lf = measureToTwips(attr(ind, "w:left") ?? attr(ind, "w:start"));
  const lfc = num(attr(ind, "w:leftChars") ?? attr(ind, "w:startChars"));

  if (fl !== undefined) props.firstLineIndentTwips = fl;
  if (flc !== undefined) props.firstLineIndentChars = flc / 100;
  if (hg !== undefined) props.hangingIndentTwips = hg;
  if (hgc !== undefined) props.hangingIndentChars = hgc / 100;
  if (lf !== undefined) props.leftIndentTwips = lf;
  if (lfc !== undefined) props.leftIndentChars = lfc / 100;
};

const parseLineSpacingValue = (
  spacing: any,
  rule: string,
): number | undefined =>
  rule === "auto"
    ? num(attr(spacing, "w:line"))
    : measureToTwips(attr(spacing, "w:line"));

const applySpacingProps = (props: ParaProps, spacing: any): void => {
  const rule = attr(spacing, "w:lineRule") ?? "auto";
  // auto 时 line 是 1/240 行（整数）；exact/atLeast 时是测量值（可带单位）
  const line = parseLineSpacingValue(spacing, rule);
  if (line !== undefined) props.lineSpacing = makeLineSpacing(line, rule);

  const before = measureToTwips(attr(spacing, "w:before"));
  const after = measureToTwips(attr(spacing, "w:after"));
  if (before !== undefined) props.spacingBeforePt = before / 20;
  if (after !== undefined) props.spacingAfterPt = after / 20;
};

const applyOutlineLevel = (props: ParaProps, outline: any): void => {
  const level = num(attr(outline, "w:val"));
  if (level !== undefined) props.outlineLevel = level;
};

/** 从 rPr 节点提取 run 级格式（theme 用于解析主题字体引用） */
export const parseRunProps = (rPr: any, theme?: ThemeFonts): RunProps => {
  const p: RunProps = {};
  if (!rPr || typeof rPr !== "object") return p;
  const fonts = rPr["w:rFonts"];
  if (fonts) {
    // 显式字体名优先；否则解析 *Theme 主题字体引用
    const ea =
      attr(fonts, "w:eastAsia") ??
      resolveThemeFont(attr(fonts, "w:eastAsiaTheme"), theme);
    const as =
      attr(fonts, "w:ascii") ??
      resolveThemeFont(attr(fonts, "w:asciiTheme"), theme);
    const ha =
      attr(fonts, "w:hAnsi") ??
      resolveThemeFont(attr(fonts, "w:hAnsiTheme"), theme);
    if (ea) p.fontEastAsia = ea;
    if (as) p.fontAscii = as;
    if (ha) p.fontHAnsi = ha;
  }
  const sz = num(attr(rPr["w:sz"], "w:val"));
  if (sz !== undefined) p.sizePt = sz / 2; // half-point → pt
  if ("w:b" in rPr) p.bold = boolEl(rPr["w:b"]);
  if ("w:i" in rPr) p.italic = boolEl(rPr["w:i"]);
  return p;
};

/** 从 pPr 节点提取段落级格式 */
export const parseParaProps = (pPr: any): ParaProps => {
  const p: ParaProps = {};
  if (!pPr || typeof pPr !== "object") return p;

  const styleId = attr(pPr["w:pStyle"], "w:val");
  if (styleId) p.styleId = styleId;

  const jc = attr(pPr["w:jc"], "w:val");
  if (jc) p.alignment = jc;

  const ind = pPr["w:ind"];
  if (ind) applyIndentProps(p, ind);

  const sp = pPr["w:spacing"];
  if (sp) applySpacingProps(p, sp);

  const ol = pPr["w:outlineLvl"];
  if (ol) applyOutlineLevel(p, ol);
  return p;
};

/** 从 sectPr 节点提取页面设置（页宽高、页边距、页眉页脚距、装订线），单位 twips */
export const parseSectPr = (sect: any): SectionProps => {
  const s: SectionProps = {};
  if (!sect || typeof sect !== "object") return s;

  const pgSz = sect["w:pgSz"];
  if (pgSz) {
    const w = measureToTwips(attr(pgSz, "w:w"));
    const h = measureToTwips(attr(pgSz, "w:h"));
    if (w !== undefined) s.pageWidthTwips = w;
    if (h !== undefined) s.pageHeightTwips = h;
  }

  const m = sect["w:pgMar"];
  if (m) {
    // key 限定为「值为 number 的字段」联合：用整个 keyof SectionProps 会把
    // 写入类型与 pageNumberFormat(string) 取交集而坍缩，导致 number 无法赋值。
    const map: [
      | "marginTopTwips"
      | "marginBottomTwips"
      | "marginLeftTwips"
      | "marginRightTwips"
      | "headerTwips"
      | "footerTwips"
      | "gutterTwips",
      string,
    ][] = [
      ["marginTopTwips", "w:top"],
      ["marginBottomTwips", "w:bottom"],
      ["marginLeftTwips", "w:left"],
      ["marginRightTwips", "w:right"],
      ["headerTwips", "w:header"],
      ["footerTwips", "w:footer"],
      ["gutterTwips", "w:gutter"],
    ];
    for (const [key, a] of map) {
      const v = measureToTwips(attr(m, a));
      if (v !== undefined) s[key] = v;
    }
  }

  const pn = sect["w:pgNumType"];
  if (pn) {
    const fmt = attr(pn, "w:fmt");
    const start = num(attr(pn, "w:start"));
    if (fmt) s.pageNumberFormat = fmt;
    if (start !== undefined) s.pageNumberStart = start;
  }
  return s;
};
