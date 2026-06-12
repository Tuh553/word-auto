import { test } from "node:test";
import assert from "node:assert/strict";
import type { DocModel, Paragraph } from "@word-auto/parser";
import {
  applyProposalFieldToDraft,
  extractRuleProposal,
  validateDoc,
  type EditableRuleLibrary,
} from "@word-auto/validator";
import { parseImportedRuleLibrary, publishDraft, type RuleLibraryRecord } from "./ruleLibraries.js";

const mkPara = (
  text: string,
  opts: {
    outlineLevel?: number;
    alignment?: string;
    sizePt?: number;
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
  },
});

const mkModel = (): DocModel => ({
  paragraphs: [
    mkPara("摘要"),
    mkPara("这是摘要正文"),
    mkPara("第一章 绪论", { outlineLevel: 0, sizePt: 16 }),
    mkPara("正文内容", { alignment: "justify", sizePt: 10.5 }),
  ],
  styles: new Map(),
  docDefaults: {},
  sections: [],
  headers: [],
});

const mkRecord = (): RuleLibraryRecord => ({
  id: "demo",
  published: {
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
  },
  publishedUpdatedAt: "2026-06-11T00:00:00.000Z",
  draft: {
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
            value: { mode: "exact", exact: 10.5, unit: "pt" },
          },
        ],
      },
    ],
  },
});

test("publishDraft：草稿发布后立即影响检测消费的生效规则", () => {
  const model = mkModel();
  const before = validateDoc(model, mkRecord().published);
  const published = publishDraft(mkRecord());
  const after = validateDoc(model, published.published);

  assert.equal(before.issues.length, 1);
  assert.equal(after.issues.length, 0);
  assert.equal(published.published.version, "1.0.1");
  assert.equal(published.draft.version, "1.0.1");
});

test("parseImportedRuleLibrary：支持 BOM JSON 并避免 id 冲突", () => {
  const imported = parseImportedRuleLibrary(
    "\uFEFF" +
      JSON.stringify({
        id: "demo",
        name: "导入模板",
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
      } satisfies EditableRuleLibrary),
    ["demo"],
  );

  assert.equal(imported.id, "demo-2");
  assert.equal(imported.published.id, "demo-2");
  assert.equal(imported.draft.status, "draft");
});

test("parseImportedRuleLibrary：保留 source.provenance 供检测报告消费", () => {
  const imported = parseImportedRuleLibrary(
    JSON.stringify({
      id: "with-source",
      name: "导入模板",
      version: "1.0.0",
      source: {
        provenance: {
          body: { index: 10, text: "正文 中文字体为宋体，小四号。" },
        },
      },
      styles: {
        body_text: {
          size_pt: 12,
        },
      },
    }),
    [],
  );

  const publishedBody = imported.published.source?.provenance?.body;
  const draftBody = imported.draft.source?.provenance?.body;

  assert.equal(typeof publishedBody, "object");
  assert.equal(typeof draftBody, "object");
  assert.equal((publishedBody as { text?: string }).text, "正文 中文字体为宋体，小四号。");
  assert.equal((draftBody as { text?: string }).text, "正文 中文字体为宋体，小四号。");
});

test("模板候选闭环：提取 -> 接受到草稿 -> 发布 -> 检测消费新规则", () => {
  const model = mkModel();
  const proposal = extractRuleProposal(model, { sourceName: "sample.docx" });
  const role = proposal.roles.find((item) => item.role === "body_text");
  const field = role?.fields.find((item) => item.key === "fontSizePt");
  assert.ok(role);
  assert.ok(field);

  const record = mkRecord();
  const nextDraft = applyProposalFieldToDraft(record.draft, role, field);
  const published = publishDraft({ ...record, draft: nextDraft });
  const report = validateDoc(model, published.published);

  assert.equal(field.proposedValue.exact, 10.5);
  assert.equal(published.published.version, "1.0.1");
  assert.equal(report.issues.length, 0);
});
