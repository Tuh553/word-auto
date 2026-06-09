// OOXML 单位换算工具。
// Word 内部：twip = 1/20 pt = 1/1440 inch；字号用 half-point；缩进字符用 1/100 字符。

/** 1 cm = 1440 / 2.54 twips ≈ 566.93 */
export const TWIPS_PER_CM = 1440 / 2.54;

export const twipsToPt = (tw: number): number => tw / 20;
export const twipsToCm = (tw: number): number => tw / TWIPS_PER_CM;

/** 字号：half-point → pt */
export const halfPtToPt = (hp: number): number => hp / 2;

/** 缩进字符：OOXML 的 *Chars 属性单位是 1/100 字符 */
export const hundredthsToChars = (v: number): number => v / 100;

/** 由 twips 缩进 + 字号(pt) 反推“字符数”，用于和“N 字符”规则比对 */
export const indentTwipsToChars = (tw: number, fontPt: number): number =>
  fontPt > 0 ? twipsToPt(tw) / fontPt : 0;

/** 保留小数位，避免浮点噪声 */
export const round = (n: number, digits = 2): number => {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
};
