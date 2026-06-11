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
};

const compactHeader = (text: string): string =>
  text.replace(/\s+/g, " ").trim().replace(/^重庆大学硕士学位论文\s+/, "");

test("parseDocx：标准模板解析基线保持稳定", () => {
  const model = parseDocx(new Uint8Array(readFileSync(docxPath)));

  assert.equal(model.paragraphs.length, BASELINE.paragraphCount);
  assert.equal(model.sections.length, BASELINE.sectionCount);
  assert.equal(
    model.paragraphs.filter((item) => item.inTable).length,
    BASELINE.tableParagraphCount,
  );
  assert.deepEqual(model.sections[0], BASELINE.firstSection);
  assert.deepEqual(model.headers.map(compactHeader), BASELINE.headerTitles);
});
