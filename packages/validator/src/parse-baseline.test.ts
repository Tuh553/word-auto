import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { parseDocx } from "@word-auto/parser";
import { classifyParagraphs } from "./classify.js";

// 标准模板对账基线：
// 任何分类启发式调整都应显式更新这里，避免误把角色分布变化当成“静默回归”。
const here = dirname(fileURLToPath(import.meta.url));
const sourceDir = resolve(here, "../../../templates/source");
const docxName = readdirSync(sourceDir).find((f) => f.endsWith(".docx"));

// 当前基线（2026-06-11）：包含表格段落、特殊正文元素与正式后置章节角色
const BASELINE: Record<string, number> = {
  "(null)": 174,
  abstract_title_cn: 1,
  abstract_body_cn: 2,
  keywords_cn: 1,
  abstract_title_en: 1,
  abstract_body_en: 2,
  keywords_en: 1,
  toc_title: 1,
  heading1: 5,
  heading2: 6,
  heading3: 6,
  body_text: 45,
  formula_line: 1,
  table_caption: 3,
  source_note: 2,
  figure_caption: 2,
  reference_heading: 1,
  reference_body: 1,
  appendix_heading: 1,
  appendix_body: 9,
  acknowledgement_heading: 1,
  acknowledgement_body: 4,
  table_cell: 173,
};

const distOf = (roles: (string | null)[]): Record<string, number> => {
  const dist: Record<string, number> = {};
  for (const r of roles) {
    const k = r ?? "(null)";
    dist[k] = (dist[k] ?? 0) + 1;
  }
  return dist;
};

test("解析对账基线：标准模板角色分布保持一致", () => {
  assert.ok(docxName, "templates/source 下应存在 .docx 标准模板");
  const buf = readFileSync(resolve(sourceDir, docxName));
  const model = parseDocx(new Uint8Array(buf));
  const dist = distOf(classifyParagraphs(model.paragraphs));

  // 锁定标准模板各角色的精确计数——分类启发式变更必须显式更新该基线
  for (const [role, count] of Object.entries(BASELINE)) {
    assert.equal(dist[role] ?? 0, count, `角色「${role}」计数应保持基线 ${count}`);
  }
  assert.ok(model.sections.length >= 1);
});
