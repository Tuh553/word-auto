import { test } from "node:test";
import assert from "node:assert/strict";
import type { Paragraph } from "@word-auto/parser";
import {
  applyDocumentProposalFieldToDraftWithResult,
  applyDocumentProposalToDraftWithResult,
  applyProposalFieldToDraft,
  applyProposalFieldToDraftWithResult,
  applyProposalRoleToDraft,
  applyProposalRoleToDraftWithResult,
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

test("extractRuleProposal：提取 document 页面设置候选并识别分节冲突", () => {
  const model = {
    paragraphs: [mkPara("正文一", { alignment: "both", sizePt: 12 })],
    styles: new Map(),
    docDefaults: {},
    sections: [
      {
        pageWidthTwips: 11906,
        pageHeightTwips: 16838,
        marginTopTwips: 1701,
        marginBottomTwips: 1417,
        marginLeftTwips: 1417,
        marginRightTwips: 1417,
        headerTwips: 907,
        footerTwips: 850,
        gutterTwips: 567,
      },
      {
        pageWidthTwips: 11906,
        pageHeightTwips: 16838,
        marginTopTwips: 1701,
        marginBottomTwips: 1701,
        marginLeftTwips: 1417,
        marginRightTwips: 1417,
        headerTwips: 907,
        footerTwips: 850,
        gutterTwips: 567,
      },
    ],
    headers: [],
    numbering: { abstractNums: new Map(), nums: new Map() },
  };

  const proposal = extractRuleProposal(model, { sourceName: "sample.docx" });
  const marginTop = proposal.document?.fields.find((item) => item.key === "margin_top_cm");
  const marginBottom = proposal.document?.fields.find((item) => item.key === "margin_bottom_cm");
  const paperSize = proposal.document?.fields.find((item) => item.key === "paper_size");

  assert.equal(proposal.document?.totalCount, 2);
  assert.equal(marginTop?.proposedValue, 3);
  assert.equal(marginTop?.confidenceLevel, "medium");
  assert.equal(marginBottom?.proposedValue, 2.5);
  assert.deepEqual(marginBottom?.conflicts?.map((item) => [item.value, item.sampleCount]), [[3, 1]]);
  assert.equal(paperSize?.proposedValue, "A4");
  assert.match(proposal.notices.join("\n"), /页面设置在不同分节间存在冲突/);
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

test("apply*WithResult：返回新增/覆盖/启用状态，支持 document 与 role", () => {
  const roleProposal: RoleRuleProposal = {
    role: "body_text",
    label: "正文",
    totalCount: 1,
    fields: [
      {
        key: "fontSizePt",
        proposedValue: { mode: "exact", exact: 10.5, unit: "pt" },
        confidence: 0.9,
        confidenceLevel: "high",
        confidenceHint: "主值集中",
        sampleCount: 1,
        coverage: 1,
        observedCount: 1,
        totalCount: 1,
        evidence: [],
      },
      {
        key: "align",
        proposedValue: { mode: "exact", exact: "justify", unit: "enum" },
        confidence: 0.9,
        confidenceLevel: "high",
        confidenceHint: "主值集中",
        sampleCount: 1,
        coverage: 1,
        observedCount: 1,
        totalCount: 1,
        evidence: [],
      },
    ],
  };
  const documentProposal = {
    key: "document" as const,
    label: "文档设置",
    totalCount: 1,
    fields: [
      {
        key: "margin_top_cm" as const,
        label: "上边距",
        unit: "cm" as const,
        proposedValue: 3,
        confidence: 1,
        confidenceLevel: "high" as const,
        confidenceHint: "主值集中",
        sampleCount: 1,
        coverage: 1,
        observedCount: 1,
        totalCount: 1,
        evidence: [],
      },
    ],
  };
  const draft = mkDraft();
  draft.roles[0].fields[0].enabled = false;
  draft.document = { margin_top_cm: 2.5 };

  const roleFieldResult = applyProposalFieldToDraftWithResult(draft, roleProposal, roleProposal.fields[0]);
  const roleResult = applyProposalRoleToDraftWithResult(draft, roleProposal);
  const documentFieldResult = applyDocumentProposalFieldToDraftWithResult(
    draft,
    documentProposal,
    documentProposal.fields[0],
  );
  const documentResult = applyDocumentProposalToDraftWithResult(draft, documentProposal);

  assert.equal(roleFieldResult.changes[0].status, "updated");
  assert.equal(roleResult.changes[1].status, "added");
  assert.equal(documentFieldResult.changes[0].status, "updated");
  assert.equal(documentResult.draft.document?.margin_top_cm, 3);
});
