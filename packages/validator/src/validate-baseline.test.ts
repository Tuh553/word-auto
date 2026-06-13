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
  "abstract_body_cn:alignment": 2,
  "keywords_cn:bold": 1,
  "keywords_cn:alignment": 1,
  "abstract_body_en:alignment": 2,
  "keywords_en:bold": 1,
  "keywords_en:alignment": 1,
  "body_text:alignment": 41,
  "heading2:alignment": 6,
  "body_text:size_pt": 2,
  "heading3:alignment": 6,
  "formula_line:alignment": 1,
  "formula_line:size_pt": 1,
  "formula_line:line_spacing_pt": 1,
  "reference_body:size_pt": 1,
  "reference_body:alignment": 1,
  "reference_body:line_spacing_pt": 1,
  "appendix_body:font_east_asia": 4,
  "appendix_body:line_spacing_pt": 5,
  "acknowledgement_body:alignment": 4,
  "acknowledgement_body:font_east_asia": 1,
  "acknowledgement_body:size_pt": 1,
  "acknowledgement_body:first_line_indent_chars": 2,
  // 编号连续性检测（新增）
  "heading2:heading_sequence": 2,
  "heading3:heading_sequence": 2,
  "table_caption:caption_sequence": 1,
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

  assert.equal(report.issues.length, 91);
  assert.deepEqual(report.summary, {
    error: 15,
    warn: 70,
    info: 6,
    byRole: {
      abstract_body_cn: 2,
      keywords_cn: 2,
      abstract_body_en: 2,
      keywords_en: 2,
      body_text: 43,
      heading2: 8,
      heading3: 8,
      formula_line: 3,
      reference_body: 3,
      table_caption: 1,
      appendix_body: 9,
      acknowledgement_body: 8,
    },
  });
  assert.deepEqual(dist, ISSUE_DIST_BASELINE);
});
