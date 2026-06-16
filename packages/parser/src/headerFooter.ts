import { computeEffective, computeRunEffective } from "./resolve.js";
import { attr, collectNodeText, collectParagraphNodes, parseParaProps, parseRunProps, parseXml, readTextNode, toArray } from "./ooxml.js";
import type { ThemeFonts } from "./theme.js";
import type {
  DocDefaults,
  HeaderFooterBorder,
  HeaderFooterAlignment,
  HeaderFooterParagraph,
  HeaderFooterPart,
  HeaderFooterSegment,
  Paragraph,
  Run,
  RunProps,
  StyleDef,
} from "./types.js";

type TextToken = {
  type: "text";
  text: string;
  kind: HeaderFooterSegment["kind"];
  instruction?: string;
  effective?: RunProps;
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
  effective?: RunProps;
};

interface HeaderFooterParseContext {
  theme?: ThemeFonts;
  styles?: Map<string, StyleDef>;
  docDefaults?: DocDefaults;
  defaultParagraphStyleId?: string;
}

interface ParagraphFormatInfo {
  effective: Paragraph["effective"];
  runEffective: RunProps[];
}

const PAGE_FIELD_PATTERN = /\bPAGE\b/i;
const LONG_SPACE_PATTERN = /(\s{4,})/;

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

const fieldKind = (instruction: string): HeaderFooterSegment["kind"] | undefined =>
  PAGE_FIELD_PATTERN.test(instruction) ? "pageNumber" : undefined;

const pushFieldlessText = (
  tokens: Token[],
  text: string,
  effective?: RunProps,
): void => {
  if (!text) return;
  tokens.push({ type: "text", text, kind: "text", effective });
};

const startField = (
  activeField: ActiveField | undefined,
  fldCharType: string | undefined,
): ActiveField | undefined =>
  fldCharType === "begin"
    ? { instruction: "", inResult: false, sawResult: false }
    : activeField;

const appendInstructionText = (
  activeField: ActiveField | undefined,
  run: any,
): void => {
  const instrText = readTextNode(run["w:instrText"]);
  if (instrText && activeField) {
    activeField.instruction += instrText;
  }
};

const markFieldResult = (
  activeField: ActiveField | undefined,
  fldCharType: string | undefined,
  effective?: RunProps,
): void => {
  if (fldCharType !== "separate" || !activeField) return;
  activeField.inResult = true;
  activeField.resultKind = fieldKind(activeField.instruction);
  activeField.effective = effective;
};

const appendSimpleFieldTokens = (
  tokens: Token[],
  run: any,
  effective?: RunProps,
): void => {
  for (const fldSimple of toArray(run["w:fldSimple"])) {
    const instruction = attr(fldSimple, "w:instr") ?? "";
    const kind = fieldKind(instruction) ?? "text";
    const text = collectNodeText(fldSimple, { skipInstrText: true });
    tokens.push({
      type: "text",
      text,
      kind,
      instruction: instruction.trim() || undefined,
      effective,
    });
  }
};

const appendFieldResultToken = (
  tokens: Token[],
  activeField: ActiveField,
  text: string,
  effective?: RunProps,
): void => {
  tokens.push({
    type: "text",
    text,
    kind: activeField.resultKind!,
    instruction: activeField.instruction.trim() || undefined,
    effective,
  });
  activeField.sawResult = true;
};

const appendRunTextToken = (
  tokens: Token[],
  activeField: ActiveField | undefined,
  run: any,
  effective?: RunProps,
): void => {
  const text = readTextNode(run["w:t"]);
  if (!text) return;
  if (activeField?.inResult && activeField.resultKind) {
    appendFieldResultToken(tokens, activeField, text, effective);
    return;
  }
  pushFieldlessText(tokens, text, effective);
};

const endField = (
  tokens: Token[],
  activeField: ActiveField | undefined,
  fldCharType: string | undefined,
): ActiveField | undefined => {
  if (fldCharType !== "end") return activeField;
  if (activeField?.resultKind && !activeField.sawResult) {
    tokens.push({
      type: "text",
      text: "",
      kind: activeField.resultKind,
      instruction: activeField.instruction.trim() || undefined,
      effective: activeField.effective,
    });
  }
  return undefined;
};

