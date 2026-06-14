import { attr, parseXml } from "./ooxml.js";
import type {
  HeaderFooterAlignment,
  HeaderFooterParagraph,
  HeaderFooterPart,
  HeaderFooterSegment,
} from "./types.js";

type TextToken = {
  type: "text";
  text: string;
  kind: HeaderFooterSegment["kind"];
  instruction?: string;
};

type TabToken = {
  type: "tab";
};

type Token = TextToken | TabToken;

type ActiveField = {
  instruction: string;
  resultKind?: HeaderFooterSegment["kind"];
  inResult: boolean;
  sawResult: boolean;
};

const PAGE_FIELD_PATTERN = /\bPAGE\b/i;
const LONG_SPACE_PATTERN = /(\s{4,})/;

const toArray = <T>(value: T | T[] | undefined): T[] => {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
};

const readTextNode = (node: unknown): string => {
  if (node == null) return "";
  if (Array.isArray(node)) return node.map(readTextNode).join("");
  if (typeof node === "string") return node;
  if (typeof node === "object") {
    const text = (node as Record<string, unknown>)["#text"];
    return typeof text === "string" ? text : "";
  }
  return "";
};

const normalizeAlignment = (value: string | undefined): HeaderFooterAlignment => {
  switch (value) {
    case "center":
      return "center";
    case "right":
    case "end":
      return "right";
    default:
      return "left";
  }
};

const cleanZoneText = (text: string): string =>
  text.replace(/\s+/g, " ").trim();

