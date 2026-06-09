import { indentTwipsToChars, round, twipsToPt } from "./units.js";
import type {
  DocDefaults,
  EffectiveProps,
  ParaProps,
  Paragraph,
  RunProps,
  StyleDef,
} from "./types.js";

/** 后者已定义的字段覆盖前者 */
const merge = <T extends object>(base: T, over?: T): T => {
  const out: any = { ...base };
  if (over) {
    for (const k of Object.keys(over) as (keyof T)[]) {
      if (over[k] !== undefined) out[k] = over[k];
    }
  }
  return out;
};

/** 沿 basedOn 链收集样式，祖先在前、自身在后依序合并（防循环） */
const resolveStyleChain = (
  styleId: string | undefined,
  styles: Map<string, StyleDef>,
): { para: ParaProps; run: RunProps } => {
  const chain: StyleDef[] = [];
  const seen = new Set<string>();
  let cur = styleId;
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    const s = styles.get(cur);
    if (!s) break;
    chain.unshift(s);
    cur = s.basedOn;
  }
  let para: ParaProps = {};
  let run: RunProps = {};
  for (const s of chain) {
    para = merge(para, s.para);
    run = merge(run, s.run);
  }
  return { para, run };
};

/** 段落主导 run：第一个含文本的 run；否则退回段落标记 run */
const dominantRun = (para: Paragraph): RunProps => {
  const r = para.runs.find((x) => x.text.trim().length > 0);
  return r?.props ?? para.markRun ?? {};
};

/**
 * 计算继承后的有效格式。
 * 优先级（低→高）：docDefaults → basedOn 样式链 → 段落/run 直接格式。
 */
export const computeEffective = (
  para: Paragraph,
  styles: Map<string, StyleDef>,
  docDefaults: DocDefaults,
): EffectiveProps => {
  const chain = resolveStyleChain(para.styleId, styles);

  const ep = merge(merge(docDefaults.para ?? {}, chain.para), para.directPara);
  const er = merge(
    merge(docDefaults.run ?? {}, chain.run),
    dominantRun(para),
  );

  const sizePt = er.sizePt;
  const eff: EffectiveProps = {
    fontEastAsia: er.fontEastAsia,
    fontAscii: er.fontAscii,
    sizePt,
    bold: er.bold,
    alignment: ep.alignment,
    lineSpacing: ep.lineSpacing,
    spacingBeforePt: ep.spacingBeforePt,
    spacingAfterPt: ep.spacingAfterPt,
    outlineLevel: ep.outlineLevel,
  };

  // 首行缩进：优先用 *Chars；否则由 twips + 有效字号反推字符数
  if (ep.firstLineIndentChars !== undefined) {
    eff.firstLineIndentChars = round(ep.firstLineIndentChars);
  } else if (ep.firstLineIndentTwips !== undefined && sizePt) {
    eff.firstLineIndentChars = round(
      indentTwipsToChars(ep.firstLineIndentTwips, sizePt),
    );
  }
  if (ep.firstLineIndentTwips !== undefined) {
    eff.firstLineIndentPt = round(twipsToPt(ep.firstLineIndentTwips));
  }

  if (ep.hangingIndentChars !== undefined) {
    eff.hangingIndentChars = round(ep.hangingIndentChars);
  } else if (ep.hangingIndentTwips !== undefined && sizePt) {
    eff.hangingIndentChars = round(
      indentTwipsToChars(ep.hangingIndentTwips, sizePt),
    );
  }

  if (ep.leftIndentChars !== undefined) {
    eff.leftIndentChars = round(ep.leftIndentChars);
  } else if (ep.leftIndentTwips !== undefined && sizePt) {
    eff.leftIndentChars = round(indentTwipsToChars(ep.leftIndentTwips, sizePt));
  }

  return eff;
};
