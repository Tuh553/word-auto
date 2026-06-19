import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { parseDocx } from "@word-auto/parser";
import { classifyParagraphs } from "./classify.js";

const here = dirname(fileURLToPath(import.meta.url));
const sourceDir = resolve(here, "../../../templates/source");
const docxName = readdirSync(sourceDir).find((f) => f.endsWith(".docx"))!;

test("表格段落：提取并标记 inTable / table_cell", () => {
  const buf = readFileSync(resolve(sourceDir, docxName));
  const model = parseDocx(new Uint8Array(buf));
  const inTableCount = model.paragraphs.filter((p) => p.inTable).length;
  const tableCells = classifyParagraphs(model.paragraphs).filter(
    (r) => r === "table_cell",
  ).length;

  console.log("[table] paragraphCount =", model.paragraphs.length);
  console.log("[table] inTable paragraphs =", inTableCount);
  console.log("[table] table_cell roles =", tableCells);

  // inTable 段落数应与 table_cell 分类数严格一致
  assert.equal(tableCells, inTableCount);
  // 表格段落应保留在 paragraphs 中，并稳定识别为 table_cell
  assert.ok(model.paragraphs.length >= 270);
});
