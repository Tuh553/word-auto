import { test } from "node:test";
import assert from "node:assert/strict";
import type { DocModel, NoteDefinition, NoteReference, Paragraph } from "@word-auto/parser";
import { checkNoteConsistency } from "./notes-check.js";
import { validateDoc } from "./validate.js";
import type { ClassifiedParagraph, RuleLibrary } from "./types.js";

const mkParagraph = (
  text: string,
  opts: {
    index: number;
    notes?: NoteReference[];
  },
): Paragraph => ({
  index: opts.index,
  styleId: undefined,
  styleName: undefined,
  directPara: {},
  markRun: {},
  runs: [{ text, props: {} }],
  text,
  notes: opts.notes,
  structure: { drawingCount: 0, mathCount: 0, embeddedObjectCount: 0 },
  effective: {},
});

const mkModel = (
  paragraphs: Paragraph[],
  noteDefinitions: NoteDefinition[] = [],
): DocModel => ({
  paragraphs,
  styles: new Map(),
  docDefaults: {},
  sections: [],
  headers: [],
  footers: [],
  headerParts: [],
  footerParts: [],
  noteDefinitions,
  numbering: {
    abstractNums: new Map(),
    nums: new Map(),
  },
});

const mkClassified = (
  para: Paragraph,
  role: ClassifiedParagraph["role"],
): ClassifiedParagraph => ({
  para,
  role,
});

const EMPTY_RULES: RuleLibrary = {
  styles: {},
};

test("checkNoteConsistency：定位缺失定义的脚注引用与未引用定义", () => {
  const paragraphs = [
    mkParagraph("正文一", {
      index: 0,
      notes: [{
        id: "2",
        type: "footnote",
        runIndex: 1,
        content: "已存在脚注",
        hasDefinition: true,
      }],
    }),
    mkParagraph("正文二", {
      index: 1,
      notes: [{
        id: "99",
        type: "endnote",
        runIndex: 3,
        hasDefinition: false,
      }],
    }),
  ];
  const model = mkModel(paragraphs, [
    { id: "2", type: "footnote", content: "已存在脚注" },
    { id: "7", type: "endnote", content: "孤立尾注" },
  ]);

  const issues = checkNoteConsistency(model, [
    mkClassified(paragraphs[0]!, "body_text"),
    mkClassified(paragraphs[1]!, "body_text"),
  ]);

  assert.deepEqual(
    issues.map((issue) => ({
      type: issue.type,
      paragraphIndex: issue.paragraphIndex,
      field: issue.field,
      severity: issue.severity,
      actual: issue.actual,
      message: issue.message,
    })),
    [
      {
        type: "paragraph",
        paragraphIndex: 1,
        field: "note_reference",
        severity: "error",
        actual: "尾注#99（缺失）",
        message: "尾注引用「99」缺少对应定义",
      },
      {
        type: "document",
        paragraphIndex: undefined,
        field: "note_definition",
        severity: "info",
        actual: "1 条未引用（7）",
        message: "检测到 1 条尾注定义未被正文引用",
      },
    ],
  );
});

test("validateDoc：透传注释基础校验 issue 与修复建议", () => {
  const model = mkModel([
    mkParagraph("正文含失效脚注", {
      index: 0,
      notes: [{
        id: "99",
        type: "footnote",
        runIndex: 1,
        hasDefinition: false,
      }],
    }),
  ]);

  const report = validateDoc(model, EMPTY_RULES);

  assert.deepEqual(
    report.issues.map((issue) => ({
      paraIndex: issue.paraIndex,
      role: issue.role,
      field: issue.field,
      severity: issue.severity,
      actual: issue.actual,
      fixability: issue.fixability,
      suggestion: issue.suggestion,
    })),
    [
      {
        paraIndex: 0,
        role: "unknown",
        field: "note_reference",
        severity: "error",
        actual: "脚注#99（缺失）",
        fixability: "manual",
        suggestion: "请在 Word 中检查该脚注/尾注引用，补回对应定义或删除失效引用后再更新注释编号",
      },
    ],
  );
  assert.deepEqual(report.summary, {
    error: 1,
    warn: 0,
    info: 0,
    byRole: {
      unknown: 1,
    },
  });
});
