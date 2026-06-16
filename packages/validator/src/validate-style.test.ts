import { test } from "node:test";
import assert from "node:assert/strict";
import type { Paragraph } from "@word-auto/parser";
import { checkEditablePara, checkPara } from "./validate-style.js";
import type { EditableRuleLibrary, StyleRule } from "./types.js";

const mkPara = (alignment?: string): Paragraph => ({
  index: 3,
  styleId: undefined,
  styleName: undefined,
  directPara: {},
  markRun: {},
  runs: [{ text: "正文内容", props: {} }],
  text: "正文内容",
  structure: { drawingCount: 0, mathCount: 0, embeddedObjectCount: 0 },
  effective: {
    alignment,
  },
});

const mkRunMixedPara = (): Paragraph => ({
  index: 7,
  styleId: undefined,
  styleName: undefined,
  directPara: {},
  markRun: {},
  runs: [
    {
      text: "正文",
      props: {},
      effective: { fontEastAsia: "宋体", fontAscii: "Times New Roman", sizePt: 12 },
    },
    {
      text: "bad",
      props: {},
      effective: { fontEastAsia: "宋体", fontAscii: "Arial", sizePt: 10.5 },
    },
  ],
  text: "正文bad",
  structure: { drawingCount: 0, mathCount: 0, embeddedObjectCount: 0 },
  effective: {
    fontEastAsia: "宋体",
    fontAscii: "Times New Roman",
    sizePt: 12,
  },
});

test("checkPara：both 归一为 justify，不报对齐问题", () => {
  const rule: StyleRule = { alignment: "justify" };
  const issues = checkPara(mkPara("both"), "body_text", rule);
  assert.equal(issues.length, 0);
});

test("checkPara：对齐缺失时不再伪造成 left", () => {
  const rule: StyleRule = { alignment: "justify" };
  const issues = checkPara(mkPara(), "body_text", rule);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.actual, "(未设置)");
  assert.match(issues[0]?.message ?? "", /实际（未设置）/);
});

test("checkEditablePara：对齐缺失时展示未设置", () => {
  const rules: EditableRuleLibrary = {
    id: "demo",
    name: "Demo",
    version: "1.0.0",
    roles: [
      {
        role: "body_text",
        label: "正文",
        fields: [
          {
            key: "align",
            label: "对齐",
            enabled: true,
            severity: "warn",
            value: { mode: "exact", exact: "justify", unit: "enum" },
          },
        ],
      },
    ],
  };

  const issues = checkEditablePara(mkPara(), "body_text", rules);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.actual, "（未设置）");
  assert.match(issues[0]?.message ?? "", /实际 （未设置）/);
});

test("checkPara：字体和字号问题定位到具体 run", () => {
  const rule: StyleRule = {
    font_latin: "Times New Roman",
    size_pt: 12,
  };
  const issues = checkPara(mkRunMixedPara(), "body_text", rule);

  assert.equal(issues.length, 2);
  assert.deepEqual(
    issues.map((item) => [item.field, item.startRunIndex, item.affectedText]),
    [
      ["font_latin", 1, "bad"],
      ["size_pt", 1, "bad"],
    ],
  );
  assert.match(issues[0]?.message ?? "", /第 2 个文本片段/);
});

test("checkEditablePara：run 级字号问题保留规则值与片段定位", () => {
  const rules: EditableRuleLibrary = {
    id: "demo",
    name: "Demo",
    version: "1.0.0",
    roles: [
      {
        role: "body_text",
        label: "正文",
        fields: [
          {
            key: "fontSizePt",
            label: "字号",
            enabled: true,
            severity: "error",
            value: { mode: "exact", exact: 12, unit: "pt" },
          },
        ],
      },
    ],
  };

  const issues = checkEditablePara(mkRunMixedPara(), "body_text", rules);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.field, "size_pt");
  assert.equal(issues[0]?.startRunIndex, 1);
  assert.equal(issues[0]?.endRunIndex, 1);
  assert.equal(issues[0]?.affectedText, "bad");
  assert.deepEqual(issues[0]?.expected, { mode: "exact", exact: 12, unit: "pt" });
});
