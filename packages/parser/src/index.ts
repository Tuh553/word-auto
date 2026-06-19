import { strFromU8, unzipSync } from "fflate";
import { collectBodyParagraphsInDocumentOrder } from "./documentFlow.js";
import { ParseError, isParseError } from "./errors.js";
import { collectParagraphRunData, parseParagraphBookmarks, parseParagraphFields } from "./fields.js";
import { parseHeaderFooterPart } from "./headerFooter.js";
import {
  buildNoteDefinitionLookup,
  parseNoteDefinitions,
  parseParagraphNotes,
} from "./notes.js";
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
  parseXmlPreserveOrder,
} from "./ooxml.js";
import { computeEffective, computeRunEffective } from "./resolve.js";
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
  defaultParagraphStyleId?: string;
  noteDefinitions: ReturnType<typeof parseNoteDefinitions>;
  numbering: NumberingDefinitions;
  root: any;
  orderedRoot: any;
} => {
  try {
    const theme = parseTheme(read("word/theme/theme1.xml") ?? "<a:theme/>");
    const { styles, docDefaults, defaultParagraphStyleId } = parseStyles(
      read("word/styles.xml") ?? "<w:styles/>",
      theme,
    );
    const numbering = parseNumbering(
      read("word/numbering.xml") ?? "<w:numbering/>",
    );
    const noteDefinitions = [
      ...parseNoteDefinitions(
        read("word/footnotes.xml") ?? "<w:footnotes/>",
        "footnote",
      ),
      ...parseNoteDefinitions(
        read("word/endnotes.xml") ?? "<w:endnotes/>",
        "endnote",
      ),
    ];
    const root = parseXml(docXml);
    const orderedRoot = parseXmlPreserveOrder(docXml);
    return {
      theme,
      styles,
      docDefaults,
      defaultParagraphStyleId,
      noteDefinitions,
      numbering,
      root,
      orderedRoot,
    };
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

const buildNoteLookups = (
  noteDefinitions: ReturnType<typeof parseNoteDefinitions>,
) => ({
  footnote: buildNoteDefinitionLookup(
    noteDefinitions.filter((item) => item.type === "footnote"),
  ),
  endnote: buildNoteDefinitionLookup(
    noteDefinitions.filter((item) => item.type === "endnote"),
  ),
});

type ParagraphBuildContext = {
  theme: ThemeFonts;
  styles: Map<string, StyleDef>;
  docDefaults: DocDefaults;
  defaultParagraphStyleId?: string;
  noteLookups: ReturnType<typeof buildNoteLookups>;
};

const createParagraphBuilder = ({
  theme,
  styles,
  docDefaults,
  defaultParagraphStyleId,
  noteLookups,
}: ParagraphBuildContext): ((wp: any, inTable: boolean) => Paragraph) => {
  let nextIndex = 0;

  return (wp: any, inTable: boolean): Paragraph => {
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
    const notes = parseParagraphNotes(runsRaw, noteLookups);
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
      notes: notes.length > 0 ? notes : undefined,
      structure,
      effective: {},
      numbering: numRef,
    };
    if (inTable) para.inTable = true;
    para.effective = computeEffective(
      para,
      styles,
      docDefaults,
      defaultParagraphStyleId,
    );
    const runEffective = computeRunEffective(
      para,
      styles,
      docDefaults,
      defaultParagraphStyleId,
    );
    para.runs = para.runs.map((run, index) => ({
      ...run,
      effective: runEffective[index],
    }));
    return para;
  };
};

const collectSections = (body: any, wps: any[]): SectionProps[] => {
  const sectPrs: any[] = [];
  for (const wp of wps) {
    const sectPr = wp["w:pPr"]?.["w:sectPr"];
    if (sectPr) sectPrs.push(sectPr);
  }
  if (body["w:sectPr"]) sectPrs.push(body["w:sectPr"]);
  return sectPrs.map(parseSectPr);
};

const readHeaderFooterParts = (
  files: Record<string, Uint8Array>,
  kind: HeaderFooterPart["kind"],
  context: Parameters<typeof parseHeaderFooterPart>[3],
): HeaderFooterPart[] => {
  const pattern = kind === "header"
    ? /^word\/header\d+\.xml$/
    : /^word\/footer\d+\.xml$/;
  const parts: HeaderFooterPart[] = [];
  for (const name of Object.keys(files)) {
    if (!pattern.test(name)) continue;
    try {
      parts.push(parseHeaderFooterPart(strFromU8(files[name]), name, kind, context));
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      failParse("CORRUPT", `${name} XML 解析失败，文件可能已损坏：${detail}`);
    }
  }
  return parts;
};

const projectHeaderFooterText = (parts: HeaderFooterPart[]): string[] =>
  parts
    .map((part) => part.text)
    .filter((text) => text.trim());

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

  const {
    theme,
    styles,
    docDefaults,
    defaultParagraphStyleId,
    noteDefinitions,
    numbering,
    root,
    orderedRoot,
  } = parseDocumentParts(
    read,
    docXmlText,
  );
  const noteLookups = buildNoteLookups(noteDefinitions);

  if (!root["w:document"]?.["w:body"]) {
    failParse("NOT_DOCX", "word/document.xml 不是有效的 Word OOXML 文档结构");
  }

  const body = root["w:document"]?.["w:body"] ?? {};
  const wps: any[] = body["w:p"] ?? [];
  const buildParagraph = createParagraphBuilder({
    theme,
    styles,
    docDefaults,
    defaultParagraphStyleId,
    noteLookups,
  });

  const paragraphs = collectBodyParagraphsInDocumentOrder(orderedRoot, buildParagraph);

  const sections = collectSections(body, wps);
  const headerFooterContext = {
    theme,
    styles,
    docDefaults,
    defaultParagraphStyleId,
  };
  const headerParts = readHeaderFooterParts(files, "header", headerFooterContext);
  const footerParts = readHeaderFooterParts(files, "footer", headerFooterContext);
  // 兼容旧调用：保留 header*.xml / footer*.xml 的纯文本投影。
  const headers = projectHeaderFooterText(headerParts);
  const footers = projectHeaderFooterText(footerParts);

  return {
    paragraphs,
    styles,
    docDefaults,
    sections,
    headers,
    footers,
    headerParts,
    footerParts,
    noteDefinitions,
    numbering,
  };
};
