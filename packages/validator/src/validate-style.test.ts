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
