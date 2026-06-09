import { XMLParser } from "fast-xml-parser";
import { resolveThemeFont, type ThemeFonts } from "./theme.js";
import type {
  LineSpacing,
  ParaProps,
  RunProps,
  SectionProps,
} from "./types.js";

// 保留命名空间前缀（w:、w14: 等并存），属性前缀统一为 @_，属性值不做类型推断（字体名等需保持字符串）。
export const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseAttributeValue: false,
  parseTagValue: false,
  // 强制这些节点始终为数组，避免“单个 vs 多个”分支
  isArray: (name) =>
    ["w:p", "w:r", "w:style", "w:tbl", "w:tr", "w:tc"].includes(name),
});

export const parseXml = (text: string): any => xmlParser.parse(text);

/** 读取元素属性 */
export const attr = (node: any, name: string): string | undefined => {
  if (node == null || typeof node !== "object") return undefined;
  const v = node[`@_${name}`];
  return v == null ? undefined : String(v);
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
  if (ind) {
    const fl = num(attr(ind, "w:firstLine"));
    const flc = num(attr(ind, "w:firstLineChars"));
    const hg = num(attr(ind, "w:hanging"));
    const hgc = num(attr(ind, "w:hangingChars"));
    const lf = num(attr(ind, "w:left") ?? attr(ind, "w:start"));
    const lfc = num(attr(ind, "w:leftChars") ?? attr(ind, "w:startChars"));
    if (fl !== undefined) p.firstLineIndentTwips = fl;
    if (flc !== undefined) p.firstLineIndentChars = flc / 100;
    if (hg !== undefined) p.hangingIndentTwips = hg;
    if (hgc !== undefined) p.hangingIndentChars = hgc / 100;
    if (lf !== undefined) p.leftIndentTwips = lf;
    if (lfc !== undefined) p.leftIndentChars = lfc / 100;
  }

  const sp = pPr["w:spacing"];
  if (sp) {
    const line = num(attr(sp, "w:line"));
    const rule = attr(sp, "w:lineRule") ?? "auto";
    if (line !== undefined) p.lineSpacing = makeLineSpacing(line, rule);
    const before = num(attr(sp, "w:before"));
    const after = num(attr(sp, "w:after"));
    if (before !== undefined) p.spacingBeforePt = before / 20;
    if (after !== undefined) p.spacingAfterPt = after / 20;
  }

  const ol = pPr["w:outlineLvl"];
  if (ol) {
    const lvl = num(attr(ol, "w:val"));
    if (lvl !== undefined) p.outlineLevel = lvl;
  }
  return p;
};

/** 从 sectPr 节点提取页面设置（页宽高、页边距、页眉页脚距、装订线），单位 twips */
export const parseSectPr = (sect: any): SectionProps => {
  const s: SectionProps = {};
  if (!sect || typeof sect !== "object") return s;

  const pgSz = sect["w:pgSz"];
  if (pgSz) {
    const w = num(attr(pgSz, "w:w"));
    const h = num(attr(pgSz, "w:h"));
    if (w !== undefined) s.pageWidthTwips = w;
    if (h !== undefined) s.pageHeightTwips = h;
  }

  const m = sect["w:pgMar"];
  if (m) {
    const map: [keyof SectionProps, string][] = [
      ["marginTopTwips", "w:top"],
      ["marginBottomTwips", "w:bottom"],
      ["marginLeftTwips", "w:left"],
      ["marginRightTwips", "w:right"],
      ["headerTwips", "w:header"],
      ["footerTwips", "w:footer"],
      ["gutterTwips", "w:gutter"],
    ];
    for (const [key, a] of map) {
      const v = num(attr(m, a));
      if (v !== undefined) s[key] = v;
    }
  }
  return s;
};
