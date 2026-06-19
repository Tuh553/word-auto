import type { Paragraph } from "./types.js";

type BuildParagraph = (wp: any, inTable: boolean) => Paragraph;

const ATTRIBUTES_KEY = ":@";
const TEXT_KEY = "#text";
const ARRAY_TAGS = new Set(["w:p", "w:r", "w:style", "w:tbl", "w:tr", "w:tc"]);

const asArray = (value: unknown): unknown[] => {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value != null && typeof value === "object" && !Array.isArray(value);

const elementTags = (node: unknown): string[] =>
  isRecord(node)
    ? Object.keys(node).filter((key) => key !== ATTRIBUTES_KEY && key !== TEXT_KEY)
    : [];

const elementChildren = (node: unknown, tag: string): unknown[] =>
  isRecord(node) && tag in node ? asArray(node[tag]) : [];

const firstElementChildren = (nodes: unknown, tag: string): unknown[] => {
  for (const node of asArray(nodes)) {
    const children = elementChildren(node, tag);
    if (children.length > 0 || (isRecord(node) && tag in node)) return children;
  }
  return [];
};

const elementsByTag = (nodes: unknown[], tag: string): unknown[] =>
  nodes.filter((node) => isRecord(node) && tag in node);

const hasElement = (node: unknown, tag: string): boolean =>
  isRecord(node) && tag in node;

const appendText = (target: Record<string, unknown>, text: unknown): void => {
  if (typeof text !== "string") return;
  target[TEXT_KEY] = `${target[TEXT_KEY] ?? ""}${text}`;
};

const assignChild = (
  target: Record<string, unknown>,
  tag: string,
  value: unknown,
): void => {
  if (ARRAY_TAGS.has(tag)) {
    const current = target[tag];
    target[tag] = Array.isArray(current) ? [...current, value] : [value];
    return;
  }

  const current = target[tag];
  if (current === undefined) {
    target[tag] = value;
  } else {
    target[tag] = Array.isArray(current) ? [...current, value] : [current, value];
  }
};

const orderedElementToObject = (node: unknown, tag: string): Record<string, unknown> => {
  const result: Record<string, unknown> = {};
  if (isRecord(node) && isRecord(node[ATTRIBUTES_KEY])) {
    Object.assign(result, node[ATTRIBUTES_KEY]);
  }

  for (const child of elementChildren(node, tag)) {
    if (isRecord(child) && TEXT_KEY in child) appendText(result, child[TEXT_KEY]);
    for (const childTag of elementTags(child)) {
      assignChild(result, childTag, orderedElementToObject(child, childTag));
    }
  }

  return result;
};

const collectTableParagraphs = (
  tableNode: unknown,
  paragraphs: Paragraph[],
  buildParagraph: BuildParagraph,
): void => {
  const tableChildren = elementChildren(tableNode, "w:tbl");
  for (const rowNode of elementsByTag(tableChildren, "w:tr")) {
    const rowChildren = elementChildren(rowNode, "w:tr");
    for (const cellNode of elementsByTag(rowChildren, "w:tc")) {
      collectCellParagraphs(cellNode, paragraphs, buildParagraph);
    }
  }
};

const collectCellParagraphs = (
  cellNode: unknown,
  paragraphs: Paragraph[],
  buildParagraph: BuildParagraph,
): void => {
  for (const child of elementChildren(cellNode, "w:tc")) {
    if (hasElement(child, "w:p")) {
      paragraphs.push(buildParagraph(orderedElementToObject(child, "w:p"), true));
      continue;
    }
    if (hasElement(child, "w:tbl")) {
      collectTableParagraphs(child, paragraphs, buildParagraph);
    }
  }
};

export const collectBodyParagraphsInDocumentOrder = (
  orderedRoot: unknown,
  buildParagraph: BuildParagraph,
): Paragraph[] => {
  const documentChildren = firstElementChildren(orderedRoot, "w:document");
  const bodyChildren = firstElementChildren(documentChildren, "w:body");
  const paragraphs: Paragraph[] = [];

  for (const child of bodyChildren) {
    if (hasElement(child, "w:p")) {
      paragraphs.push(buildParagraph(orderedElementToObject(child, "w:p"), false));
      continue;
    }
    if (hasElement(child, "w:tbl")) {
      collectTableParagraphs(child, paragraphs, buildParagraph);
    }
  }

  return paragraphs;
};
