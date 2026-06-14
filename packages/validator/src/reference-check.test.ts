import { test } from "node:test";
import assert from "node:assert/strict";
import type { Bookmark, DocModel, Field, Paragraph } from "@word-auto/parser";
import { checkCaptionReferenceValidity } from "./reference-check.js";
import { validateDoc } from "./validate.js";
import type { ClassifiedParagraph, Role, RuleLibrary } from "./types.js";

const mkParagraph = (
  text: string,
  opts: {
    index: number;
    fields?: Field[];
    bookmarks?: Bookmark[];
  },
): Paragraph => ({
  index: opts.index,
  styleId: undefined,
  styleName: undefined,
  directPara: {},
  markRun: {},
  runs: [{ text, props: {} }],
  text,
  bookmarks: opts.bookmarks,
  fields: opts.fields,
  structure: { drawingCount: 0, mathCount: 0, embeddedObjectCount: 0 },
  effective: {},
});

const mkClassified = (
  text: string,
  opts: {
    index: number;
    role: Role | null;
    fields?: Field[];
    bookmarks?: Bookmark[];
  },
): ClassifiedParagraph => ({
  role: opts.role,
  para: mkParagraph(text, opts),
});

const mkModel = (paragraphs: Paragraph[]): DocModel => ({
  paragraphs,
  styles: new Map(),
  docDefaults: {},
  sections: [],
  headers: [],
  footers: [],
  headerParts: [],
  footerParts: [],
  numbering: {
    abstractNums: new Map(),
    nums: new Map(),
  },
});

const EMPTY_RULES: RuleLibrary = {
  styles: {},
};

test("checkCaptionReferenceValidity：识别缺失书签与非题注目标书签", () => {
  const classified = [
    mkClassified("图 X 研究框架", {
      index: 0,
      role: "figure_caption",
      bookmarks: [{ name: "_RefFigure1", id: "1" }],
      fields: [{
        type: "SEQ",
        instruction: "SEQ Figure \\* ARABIC",
        displayText: "1-1",
        sequence: "Figure",
        startRunIndex: 1,
        endRunIndex: 5,
      }],
    }),
    mkClassified("见图 1-1", {
      index: 1,
      role: "body_text",
      fields: [{
        type: "REF",
        instruction: "REF _RefFigure1 \\h",
        displayText: "1-1",
        bookmark: "_RefFigure1",
        startRunIndex: 1,
        endRunIndex: 5,
      }],
    }),
    mkClassified("详见第 3 页", {
      index: 2,
      role: "body_text",
      fields: [{
        type: "PAGEREF",
        instruction: "PAGEREF _MissingCaption \\h",
        displayText: "3",
        bookmark: "_MissingCaption",
        startRunIndex: 1,
        endRunIndex: 5,
      }],
    }),
    mkClassified("第一章 绪论", {
      index: 3,
      role: "heading1",
      bookmarks: [{ name: "_TocHeading1", id: "2" }],
    }),
    mkClassified("见第 1 章", {
      index: 4,
      role: "body_text",
      fields: [{
        type: "REF",
        instruction: "REF _TocHeading1 \\h",
        displayText: "1",
        bookmark: "_TocHeading1",
        startRunIndex: 1,
        endRunIndex: 5,
      }],
    }),
  ];

  const issues = checkCaptionReferenceValidity(classified);

  assert.deepEqual(
    issues.map((issue) => ({
      paragraphIndex: issue.paragraphIndex,
      severity: issue.severity,
      actual: issue.actual,
      message: issue.message,
    })),
    [
      {
        paragraphIndex: 2,
        severity: "error",
        actual: "_MissingCaption（不存在）",
        message: "PAGEREF 引用的书签「_MissingCaption」不存在",
      },
      {
        paragraphIndex: 4,
        severity: "warn",
        actual: "_TocHeading1（存在但不是题注）",
        message: "REF 引用的书签「_TocHeading1」存在，但目标不是图/表/公式题注",
      },
    ],
  );
});

test("validateDoc：输出结构化 caption reference issue 并补齐修复建议", () => {
  const model = mkModel([
    mkParagraph("见图 9", {
      index: 0,
      fields: [{
        type: "REF",
        instruction: "REF _MissingCaption \\h",
        displayText: "9",
        bookmark: "_MissingCaption",
        startRunIndex: 1,
        endRunIndex: 5,
      }],
    }),
    mkParagraph("见第 1 章", {
      index: 1,
      fields: [{
        type: "PAGEREF",
        instruction: "PAGEREF _TocHeading1 \\h",
        displayText: "1",
        bookmark: "_TocHeading1",
        startRunIndex: 1,
        endRunIndex: 5,
      }],
    }),
    mkParagraph("第一章 绪论", {
      index: 2,
      bookmarks: [{ name: "_TocHeading1", id: "2" }],
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
        field: "caption_reference",
        severity: "error",
        actual: "_MissingCaption（不存在）",
        fixability: "manual",
        suggestion: "请在 Word 中更新该交叉引用，改为指向现有图/表/公式题注，或补回对应书签后再更新域",
      },
      {
        paraIndex: 1,
        role: "unknown",
        field: "caption_reference",
        severity: "warn",
        actual: "_TocHeading1（存在但不是题注）",
        fixability: "manual",
        suggestion: "请核对该交叉引用的目标，确保它指向图/表/公式题注而不是普通书签",
      },
    ],
  );
  assert.deepEqual(report.summary, {
    error: 1,
    warn: 1,
    info: 0,
    byRole: {
      unknown: 2,
    },
  });
});
