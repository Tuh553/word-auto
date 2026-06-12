import { test } from "node:test";
import assert from "node:assert/strict";
import { computeFixHint } from "./fixhints.js";

test("段落样式字段：标 auto 并给出带目标值的祈使建议", () => {
  assert.deepEqual(
    computeFixHint({ field: "size_pt", expected: 12, actual: 10.5 }),
    { suggestion: "请将该段落字号调整为 12pt", fixability: "auto" },
  );
  assert.deepEqual(
    computeFixHint({ field: "font_east_asia", expected: "宋体", actual: "黑体" }),
    { suggestion: "请将该段落中文字体设为 「宋体」", fixability: "auto" },
  );
  assert.deepEqual(
    computeFixHint({ field: "alignment", expected: "center", actual: "left" }),
    { suggestion: "请将该段落对齐方式改为 「居中」", fixability: "auto" },
  );
  assert.deepEqual(
    computeFixHint({ field: "bold", expected: true, actual: false }),
    { suggestion: "请将该段落设为 「加粗」", fixability: "auto" },
  );
});

test("行距：固定值不符可 auto，未设置/多倍需 manual", () => {
  assert.deepEqual(
    computeFixHint({ field: "line_spacing_pt", expected: 22, actual: 20 }),
    { suggestion: "请将该段落行距改为固定值 22pt", fixability: "auto" },
  );
  const multiple = computeFixHint({
    field: "line_spacing_pt",
    expected: 22,
    actual: "1.5 倍",
  });
  assert.equal(multiple.fixability, "manual");
  assert.match(multiple.suggestion, /1\.5 倍/);
  assert.match(multiple.suggestion, /固定值 22pt/);
});

test("文档/页面级字段：统一标 manual", () => {
  assert.equal(
    computeFixHint({ field: "margin_top_cm", expected: 3, actual: 2.5 }).fixability,
    "manual",
  );
  assert.deepEqual(
    computeFixHint({ field: "paper_size", expected: "A4 (21×29.7cm)", actual: "Letter" }),
    {
      suggestion: "请在页面设置中将纸张大小设为 A4 (21×29.7cm)",
      fixability: "manual",
    },
  );
  assert.equal(
    computeFixHint({ field: "header_text", expected: "重庆大学硕士学位论文", actual: "" })
      .fixability,
    "manual",
  );
});

test("RuleValue 期望：oneOf / range 描述目标短语", () => {
  assert.match(
    computeFixHint({
      field: "size_pt",
      expected: { mode: "oneOf", oneOf: [10.5, 12], unit: "pt" },
      actual: 9,
    }).suggestion,
    /10\.5pt 或 12pt/,
  );
  assert.match(
    computeFixHint({
      field: "line_spacing_pt",
      expected: { mode: "range", min: 18, max: 22, unit: "pt" },
      actual: 16,
    }).suggestion,
    /18pt ~ 22pt/,
  );
});

test("未知字段兜底为 manual，不臆测自动修复", () => {
  const hint = computeFixHint({ field: "some_unknown_field", expected: 1, actual: 2 });
  assert.equal(hint.fixability, "manual");
  assert.ok(hint.suggestion.length > 0);
});