const collectParagraphNodes = (node: unknown, out: any[] = []): any[] => {
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

const collectDisplayText = (node: unknown): string => {
  if (node == null || typeof node !== "object") return "";
  if (Array.isArray(node)) return node.map(collectDisplayText).join("");

  let text = "";
  for (const [key, value] of Object.entries(node)) {
    if (key === "w:t") {
      text += readTextNode(value);
      continue;
    }
    if (key === "w:instrText") continue;
    text += collectDisplayText(value);
  }
  return text;
};

const fieldKind = (instruction: string): HeaderFooterSegment["kind"] | undefined =>
  PAGE_FIELD_PATTERN.test(instruction) ? "pageNumber" : undefined;

const pushFieldlessText = (tokens: Token[], text: string): void => {
  if (!text) return;
  tokens.push({ type: "text", text, kind: "text" });
};

const tokenizeRuns = (runs: any[]): Token[] => {
  const tokens: Token[] = [];
  let activeField: ActiveField | undefined;

  for (const run of runs) {
    const fldCharType = attr(run["w:fldChar"], "w:fldCharType");
    if (fldCharType === "begin") {
      activeField = { instruction: "", inResult: false, sawResult: false };
    }

    const instrText = readTextNode(run["w:instrText"]);
    if (instrText && activeField) {
      activeField.instruction += instrText;
    }

    if (fldCharType === "separate" && activeField) {
      activeField.inResult = true;
      activeField.resultKind = fieldKind(activeField.instruction);
    }

    for (const fldSimple of toArray(run["w:fldSimple"])) {
      const instruction = attr(fldSimple, "w:instr") ?? "";
      const kind = fieldKind(instruction) ?? "text";
      const text = collectDisplayText(fldSimple);
      tokens.push({ type: "text", text, kind, instruction: instruction.trim() || undefined });
    }

    const text = readTextNode(run["w:t"]);
    if (text) {
      if (activeField?.inResult && activeField.resultKind) {
        tokens.push({
          type: "text",
          text,
          kind: activeField.resultKind,
          instruction: activeField.instruction.trim() || undefined,
        });
        activeField.sawResult = true;
      } else {
        pushFieldlessText(tokens, text);
      }
    }

    if (run["w:tab"] !== undefined) {
      tokens.push({ type: "tab" });
    }

    if (fldCharType === "end") {
      if (activeField?.resultKind && !activeField.sawResult) {
        tokens.push({
          type: "text",
          text: "",
          kind: activeField.resultKind,
          instruction: activeField.instruction.trim() || undefined,
        });
      }
      activeField = undefined;
    }
  }

  return tokens;
};

const splitByTabs = (
  tokens: Token[],
  tabCount: number,
): HeaderFooterSegment[] => {
  const segments: HeaderFooterSegment[] = [];
  let zone = 0;

  for (const token of tokens) {
    if (token.type === "tab") {
      zone += 1;
      continue;
    }

    const alignment: HeaderFooterAlignment =
      zone === 0 ? "left" : tabCount >= 2 && zone === 1 ? "center" : "right";
    segments.push({
      kind: token.kind,
      text: token.text,
      alignment,
      instruction: token.instruction,
    });
  }

  return segments;
};

const splitByLongSpaces = (tokens: TextToken[]): HeaderFooterSegment[] => {
  const segments: HeaderFooterSegment[] = [];
  let alignment: HeaderFooterAlignment = "left";

  for (const token of tokens) {
    const parts = token.text.split(LONG_SPACE_PATTERN);
    for (const part of parts) {
      if (!part) continue;
      segments.push({
        kind: token.kind,
        text: part,
        alignment,
        instruction: token.instruction,
      });
      if (LONG_SPACE_PATTERN.test(part)) {
        alignment = "right";
      }
    }
  }

  return segments;
};

const alignTokens = (
  tokens: Token[],
  paragraphAlignment: HeaderFooterAlignment,
): HeaderFooterSegment[] => {
  const tabCount = tokens.filter((token) => token.type === "tab").length;
  if (tabCount > 0) return splitByTabs(tokens, tabCount);

  const textTokens = tokens.filter((token): token is TextToken => token.type === "text");
  if (
    paragraphAlignment === "left" &&
    textTokens.some((token) => LONG_SPACE_PATTERN.test(token.text))
  ) {
    return splitByLongSpaces(textTokens);
  }

  return textTokens.map((token) => ({
    kind: token.kind,
    text: token.text,
    alignment: paragraphAlignment,
    instruction: token.instruction,
  }));
};

const joinAlignedText = (
  segments: HeaderFooterSegment[],
  alignment: HeaderFooterAlignment,
): string =>
  cleanZoneText(
    segments
      .filter((segment) => segment.alignment === alignment)
      .map((segment) => segment.text)
      .join(""),
  );

const parseHeaderFooterParagraph = (wp: any): HeaderFooterParagraph | undefined => {
  const alignment = normalizeAlignment(attr(wp["w:pPr"]?.["w:jc"], "w:val"));
  const tokens = tokenizeRuns(toArray(wp["w:r"]));
  const segments = alignTokens(tokens, alignment);
  const text = segments.map((segment) => segment.text).join("");
  const hasPageNumber = segments.some((segment) => segment.kind === "pageNumber");

  if (!text.trim() && !hasPageNumber) return undefined;

  return {
    text,
    leftText: joinAlignedText(segments, "left"),
    centerText: joinAlignedText(segments, "center"),
    rightText: joinAlignedText(segments, "right"),
    alignment,
    hasPageNumber,
    segments,
  };
};

const uniqueParagraphs = (paragraphs: HeaderFooterParagraph[]): HeaderFooterParagraph[] => {
  const seen = new Set<string>();
  const out: HeaderFooterParagraph[] = [];
  for (const paragraph of paragraphs) {
    const key = paragraph.segments
      .map((segment) => `${segment.kind}:${segment.alignment}:${segment.text}:${segment.instruction ?? ""}`)
      .join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(paragraph);
  }
  return out;
};

const joinPartText = (
  paragraphs: HeaderFooterParagraph[],
  field: keyof Pick<HeaderFooterParagraph, "text" | "leftText" | "centerText" | "rightText">,
): string =>
  cleanZoneText(paragraphs.map((paragraph) => paragraph[field]).filter(Boolean).join("\n"));

export const parseHeaderFooterPart = (
  xml: string,
  path: string,
  kind: HeaderFooterPart["kind"],
): HeaderFooterPart => {
  const root = parseXml(xml);
  const body = root["w:hdr"] ?? root["w:ftr"] ?? root;
  const paragraphs = uniqueParagraphs(
    collectParagraphNodes(body)
      .map(parseHeaderFooterParagraph)
      .filter((paragraph): paragraph is HeaderFooterParagraph => paragraph !== undefined),
  );

  return {
    kind,
    path,
    text: joinPartText(paragraphs, "text"),
    leftText: joinPartText(paragraphs, "leftText"),
    centerText: joinPartText(paragraphs, "centerText"),
    rightText: joinPartText(paragraphs, "rightText"),
    hasPageNumber: paragraphs.some((paragraph) => paragraph.hasPageNumber),
    paragraphs,
  };
};
