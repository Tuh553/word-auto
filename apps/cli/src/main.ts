import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseDocx } from "@word-auto/parser";
import type { LineSpacing } from "@word-auto/parser";
import {
  classifyParagraphs,
  normalizeRuleLibrary,
  validateDoc,
  type EditableRuleLibrary,
  type LegacyRuleLibrary,
} from "@word-auto/validator";

const DOCS = "E:/Claude code/docs";
const docxPath = process.argv[2] ?? `${DOCS}/output/demo-thesis-phase1.docx`;
const rulesPath = process.argv[3] ?? `${DOCS}/rules/chongqing-thesis-phase1.json`;

const fmtLs = (ls?: LineSpacing): string => {
  if (!ls) return "-";
  return ls.pt != null ? `固定${ls.pt}pt` : `${ls.multiple}倍`;
};

const buf = readFileSync(docxPath);
// 去掉可能的 UTF-8 BOM（PowerShell `Set-Content -Encoding UTF8` 会写 BOM）
const rules = JSON.parse(
  readFileSync(rulesPath, "utf8").replace(/^﻿/, ""),
) as LegacyRuleLibrary | EditableRuleLibrary;
const normalizedRules = normalizeRuleLibrary(rules);
const model = parseDocx(new Uint8Array(buf));
const roles = classifyParagraphs(model.paragraphs);
const report = validateDoc(model, normalizedRules);

console.log(`输入文档: ${docxPath}`);
console.log(`规则库:   ${rulesPath}\n`);

console.log("=== 解析自检（前 12 个已分类段落的“有效格式”）===");
let shown = 0;
model.paragraphs.forEach((p, i) => {
  const role = roles[i];
  if (!role || shown >= 12) return;
  shown++;
  const e = p.effective;
  const txt = p.text.replace(/\s+/g, " ").trim().slice(0, 14);
  console.log(
    `#${p.index} [${role}] "${txt}" | 字体:${e.fontEastAsia ?? "-"}/${e.fontAscii ?? "-"} ` +
      `字号:${e.sizePt ?? "-"} 粗:${e.bold ? "Y" : "N"} 对齐:${e.alignment ?? "-"} ` +
      `行距:${fmtLs(e.lineSpacing)} 首行:${e.firstLineIndentChars ?? "-"}`,
  );
});

const sec = model.sections.at(-1);
if (sec) {
  const cm = (tw?: number): string =>
    tw == null ? "-" : (tw / 566.93).toFixed(2);
  console.log("\n=== 页面设置（主体节，实测）===");
  console.log(
    `纸张 ${cm(sec.pageWidthTwips)}×${cm(sec.pageHeightTwips)}cm | ` +
      `边距 上${cm(sec.marginTopTwips)}/下${cm(sec.marginBottomTwips)}/` +
      `左${cm(sec.marginLeftTwips)}/右${cm(sec.marginRightTwips)}cm | ` +
      `页眉${cm(sec.headerTwips)}/页脚${cm(sec.footerTwips)}/装订${cm(sec.gutterTwips)}cm`,
  );
}

if (model.sections.length) {
  const fmts = model.sections.map(
    (s) =>
      `${s.pageNumberFormat ?? "decimal"}${s.pageNumberStart != null ? "@" + s.pageNumberStart : ""}`,
  );
  console.log(`分节页码（共 ${model.sections.length} 节）: ${fmts.join(" | ")}`);
}

console.log("\n=== 校验报告 ===");
console.log(`规则库: ${normalizedRules.name}`);
console.log(
  `段落总数 ${report.paragraphCount}，已分类 ${report.classifiedCount}`,
);
console.log(
  `问题: error ${report.summary.error} / warn ${report.summary.warn} / info ${report.summary.info}`,
);

console.log("\n--- 问题明细（前 30 条）---");
report.issues.slice(0, 30).forEach((it) => {
  const loc = it.paraIndex < 0 ? "[页面设置]" : `#${it.paraIndex + 1}`;
  console.log(
    `${loc} [${it.severity}] (${it.role}.${it.field}) ${it.message}  «${it.textPreview}»`,
  );
});
if (report.issues.length > 30) {
  console.log(`... 其余 ${report.issues.length - 30} 条见 JSON 报告`);
}

const outPath = resolve(process.cwd(), "output/report.json");
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");
console.log(`\n报告已写入 ${outPath}`);
