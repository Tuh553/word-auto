import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseDocx } from "./index.js";

const here = dirname(fileURLToPath(import.meta.url));
const docxPath = resolve(
  here,
  "../../../templates/source/博士、硕士论文格式范本-综合类  (专业学位） - 批注版.docx",
);

const BASELINE = {
  paragraphCount: 443,
  sectionCount: 14,
  tableParagraphCount: 173,
  noteDefinitionCount: 1,
  noteReferenceParagraphIndexes: [125],
  firstNoteContent: "① 脚注文本脚注文本脚注文本脚注文本",
  drawingParagraphIndexes: [0, 4, 22, 41, 59, 72, 171, 174, 185],
  embeddedObjectParagraphIndexes: [171],
  mathParagraphIndexes: [],
  firstSection: {
    pageWidthTwips: 11906,
    pageHeightTwips: 16838,
    marginTopTwips: 1701,
    marginBottomTwips: 1417,
    marginLeftTwips: 1417,
    marginRightTwips: 1417,
    headerTwips: 907,
    footerTwips: 850,
    gutterTwips: 567,
    pageNumberFormat: "upperRoman",
    pageNumberStart: 1,
  },
  headerTitles: [
    "目录",
    "致谢",
    "1 绪论",
    "2 标题",
    "3 标题",
    "4 标题",
    "5 结论与展望",
    "附录",
    "摘要",
    "Abstract",
  ],
  headerParagraphCount: 10,
  headerFontEastAsia: ["宋体"],
  headerFontAscii: ["Times New Roman"],
  headerSizePt: [10.5],
  headerBottomBorderStyle: ["single"],
  footerPageNumberFontAscii: ["Times New Roman"],
  footerPageNumberSizePt: [9],
};

const compactHeader = (text: string): string =>
  text.replace(/\s+/g, " ").trim().replace(/^重庆大学硕士学位论文\s+/, "");

const uniqueDefined = <T>(values: Array<T | undefined>): T[] =>
  Array.from(new Set(values.filter((value): value is T => value !== undefined)));

test("parseDocx：标准模板解析基线保持稳定", () => {
  const model = parseDocx(new Uint8Array(readFileSync(docxPath)));

  assert.equal(model.paragraphs.length, BASELINE.paragraphCount);
  assert.equal(model.sections.length, BASELINE.sectionCount);
  assert.equal(
    model.paragraphs.filter((item) => item.inTable).length,
    BASELINE.tableParagraphCount,
  );
  assert.equal(model.noteDefinitions?.length ?? 0, BASELINE.noteDefinitionCount);
  assert.deepEqual(
    model.paragraphs
      .filter((item) => (item.notes?.length ?? 0) > 0)
      .map((item) => item.index),
    BASELINE.noteReferenceParagraphIndexes,
  );
  assert.equal(model.noteDefinitions?.[0]?.content, BASELINE.firstNoteContent);
  assert.deepEqual(
    model.paragraphs
      .filter((item) => item.structure.drawingCount > 0)
      .map((item) => item.index),
    BASELINE.drawingParagraphIndexes,
  );
  assert.deepEqual(
    model.paragraphs
      .filter((item) => item.structure.embeddedObjectCount > 0)
      .map((item) => item.index),
    BASELINE.embeddedObjectParagraphIndexes,
  );
  assert.deepEqual(
    model.paragraphs
      .filter((item) => item.structure.mathCount > 0)
      .map((item) => item.index),
    BASELINE.mathParagraphIndexes,
  );
  assert.deepEqual(model.sections[0], BASELINE.firstSection);
  assert.deepEqual(model.headers.map(compactHeader), BASELINE.headerTitles);
  assert.deepEqual(
    model.headerParts?.map((part) => part.rightText).filter(Boolean),
    BASELINE.headerTitles,
  );
  const headerParagraphs = model.headerParts?.flatMap((part) => part.paragraphs) ?? [];
  assert.equal(headerParagraphs.length, BASELINE.headerParagraphCount);
  assert.deepEqual(
    uniqueDefined(headerParagraphs.map((paragraph) => paragraph.effective.fontEastAsia)),
    BASELINE.headerFontEastAsia,
  );
  assert.deepEqual(
    uniqueDefined(headerParagraphs.map((paragraph) => paragraph.effective.fontAscii)),
    BASELINE.headerFontAscii,
  );
  assert.deepEqual(
    uniqueDefined(headerParagraphs.map((paragraph) => paragraph.effective.sizePt)),
    BASELINE.headerSizePt,
  );
  assert.deepEqual(
    uniqueDefined(headerParagraphs.map((paragraph) => paragraph.bottomBorder?.style)),
    BASELINE.headerBottomBorderStyle,
  );
  assert.ok(model.footerParts?.some((part) => part.hasPageNumber));
  const pageNumberSegments = model.footerParts
    ?.flatMap((part) => part.paragraphs)
    .flatMap((paragraph) => paragraph.segments)
    .filter((segment) => segment.kind === "pageNumber") ?? [];
  assert.deepEqual(
    uniqueDefined(pageNumberSegments.map((segment) => segment.effective?.fontAscii)),
    BASELINE.footerPageNumberFontAscii,
  );
  assert.deepEqual(
    uniqueDefined(pageNumberSegments.map((segment) => segment.effective?.sizePt)),
    BASELINE.footerPageNumberSizePt,
  );
});
