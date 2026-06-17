import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseDocx } from "@word-auto/parser";
import { validateDoc } from "./validate.js";

const here = dirname(fileURLToPath(import.meta.url));
const docxPath = resolve(
  here,
  "../../../templates/source/博士、硕士论文格式范本-综合类  (专业学位） - 批注版.docx",
);
const rulesPath = resolve(here, "../../../apps/web/src/templates/chongqing-thesis-phase1.json");

const ISSUE_DIST_BASELINE: Record<string, number> = {
  "document:page_number_alignment": 1,
  // 编号连续性检测（新增）
  "table_caption:caption_sequence": 1,
  "keywords_cn:bold": 1,
  "keywords_en:bold": 1,
  "body_text:size_pt": 7,
  "body_text:alignment": 5,
  "formula_line:alignment": 1,
  "formula_line:size_pt": 2,
  "formula_line:line_spacing_pt": 1,
  "reference_body:size_pt": 1,
  "reference_body:line_spacing_pt": 1,
  "appendix_body:font_east_asia": 4,
  "appendix_body:line_spacing_pt": 5,
  "acknowledgement_body:font_east_asia": 1,
  "acknowledgement_body:size_pt": 1,
  "acknowledgement_body:first_line_indent_chars": 2,
};

test("标准模板校验基线：发布规则消费结果保持一致", () => {
  const model = parseDocx(new Uint8Array(readFileSync(docxPath)));
  const rules = JSON.parse(readFileSync(rulesPath, "utf8"));
  const report = validateDoc(model, rules);
  const dist: Record<string, number> = {};

  for (const issue of report.issues) {
    const key = `${issue.role}:${issue.field}`;
    dist[key] = (dist[key] ?? 0) + 1;
  }

  assert.equal(report.issues.length, 35);
  assert.deepEqual(report.summary, {
    error: 17,
    warn: 12,
    info: 6,
    byRole: {
      document: 1,
      table_caption: 1,
      keywords_cn: 1,
      keywords_en: 1,
      body_text: 12,
      formula_line: 4,
      reference_body: 2,
      appendix_body: 9,
      acknowledgement_body: 4,
    },
  });
  assert.deepEqual(dist, ISSUE_DIST_BASELINE);
});
