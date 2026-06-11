import { strFromU8, unzipSync } from "fflate";
import {
  attr,
  parseParaProps,
  parseRunProps,
  parseSectPr,
  parseXml,
} from "./ooxml.js";
import { computeEffective } from "./resolve.js";
import { parseStyles } from "./styles.js";
import { parseTheme } from "./theme.js";
import type { DocModel, Paragraph, Run, SectionProps } from "./types.js";

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

  let nextIndex = 0;
  const buildParagraph = (wp: any, inTable: boolean): Paragraph => {
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
      index: nextIndex++,
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
    if (inTable) para.inTable = true;
    para.effective = computeEffective(para, styles, docDefaults);
    return para;
  };

  // body 直接段落（保持原顺序与索引 0..N-1）
  const paragraphs: Paragraph[] = wps.map((wp) => buildParagraph(wp, false));

  // 表格内段落：递归 w:tbl > w:tr > w:tc > w:p，追加到末尾并标记 inTable。
  // 复用同一套构造逻辑，单元格段落同样解析样式继承/字体/有效格式。
  const collectTableParagraphs = (container: any): void => {
    for (const tbl of (container["w:tbl"] ?? []) as any[]) {
      for (const tr of (tbl["w:tr"] ?? []) as any[]) {
        for (const tc of (tr["w:tc"] ?? []) as any[]) {
          for (const cp of (tc["w:p"] ?? []) as any[]) {
            paragraphs.push(buildParagraph(cp, true));
          }
          collectTableParagraphs(tc); // 嵌套表格
        }
      }
    }
  };
  collectTableParagraphs(body);

  // 收集分节页面设置：各分节点在段落 pPr/sectPr，最后一节在 body 末尾 sectPr
  const sectPrs: any[] = [];
  for (const wp of wps) {
    const sp = wp["w:pPr"]?.["w:sectPr"];
    if (sp) sectPrs.push(sp);
  }
  if (body["w:sectPr"]) sectPrs.push(body["w:sectPr"]);
  const sections: SectionProps[] = sectPrs.map(parseSectPr);

  // 提取各页眉纯文本（header*.xml）
  const headers: string[] = [];
  for (const name of Object.keys(files)) {
    if (/^word\/header\d+\.xml$/.test(name)) {
      const xml = strFromU8(files[name]);
      const text = [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
        .map((m) => m[1])
        .join("");
      if (text.trim()) headers.push(text);
    }
  }

  return { paragraphs, styles, docDefaults, sections, headers };
};
