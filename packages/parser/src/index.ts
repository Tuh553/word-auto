import { strFromU8, unzipSync } from "fflate";
import { ParseError, isParseError } from "./errors.js";
import { collectParagraphRunData, parseParagraphBookmarks, parseParagraphFields } from "./fields.js";
import { parseHeaderFooterPart } from "./headerFooter.js";
import {
  parseNumbering,
  extractParagraphNumbering,
} from "./numbering.js";
import {
  collectParagraphStructure,
  parseParaProps,
  parseRunProps,
  parseSectPr,
  parseXml,
} from "./ooxml.js";
import { computeEffective } from "./resolve.js";
import { parseStyles } from "./styles.js";
import { parseTheme, type ThemeFonts } from "./theme.js";
import type {
  DocDefaults,
  DocModel,
  HeaderFooterPart,
  NumberingDefinitions,
  Paragraph,
  Run,
  SectionProps,
  StyleDef,
} from "./types.js";

export * from "./types.js";
export * from "./errors.js";
export * from "./numbering.js";
export * as units from "./units.js";

const CFBF_MAGIC = Uint8Array.from([
  0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1,
]);
const ZIP_MAGIC_PREFIX = Uint8Array.from([0x50, 0x4b]);

const hasPrefix = (buf: Uint8Array, prefix: Uint8Array): boolean => {
  if (buf.length < prefix.length) return false;
  return prefix.every((byte, index) => buf[index] === byte);
};

const isZipSignature = (buf: Uint8Array): boolean => {
  if (!hasPrefix(buf, ZIP_MAGIC_PREFIX) || buf.length < 4) return false;
  const sig3 = buf[2];
  const sig4 = buf[3];
  return (
    (sig3 === 0x03 && sig4 === 0x04) ||
    (sig3 === 0x05 && sig4 === 0x06) ||
    (sig3 === 0x07 && sig4 === 0x08)
  );
};

const failParse = (code: ParseError["code"], message: string): never => {
  throw new ParseError(code, message);
};

const unzipDocx = (buf: Uint8Array): Record<string, Uint8Array> => {
  try {
    return unzipSync(buf);
  } catch (error) {
    if (!isZipSignature(buf)) {
      failParse("NOT_ZIP", "文件不是有效的 ZIP / OOXML 压缩包");
    }
    const detail = error instanceof Error ? error.message : String(error);
    failParse("CORRUPT", `ZIP 解压失败，文件可能已损坏：${detail}`);
  }
  throw new Error("unreachable");
};

const parseDocumentParts = (
  read: (path: string) => string | undefined,
  docXml: string,
): {
  theme: ThemeFonts;
  styles: Map<string, StyleDef>;
  docDefaults: DocDefaults;
  numbering: NumberingDefinitions;
  root: any;
} => {
  try {
    const theme = parseTheme(read("word/theme/theme1.xml") ?? "<a:theme/>");
    const { styles, docDefaults } = parseStyles(
      read("word/styles.xml") ?? "<w:styles/>",
      theme,
    );
    const numbering = parseNumbering(
      read("word/numbering.xml") ?? "<w:numbering/>",
    );
    const root = parseXml(docXml);
    return { theme, styles, docDefaults, numbering, root };
  } catch (error) {
    if (isParseError(error)) throw error;
    const detail = error instanceof Error ? error.message : String(error);
    failParse("CORRUPT", `文档 XML 解析失败，文件可能已损坏：${detail}`);
  }
  throw new Error("unreachable");
};

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
  if (hasPrefix(buf, CFBF_MAGIC)) {
    failParse("LEGACY_DOC", "检测到旧版 .doc 二进制文档（OLE 复合文档），当前仅支持 .docx");
  }

  const files = unzipDocx(buf);

  if (files.EncryptedPackage || files.EncryptionInfo) {
    failParse("ENCRYPTED", "检测到受密码保护的 Office 加密包，当前不支持解析");
  }

  const read = (p: string): string | undefined =>
    files[p] ? strFromU8(files[p]) : undefined;

  const docXml = read("word/document.xml");
  if (!docXml) {
    failParse("NOT_DOCX", "压缩包中缺少 word/document.xml，不是有效的 .docx");
  }
  const docXmlText = docXml!;

  const { theme, styles, docDefaults, numbering, root } = parseDocumentParts(read, docXmlText);

  if (!root["w:document"]?.["w:body"]) {
    failParse("NOT_DOCX", "word/document.xml 不是有效的 Word OOXML 文档结构");
  }

  const body = root["w:document"]?.["w:body"] ?? {};
  const wps: any[] = body["w:p"] ?? [];

  let nextIndex = 0;
  const buildParagraph = (wp: any, inTable: boolean): Paragraph => {
    const pPr = wp["w:pPr"];
    const directPara = parseParaProps(pPr);
    const markRun = parseRunProps(pPr?.["w:rPr"], theme);
    const { runs: runsRaw } = collectParagraphRunData(wp);
    const runs: Run[] = runsRaw.map((r) => ({
      text: extractText(r),
      props: parseRunProps(r["w:rPr"], theme),
    }));
    const text = runs.map((r) => r.text).join("");
    const bookmarks = parseParagraphBookmarks(wp);
    const fields = parseParagraphFields(wp);
    const structure = collectParagraphStructure(wp);
    const numRef = extractParagraphNumbering(pPr);

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
      bookmarks: bookmarks.length > 0 ? bookmarks : undefined,
      fields: fields.length > 0 ? fields : undefined,
      structure,
      effective: {},
      numbering: numRef,
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

  const readHeaderFooterParts = (
    kind: HeaderFooterPart["kind"],
  ): HeaderFooterPart[] => {
    const pattern = kind === "header"
      ? /^word\/header\d+\.xml$/
      : /^word\/footer\d+\.xml$/;
    const parts: HeaderFooterPart[] = [];
    for (const name of Object.keys(files)) {
      if (!pattern.test(name)) continue;
      try {
        parts.push(parseHeaderFooterPart(strFromU8(files[name]), name, kind));
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        failParse("CORRUPT", `${name} XML 解析失败，文件可能已损坏：${detail}`);
      }
    }
    return parts;
  };

  const headerParts = readHeaderFooterParts("header");
  const footerParts = readHeaderFooterParts("footer");
  // 兼容旧调用：保留 header*.xml / footer*.xml 的纯文本投影。
  const headers = headerParts
    .map((part) => part.text)
    .filter((text) => text.trim());
  const footers = footerParts
    .map((part) => part.text)
    .filter((text) => text.trim());

  return {
    paragraphs,
    styles,
    docDefaults,
    sections,
    headers,
    footers,
    headerParts,
    footerParts,
    numbering,
  };
};
