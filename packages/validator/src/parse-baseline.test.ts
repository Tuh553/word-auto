import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { parseDocx } from "@word-auto/parser";
import { classifyParagraphs } from "./classify.js";

// 标准模板对账基线（重构 parser 表格段落提取前记录）：
// 现有段落的解析与分类必须保持不变；表格段落（table_cell）为纯新增。
const here = dirname(fileURLToPath(import.meta.url));
const sourceDir = resolve(here, "../../../templates/source");
const docxName = readdirSync(sourceDir).find((f) => f.endsWith(".docx"));

// 重构前基线（标准模板，由首次运行记录的 14 个角色计数）
const BASELINE: Record<string, number> = {
  "(null)": 174,
  abstract_title_cn: 1,
  abstract_body_cn: 2,
  keywords_cn: 1,
  abstract_title_en: 1,
  abstract_body_en: 2,
  keywords_en: 1,
  toc_title: 1,
  heading1: 7,
  heading2: 6,
  heading3: 6,
  body_text: 66,
  reference_heading: 1,
  reference_body: 1,
};

const distOf = (roles: (string | null)[]): Record<string, number> => {
  const dist: Record<string, number> = {};
  for (const r of roles) {
    const k = r ?? "(null)";
    dist[k] = (dist[k] ?? 0) + 1;
  }
  return dist;
};

test("解析对账基线：现有角色分布不受表格重构影响", () => {
  assert.ok(docxName, "templates/source 下应存在 .docx 标准模板");
  const buf = readFileSync(resolve(sourceDir, docxName));
  const model = parseDocx(new Uint8Array(buf));
  const dist = distOf(classifyParagraphs(model.paragraphs));

  // 锁定现有 14 个角色的精确计数——表格重构不得改变任何一项
  for (const [role, count] of Object.entries(BASELINE)) {
    assert.equal(dist[role] ?? 0, count, `角色「${role}」计数应保持基线 ${count}`);
  }
  assert.ok(model.sections.length >= 1);
});
