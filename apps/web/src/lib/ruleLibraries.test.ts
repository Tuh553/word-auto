import { test } from "node:test";
import assert from "node:assert/strict";
import type { DocModel, Paragraph } from "@word-auto/parser";
import {
  applyProposalFieldToDraft,
  extractRuleProposal,
  lintRuleLibrary,
  validateDoc,
  type EditableRuleLibrary,
} from "@word-auto/validator";
import {
  createBlankRuleLibraryRecord,
  deleteRuleLibraryRecord,
  duplicateRuleLibraryRecord,
  isBuiltinRuleLibrary,
  loadRuleLibraryRecords,
  loadSelectedRuleLibraryId,
  parseImportedRuleLibrary,
  publishDraft,
  renameRuleLibraryRecord,
  saveRuleLibraryRecords,
  saveSelectedRuleLibraryId,
  type RuleLibraryRecord,
} from "./ruleLibraries.js";

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
  numbering: { abstractNums: new Map(), nums: new Map() },
});

const BUILTIN_TEMPLATE_ID = "chongqing-university-professional-thesis-phase-1";

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

const withMockStorage = (run: () => void): void => {
  const holder = globalThis as typeof globalThis & { window?: unknown };
  const previous = holder.window;
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => store.set(key, value),
      },
    },
  });
  try {
    run();
  } finally {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: previous,
    });
  }
};

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

test("createBlankRuleLibraryRecord：新建模板可选中、可持久化且草稿可发布", () => {
  withMockStorage(() => {
    const record = createBlankRuleLibraryRecord("新模板", [mkRecord()]);

    assert.equal(record.published.name, "新模板");
    assert.equal(record.draft.name, "新模板");
    assert.equal(lintRuleLibrary(record.draft).ok, true);

    saveRuleLibraryRecords([record]);
    saveSelectedRuleLibraryId(record.id);
    const loaded = loadRuleLibraryRecords();
    const selectedId = loadSelectedRuleLibraryId(loaded);

    assert.ok(loaded.some((item) => item.id === record.id));
    assert.equal(selectedId, record.id);
  });
});

test("duplicateRuleLibraryRecord：复制为独立自定义模板，修改副本不影响原模板", () => {
  const source = mkRecord();
  const copy = duplicateRuleLibraryRecord(source, [source], "Demo Copy");

  copy.draft.roles[0].fields[0].value.exact = 9;

  assert.equal(copy.id, "demo-copy");
  assert.equal(copy.published.name, "Demo Copy");
  assert.equal(copy.draft.name, "Demo Copy");
  assert.equal(copy.published.basedOn, source.published.id);
  assert.equal(source.draft.roles[0].fields[0].value.exact, 10.5);
  assert.equal(isBuiltinRuleLibrary(copy.id), false);
});

test("renameRuleLibraryRecord：同步更新 published 与 draft 名称", () => {
  const renamed = renameRuleLibraryRecord(mkRecord(), "新名称");

  assert.equal(renamed.published.name, "新名称");
  assert.equal(renamed.draft.name, "新名称");
});

test("deleteRuleLibraryRecord：删除自定义模板后优先切回内置模板", () => {
  const builtin = createBlankRuleLibraryRecord("内置占位", []);
  const custom = mkRecord();
  const records = [
    {
      ...builtin,
      id: BUILTIN_TEMPLATE_ID,
      published: { ...builtin.published, id: BUILTIN_TEMPLATE_ID },
      draft: { ...builtin.draft, id: BUILTIN_TEMPLATE_ID },
    },
    custom,
  ];

  const result = deleteRuleLibraryRecord(records, custom.id);

  assert.deepEqual(result.records.map((item) => item.id), [BUILTIN_TEMPLATE_ID]);
  assert.equal(result.nextTemplateId, BUILTIN_TEMPLATE_ID);
});

test("deleteRuleLibraryRecord：内置模板不可删除", () => {
  assert.throws(
    () => deleteRuleLibraryRecord([], BUILTIN_TEMPLATE_ID),
    /内置模板不能删除/,
  );
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

test("parseImportedRuleLibrary：保留统计型规则供发布后检测消费", () => {
  const imported = parseImportedRuleLibrary(
    JSON.stringify({
      id: "with-statistics",
      name: "统计模板",
      version: "1.0.0",
      styles: {
        body_text: { size_pt: 12 },
      },
      keywords: {
        cn: { recommended_count_min: 3, recommended_count_max: 5 },
      },
      references: {
        minimum_count: { master: 40 },
        minimum_foreign_language_fraction: 0.3333,
      },
    }),
    [],
  );

  assert.deepEqual(imported.published.statistics, {
    keywords: { cn: { min: 3, max: 5 } },
    references: { min_count: 40, min_foreign_fraction: 0.3333 },
  });
  assert.deepEqual(imported.draft.statistics, imported.published.statistics);
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
