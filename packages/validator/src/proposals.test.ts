import { test } from "node:test";
import assert from "node:assert/strict";
import type { Paragraph } from "@word-auto/parser";
import {
  applyProposalFieldToDraft,
  applyProposalRoleToDraft,
  extractRuleProposal,
  type RoleRuleProposal,
  type RuleDraft,
} from "./index.js";

const mkPara = (
  text: string,
  opts: {
    outlineLevel?: number;
    alignment?: string;
    sizePt?: number;
    lineHeightPt?: number;
    bold?: boolean;
  } = {},
): Paragraph => ({
  index: 0,
  styleId: undefined,
  styleName: undefined,
  directPara: {},
  markRun: {},
  runs: [{ text, props: {} }],
  text,
  structure: { drawingCount: 0, mathCount: 0, embeddedObjectCount: 0 },
  effective: {
    outlineLevel: opts.outlineLevel,
    alignment: opts.alignment,
    sizePt: opts.sizePt,
    bold: opts.bold,
    lineSpacing: opts.lineHeightPt == null
      ? undefined
      : { value: opts.lineHeightPt, rule: "exact", pt: opts.lineHeightPt },
  },
});

const mkDraft = (): RuleDraft => ({
  id: "demo",
  name: "Demo",
  version: "1.0.0",
  status: "draft",
  updatedAt: "2026-06-11T00:00:00.000Z",
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
});

test("extractRuleProposal：聚合候选值、覆盖率、冲突与可信提示", () => {
  const model = {
    paragraphs: [
      mkPara("摘要"),
      mkPara("这是摘要正文", { alignment: "both", sizePt: 12 }),
      mkPara("第一章 绪论", { outlineLevel: 0, sizePt: 16 }),
      mkPara("正文一", { alignment: "both", sizePt: 12, lineHeightPt: 20 }),
      mkPara("正文二", { alignment: "both", sizePt: 12, lineHeightPt: 20 }),
      mkPara("正文三", { alignment: "left", sizePt: 10.5, lineHeightPt: 18 }),
    ],
    styles: new Map(),
    docDefaults: {},
    sections: [],
    headers: [],
    numbering: { abstractNums: new Map(), nums: new Map() },
  };

  const proposal = extractRuleProposal(model, { sourceName: "sample.docx" });
  const body = proposal.roles.find((item) => item.role === "body_text");
  const size = body?.fields.find((item) => item.key === "fontSizePt");
  const align = body?.fields.find((item) => item.key === "align");

  assert.equal(proposal.sourceName, "sample.docx");
  assert.equal(body?.totalCount, 3);
  assert.deepEqual(size?.proposedValue, { mode: "exact", exact: 12, unit: "pt" });
  assert.equal(size?.sampleCount, 2);
  assert.equal(size?.coverage, 0.67);
  assert.equal(size?.confidenceLevel, "low");
  assert.deepEqual(size?.conflicts?.map((item) => [item.value.exact, item.sampleCount]), [[10.5, 1]]);
  assert.deepEqual(align?.proposedValue, { mode: "exact", exact: "justify", unit: "enum" });
});

test("extractRuleProposal：对齐缺失时不再默认提取为 left", () => {
  const model = {
    paragraphs: [
      mkPara("摘要"),
      mkPara("这是摘要正文", { alignment: "both", sizePt: 12 }),
      mkPara("第一章 绪论", { outlineLevel: 0, sizePt: 16 }),
      mkPara("正文一", { sizePt: 12 }),
      mkPara("正文二", { alignment: "both", sizePt: 12 }),
      mkPara("正文三", { sizePt: 12 }),
    ],
    styles: new Map(),
    docDefaults: {},
    sections: [],
    headers: [],
    numbering: { abstractNums: new Map(), nums: new Map() },
  };

  const proposal = extractRuleProposal(model, { sourceName: "sample.docx" });
  const body = proposal.roles.find((item) => item.role === "body_text");
  const align = body?.fields.find((item) => item.key === "align");

  assert.deepEqual(align?.proposedValue, { mode: "exact", exact: "justify", unit: "enum" });
  assert.equal(align?.observedCount, 1);
  assert.equal(align?.totalCount, 3);
});

test("applyProposalFieldToDraft / applyProposalRoleToDraft：候选进入草稿并补齐缺失字段", () => {
  const proposal: RoleRuleProposal = {
    role: "body_text",
    label: "正文",
    totalCount: 3,
    fields: [
      {
        key: "fontSizePt",
        proposedValue: { mode: "exact", exact: 10.5, unit: "pt" },
        confidence: 0.9,
        confidenceLevel: "high" as const,
        confidenceHint: "主值集中",
        sampleCount: 3,
        coverage: 1,
        observedCount: 3,
        totalCount: 3,
        evidence: [],
      },
      {
        key: "align",
        proposedValue: { mode: "exact", exact: "justify", unit: "enum" },
        confidence: 0.9,
        confidenceLevel: "high" as const,
        confidenceHint: "主值集中",
        sampleCount: 3,
        coverage: 1,
        observedCount: 3,
        totalCount: 3,
        evidence: [],
      },
    ],
  };

  const single = applyProposalFieldToDraft(mkDraft(), proposal, proposal.fields[1]);
  const full = applyProposalRoleToDraft(mkDraft(), proposal);

  assert.deepEqual(
    single.roles.find((item) => item.role === "body_text")?.fields.map((item) => item.key),
    ["fontSizePt", "align"],
  );
  assert.deepEqual(
    full.roles.find((item) => item.role === "body_text")?.fields.map((item) => [
      item.key,
      item.value.exact,
    ]),
    [
      ["fontSizePt", 10.5],
      ["align", "justify"],
    ],
  );
});
