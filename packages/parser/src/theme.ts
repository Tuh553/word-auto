import { attr, parseXml } from "./ooxml.js";

/** 一个字体组（major/minor）解析出的关键字体 */
interface FontGroup {
  /** 拉丁字体（对应 ascii/hAnsi/bidi theme） */
  latin?: string;
  /** 东亚字体（a:ea 为空时回退到 script="Hans" 的简体中文字体） */
  eastAsia?: string;
}

export interface ThemeFonts {
  major: FontGroup;
  minor: FontGroup;
}

const parseGroup = (node: any): FontGroup => {
  if (!node) return {};
  const g: FontGroup = {};
  const latin = attr(node["a:latin"], "typeface");
  if (latin) g.latin = latin;

  let ea = attr(node["a:ea"], "typeface");
  if (!ea) {
    // a:ea 常为空，简体中文环境回退到 script="Hans" 的字体
    const fonts = node["a:font"];
    const arr = Array.isArray(fonts) ? fonts : fonts ? [fonts] : [];
    const hans = arr.find((f: any) => attr(f, "script") === "Hans");
    ea = attr(hans, "typeface");
  }
  if (ea) g.eastAsia = ea;
  return g;
};

/** 解析 theme1.xml 的字体方案 */
export const parseTheme = (themeXml: string): ThemeFonts => {
  const root = parseXml(themeXml);
  const fs =
    root["a:theme"]?.["a:themeElements"]?.["a:fontScheme"] ?? {};
  return {
    major: parseGroup(fs["a:majorFont"]),
    minor: parseGroup(fs["a:minorFont"]),
  };
};

/**
 * 把 rFonts 的主题引用（如 minorEastAsia / minorHAnsi）解析为实际字体名。
 * major* → 主标题字体组；其余 → 正文字体组。含 EastAsia → 东亚字体，否则拉丁字体。
 */
export const resolveThemeFont = (
  ref: string | undefined,
  theme: ThemeFonts | undefined,
): string | undefined => {
  if (!ref || !theme) return undefined;
  const group = /^major/i.test(ref) ? theme.major : theme.minor;
  return /eastasia/i.test(ref) ? group.eastAsia : group.latin;
};
