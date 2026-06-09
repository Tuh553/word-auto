import { attr, parseParaProps, parseRunProps, parseXml } from "./ooxml.js";
import type { DocDefaults, StyleDef } from "./types.js";

/** 解析 styles.xml → 样式表 + 文档默认值 */
export const parseStyles = (
  stylesXml: string,
): { styles: Map<string, StyleDef>; docDefaults: DocDefaults } => {
  const root = parseXml(stylesXml);
  const wStyles = root["w:styles"] ?? {};
  const styles = new Map<string, StyleDef>();

  const list: any[] = wStyles["w:style"] ?? [];
  for (const s of list) {
    const styleId = attr(s, "w:styleId");
    if (!styleId) continue;
    styles.set(styleId, {
      styleId,
      type: attr(s, "w:type"),
      name: attr(s["w:name"], "w:val"),
      basedOn: attr(s["w:basedOn"], "w:val"),
      para: parseParaProps(s["w:pPr"]),
      run: parseRunProps(s["w:rPr"]),
    });
  }

  const dd = wStyles["w:docDefaults"] ?? {};
  const docDefaults: DocDefaults = {
    run: parseRunProps(dd["w:rPrDefault"]?.["w:rPr"]),
    para: parseParaProps(dd["w:pPrDefault"]?.["w:pPr"]),
  };
  return { styles, docDefaults };
};
