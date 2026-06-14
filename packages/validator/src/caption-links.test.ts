import { test } from "node:test";
import assert from "node:assert/strict";
import type { Bookmark, Field, Paragraph } from "@word-auto/parser";
import { buildCaptionReferenceGraph } from "./caption-links.js";
import type { ClassifiedParagraph, Role } from "./types.js";

const mkPara = (
  text: string,
  opts: {
    index: number;
    role: Role | null;
    fields?: Field[];
    bookmarks?: Bookmark[];
  },
): ClassifiedParagraph => ({
  role: opts.role,
  para: {
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
  } satisfies Paragraph,
});

test("buildCaptionReferenceGraph：关联题注 SEQ 域与 REF/PAGEREF 交叉引用", () => {
  const classified = [
    mkPara("图 1-1 研究框架", {
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
    mkPara("见图 1-1", {
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
    mkPara("详见第 3 页", {
      index: 2,
      role: "body_text",
      fields: [{
        type: "PAGEREF",
        instruction: "PAGEREF _RefFigure1 \\h",
        displayText: "3",
        bookmark: "_RefFigure1",
        startRunIndex: 1,
        endRunIndex: 5,
      }],
    }),
    mkPara("(1-2)", {
      index: 3,
      role: "formula_line",
      bookmarks: [{ name: "_RefEq1", id: "2" }],
      fields: [{
        type: "SEQ",
        instruction: "SEQ Equation \\* ARABIC",
        displayText: "1-2",
        sequence: "Equation",
        startRunIndex: 0,
        endRunIndex: 4,
      }],
    }),
  ];

  const graph = buildCaptionReferenceGraph(classified);

  assert.deepEqual(
    graph.captions.map((caption) => ({
      kind: caption.kind,
      paragraphIndex: caption.paragraphIndex,
      sequenceName: caption.sequenceName,
      numberText: caption.numberText,
      numberParts: caption.numberParts,
      bookmarkNames: caption.bookmarkNames,
    })),
    [
      {
        kind: "figure",
        paragraphIndex: 0,
        sequenceName: "Figure",
        numberText: "1-1",
        numberParts: [1, 1],
        bookmarkNames: ["_RefFigure1"],
      },
      {
        kind: "equation",
        paragraphIndex: 3,
        sequenceName: "Equation",
        numberText: "1-2",
        numberParts: [1, 2],
        bookmarkNames: ["_RefEq1"],
      },
    ],
  );
  assert.equal(graph.captionsByBookmark.get("_RefFigure1")?.paragraphIndex, 0);
  assert.equal(graph.references.length, 2);
  assert.equal(graph.references[0]?.type, "REF");
  assert.equal(graph.references[0]?.targetCaption?.paragraphIndex, 0);
  assert.equal(graph.references[1]?.type, "PAGEREF");
  assert.equal(graph.references[1]?.targetCaption?.kind, "figure");
});

test("buildCaptionReferenceGraph：区分缺失书签与非题注书签", () => {
  const classified = [
    mkPara("见图 9", {
      index: 0,
      role: "body_text",
      fields: [{
        type: "REF",
        instruction: "REF _MissingCaption \\h",
        displayText: "9",
        bookmark: "_MissingCaption",
        startRunIndex: 0,
        endRunIndex: 4,
      }],
    }),
    mkPara("第一章 绪论", {
      index: 1,
      role: "heading1",
      bookmarks: [{ name: "_TocHeading1", id: "3" }],
    }),
    mkPara("见第 1 章", {
      index: 2,
      role: "body_text",
      fields: [{
        type: "REF",
        instruction: "REF _TocHeading1 \\h",
        displayText: "1",
        bookmark: "_TocHeading1",
        startRunIndex: 0,
        endRunIndex: 4,
      }],
    }),
  ];

  const graph = buildCaptionReferenceGraph(classified);

  assert.equal(graph.references[0]?.bookmarkExists, false);
  assert.equal(graph.references[0]?.targetCaption, undefined);
  assert.equal(graph.references[1]?.bookmarkExists, true);
  assert.equal(graph.references[1]?.targetCaption, undefined);
});
