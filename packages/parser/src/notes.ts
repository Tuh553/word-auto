import { attr, collectNodeText, collectParagraphNodes, parseXml, toArray } from "./ooxml.js";
import type { NoteDefinition, NoteReference, NoteType } from "./types.js";

const isRegularNote = (node: any): boolean => {
  const type = attr(node, "w:type");
  return type == null || type === "";
};

const rootTagFor = (type: NoteType): string =>
  type === "footnote" ? "w:footnotes" : "w:endnotes";

const itemTagFor = (type: NoteType): string =>
  type === "footnote" ? "w:footnote" : "w:endnote";

export const parseNoteDefinitions = (
  xmlText: string,
  type: NoteType,
): NoteDefinition[] => {
  const root = parseXml(xmlText);
  const part = root[rootTagFor(type)] ?? {};
  const items = toArray(part[itemTagFor(type)] as any);

  const definitions: NoteDefinition[] = [];
  for (const item of items) {
    const id = attr(item, "w:id");
    if (!id || !isRegularNote(item)) continue;

    const paragraphs = collectParagraphNodes(item)
      .map((paragraph) => collectNodeText(paragraph).trim())
      .filter(Boolean);

    definitions.push({
      id,
      type,
      content: paragraphs.join("\n"),
    });
  }
  return definitions;
};

export const buildNoteDefinitionLookup = (
  definitions: NoteDefinition[],
): Map<string, NoteDefinition> =>
  new Map(definitions.map((definition) => [definition.id, definition]));

export const parseParagraphNotes = (
  runs: any[],
  lookups: Record<NoteType, Map<string, NoteDefinition>>,
): NoteReference[] => {
  const references: NoteReference[] = [];

  runs.forEach((run, runIndex) => {
    for (const ref of toArray(run["w:footnoteReference"] as any)) {
      const id = attr(ref, "w:id");
      if (!id) continue;
      const definition = lookups.footnote.get(id);
      references.push({
        id,
        type: "footnote",
        runIndex,
        hasDefinition: definition != null,
      });
    }

    for (const ref of toArray(run["w:endnoteReference"] as any)) {
      const id = attr(ref, "w:id");
      if (!id) continue;
      const definition = lookups.endnote.get(id);
      references.push({
        id,
        type: "endnote",
        runIndex,
        hasDefinition: definition != null,
      });
    }
  });

  return references;
};
