import { strFromU8, unzipSync } from "fflate";
import { attr, parseParaProps, parseRunProps, parseXml } from "./ooxml.js";
import { computeEffective } from "./resolve.js";
import { parseStyles } from "./styles.js";
import { parseTheme } from "./theme.js";
import type { DocModel, Paragraph, Run } from "./types.js";

export * from "./types.js";
export * as units from "./units.js";

/** 提取一个 run 内的文本（w:t 可能是字符串、带 xml:space 的对象，或数组） */
const extractText = (r: any): string => {
  const t = r["w:t"];
  if (t == null) return "";
  const one = (x: any): string =>
    typeof x === "string" ? x : (x?.["#text"] ?? "");
  return Array.isArray(t) ? t.map(one).join("") : one(t);
};

/** 解析 .docx 二进制为文档模型 */
export const parseDocx = (buf: Uint8Array): DocModel => {
  const files = unzipSync(buf);
  const read = (p: string): string | undefined =>
    files[p] ? strFromU8(files[p]) : undefined;

  const theme = parseTheme(read("word/theme/theme1.xml") ?? "<a:theme/>");
  const { styles, docDefaults } = parseStyles(
    read("word/styles.xml") ?? "<w:styles/>",
    theme,
  );

  const docXml = read("word/document.xml");
  if (!docXml) throw new Error("word/document.xml not found in docx");

  const root = parseXml(docXml);
  const body = root["w:document"]?.["w:body"] ?? {};
  const wps: any[] = body["w:p"] ?? [];

  const paragraphs: Paragraph[] = wps.map((wp, index) => {
    const pPr = wp["w:pPr"];
    const directPara = parseParaProps(pPr);
    const markRun = parseRunProps(pPr?.["w:rPr"], theme);
    const runsRaw: any[] = wp["w:r"] ?? [];
    const runs: Run[] = runsRaw.map((r) => ({
      text: extractText(r),
      props: parseRunProps(r["w:rPr"], theme),
    }));
    const text = runs.map((r) => r.text).join("");

    const para: Paragraph = {
      index,
      styleId: directPara.styleId,
      styleName: directPara.styleId
        ? styles.get(directPara.styleId)?.name
        : undefined,
      directPara,
      markRun,
      runs,
      text,
      effective: {},
    };
    para.effective = computeEffective(para, styles, docDefaults);
    return para;
  });

  return { paragraphs, styles, docDefaults };
};
