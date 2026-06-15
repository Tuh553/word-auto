import { attr, collectNodeText, readTextNode, toArray } from "./ooxml.js";
import type { Bookmark, Field } from "./types.js";

const collectRuns = (node: unknown, out: any[] = []): any[] => {
  if (node == null || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    for (const item of node) collectRuns(item, out);
    return out;
  }

  for (const [key, value] of Object.entries(node)) {
    if (key === "w:r") {
      out.push(...toArray(value as any));
      continue;
    }
    collectRuns(value, out);
  }
  return out;
};

const collectBookmarkStarts = (node: unknown, out: Bookmark[] = []): Bookmark[] => {
  if (node == null || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    for (const item of node) collectBookmarkStarts(item, out);
    return out;
  }

  for (const [key, value] of Object.entries(node)) {
    if (key === "w:bookmarkStart") {
      for (const bookmarkStart of toArray(value as any)) {
        const name = attr(bookmarkStart, "w:name");
        if (!name) continue;
        out.push({
          id: attr(bookmarkStart, "w:id"),
          name,
        });
      }
      continue;
    }
    collectBookmarkStarts(value, out);
  }

  return out;
};

export interface SimpleFieldRunGroup {
  node: any;
  startRunIndex: number;
  runs: any[];
}

const normalizeInstruction = (instruction: string): string =>
  instruction.replace(/\s+/g, " ").trim();

const tokenizeInstruction = (instruction: string): string[] => {
  const matches = instruction.match(/"[^"]*"|'[^']*'|\S+/g) ?? [];
  return matches.map((token) => {
    if (
      (token.startsWith("\"") && token.endsWith("\"")) ||
      (token.startsWith("'") && token.endsWith("'"))
    ) {
      return token.slice(1, -1);
    }
    return token;
  });
};

const parseFieldDescriptor = (
  instruction: string,
): Pick<Field, "type" | "bookmark" | "sequence"> => {
  const tokens = tokenizeInstruction(instruction);
  const type = tokens[0]?.toUpperCase() ?? "UNKNOWN";
  if ((type === "REF" || type === "PAGEREF") && tokens[1]) {
    return { type, bookmark: tokens[1] };
  }
  if (type === "SEQ" && tokens[1]) {
    return { type, sequence: tokens[1] };
  }
  return { type };
};

type ActiveField = {
  startRunIndex: number;
  instructionParts: string[];
  displayParts: string[];
  hasSeparator: boolean;
};

const finalizeField = (
  active: ActiveField,
  endRunIndex: number,
): Field => {
  const instruction = normalizeInstruction(active.instructionParts.join(""));
  return {
    ...parseFieldDescriptor(instruction),
    instruction,
    displayText: active.displayParts.join(""),
    startRunIndex: active.startRunIndex,
    endRunIndex,
  };
};

const parseComplexFields = (runs: any[], runIndexOffset = 0): Field[] => {
  const fields: Field[] = [];
  const stack: ActiveField[] = [];

  runs.forEach((run, runIndex) => {
    const fldCharType = attr(run["w:fldChar"], "w:fldCharType");
    if (fldCharType === "begin") {
      stack.push({
        startRunIndex: runIndexOffset + runIndex,
        instructionParts: [],
        displayParts: [],
        hasSeparator: false,
      });
    }

    const instrText = readTextNode(run["w:instrText"]);
    if (instrText && stack.length > 0) {
      stack[stack.length - 1]!.instructionParts.push(instrText);
    }

    if (fldCharType === "separate" && stack.length > 0) {
      stack[stack.length - 1]!.hasSeparator = true;
    }

    const text = readTextNode(run["w:t"]);
    if (text) {
      for (const active of stack) {
        if (active.hasSeparator) active.displayParts.push(text);
      }
    }

    if (fldCharType === "end") {
      const active = stack.pop();
      if (active) fields.push(finalizeField(active, runIndexOffset + runIndex));
    }
  });

  return fields;
};

const parseSimpleFields = (groups: SimpleFieldRunGroup[]): Field[] =>
  groups.map(({ node, runs, startRunIndex }) => {
    const instruction = normalizeInstruction(attr(node, "w:instr") ?? "");
    const endRunIndex = startRunIndex + Math.max(runs.length - 1, 0);
    return {
      ...parseFieldDescriptor(instruction),
      instruction,
      displayText: collectNodeText(node, { skipInstrText: true }),
      startRunIndex,
      endRunIndex,
    };
  });

export const collectParagraphRunData = (
  wp: any,
): { runs: any[]; topLevelRunOffset: number; simpleFieldGroups: SimpleFieldRunGroup[] } => {
  const topLevelRuns = toArray(wp["w:r"]);
  const runs: any[] = [];
  const simpleFieldGroups: SimpleFieldRunGroup[] = [];
  let topLevelRunOffset = 0;
  let consumedTopLevelRuns = false;

  for (const [key, value] of Object.entries(wp as Record<string, unknown>)) {
    if (key === "w:r") {
      if (!consumedTopLevelRuns) {
        topLevelRunOffset = runs.length;
        runs.push(...topLevelRuns);
        consumedTopLevelRuns = true;
      }
      continue;
    }
    if (key !== "w:fldSimple") continue;
    for (const fldSimple of toArray(value as any)) {
      const simpleRuns = collectRuns(fldSimple);
      const startRunIndex = runs.length;
      runs.push(...simpleRuns);
      simpleFieldGroups.push({
        node: fldSimple,
        startRunIndex,
        runs: simpleRuns,
      });
    }
  }

  if (!consumedTopLevelRuns && topLevelRuns.length > 0) {
    topLevelRunOffset = runs.length;
    runs.push(...topLevelRuns);
  }

  return { runs, topLevelRunOffset, simpleFieldGroups };
};

export const parseParagraphFields = (wp: any): Field[] => {
  const topLevelRuns = toArray(wp["w:r"]);
  const { topLevelRunOffset, simpleFieldGroups } = collectParagraphRunData(wp);
  const complexFields = parseComplexFields(topLevelRuns, topLevelRunOffset);
  const simpleFields = parseSimpleFields(simpleFieldGroups);
  const fields = [...complexFields, ...simpleFields];
  return fields.length > 0
    ? fields.sort((a, b) => a.startRunIndex - b.startRunIndex || a.endRunIndex - b.endRunIndex)
    : [];
};

export const parseParagraphBookmarks = (wp: any): Bookmark[] => {
  const bookmarks = collectBookmarkStarts(wp);
  if (bookmarks.length === 0) return [];

  const seen = new Set<string>();
  return bookmarks.filter((bookmark) => {
    const key = `${bookmark.id ?? ""}:${bookmark.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};