const tokenizeRuns = (runs: any[], runEffective: RunProps[]): Token[] => {
  const tokens: Token[] = [];
  let activeField: ActiveField | undefined;

  for (const [index, run] of runs.entries()) {
    const effective = runEffective[index];
    const fldCharType = attr(run["w:fldChar"], "w:fldCharType");
    activeField = startField(activeField, fldCharType);
    appendInstructionText(activeField, run);
    markFieldResult(activeField, fldCharType, effective);
    appendSimpleFieldTokens(tokens, run, effective);
    appendRunTextToken(tokens, activeField, run, effective);

    if (run["w:tab"] !== undefined) {
      tokens.push({ type: "tab" });
    }

    activeField = endField(tokens, activeField, fldCharType);
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
      effective: token.effective,
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
        effective: token.effective,
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
    effective: token.effective,
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

const numAttr = (node: any, name: string): number | undefined => {
  const raw = attr(node, name);
  if (raw == null) return undefined;
  const value = Number(raw);
  return Number.isNaN(value) ? undefined : value;
};

const parseBottomBorder = (pPr: any): HeaderFooterBorder | undefined => {
  const bottom = pPr?.["w:pBdr"]?.["w:bottom"];
  if (!bottom) return undefined;
  return {
    style: attr(bottom, "w:val"),
    size: numAttr(bottom, "w:sz"),
    color: attr(bottom, "w:color"),
    space: numAttr(bottom, "w:space"),
  };
};

const extractRunText = (run: any): string =>
  readTextNode(run["w:t"]);

const emptyFormatInfo = (): ParagraphFormatInfo => ({
  effective: {},
  runEffective: [],
});

const resolveParagraphFormat = (
  wp: any,
  runsRaw: any[],
  context: HeaderFooterParseContext,
): ParagraphFormatInfo => {
  const styles = context.styles ?? new Map<string, StyleDef>();
  const docDefaults = context.docDefaults ?? {};
  const directPara = parseParaProps(wp["w:pPr"]);
  const markRun = parseRunProps(wp["w:pPr"]?.["w:rPr"], context.theme);
  const runs: Run[] = runsRaw.map((run) => ({
    text: extractRunText(run),
    props: parseRunProps(run["w:rPr"], context.theme),
  }));
  const paragraph: Paragraph = {
    index: -1,
    styleId: directPara.styleId,
    styleName: directPara.styleId
      ? styles.get(directPara.styleId)?.name
      : undefined,
    directPara,
    markRun,
    runs,
    text: runs.map((run) => run.text).join(""),
    structure: { drawingCount: 0, mathCount: 0, embeddedObjectCount: 0 },
    effective: {},
  };
  return {
    effective: computeEffective(
      paragraph,
      styles,
      docDefaults,
      context.defaultParagraphStyleId,
    ),
    runEffective: computeRunEffective(
      paragraph,
      styles,
      docDefaults,
      context.defaultParagraphStyleId,
    ),
  };
};

const parseHeaderFooterParagraph = (
  wp: any,
  context: HeaderFooterParseContext,
): HeaderFooterParagraph | undefined => {
  const alignment = normalizeAlignment(attr(wp["w:pPr"]?.["w:jc"], "w:val"));
  const runs = toArray(wp["w:r"]);
  const format = runs.length > 0
    ? resolveParagraphFormat(wp, runs, context)
    : emptyFormatInfo();
  const tokens = tokenizeRuns(runs, format.runEffective);
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
    effective: format.effective,
    bottomBorder: parseBottomBorder(wp["w:pPr"]),
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
  context: HeaderFooterParseContext = {},
): HeaderFooterPart => {
  const root = parseXml(xml);
  const body = root["w:hdr"] ?? root["w:ftr"] ?? root;
  const paragraphs = uniqueParagraphs(
    collectParagraphNodes(body)
      .map((paragraph) => parseHeaderFooterParagraph(paragraph, context))
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
