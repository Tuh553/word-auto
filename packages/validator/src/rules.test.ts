import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isEditableRuleLibrary,
  normalizeRuleLibrary,
  toLegacyRuleLibrary,
} from "./rules.js";
import type {
  EditableRuleLibrary,
  LegacyRuleLibrary,
  RoleRuleSet,
  RuleField,
} from "./types.js";

const legacy: LegacyRuleLibrary = {
  meta: { name: "Test Rules", version: "1.0.0" },
  document: { paper_size: "A4", margin_top_cm: 3 },
  page_numbers: {
    front_matter_format: "RomanUpper",
    body_format: "Arabic",
    body_restart_at: 1,
    alignment: "center",
    font_latin: "Times New Roman",
    size_pt: 9,
  },
  headers: {
    left_text: "测试页眉",
    font_east_asia: "宋体",
    font_latin: "Times New Roman",
    size_pt: 10.5,
    bottom_border: true,
  },
  styles: {
    body_text: {
      font_east_asia: "宋体",
      font_latin: "Times New Roman",
      size_pt: 12,
      bold: false,
      alignment: "justify",
      first_line_indent_chars: 2,
    },
    heading1: { font_east_asia: "黑体", size_pt: 16, alignment: "center" },
  },
};

const findField = (
  roles: RoleRuleSet[],
  role: string,
  key: string,
): RuleField | undefined =>
  roles.find((r) => r.role === role)?.fields.find((f) => f.key === key);

const compactObject = <T extends object>(input: T | undefined): Partial<T> =>
  Object.fromEntries(
    Object.entries(input ?? {}).filter(([, value]) => value !== undefined),
  ) as Partial<T>;

test("isEditableRuleLibrary 区分新旧结构", () => {
  const editable = normalizeRuleLibrary(legacy);
  assert.equal(isEditableRuleLibrary(editable), true);
  assert.equal(isEditableRuleLibrary(legacy), false);
  assert.equal(isEditableRuleLibrary(null), false);
  assert.equal(isEditableRuleLibrary({}), false);
});

test("normalizeRuleLibrary 旧结构转可编辑结构", () => {
  const lib = normalizeRuleLibrary(legacy);
  assert.equal(lib.id, "test-rules");
  assert.equal(lib.name, "Test Rules");
  assert.equal(lib.version, "1.0.0");
  assert.deepEqual(compactObject(lib.document), legacy.document);
  assert.deepEqual(lib.pageNumbers, legacy.page_numbers);
  assert.deepEqual(lib.headers, legacy.headers);
  assert.equal(lib.roles.length, 2);

  const cnFont = findField(lib.roles, "body_text", "fontFamilyCn");
  assert.equal(cnFont?.enabled, true);
  assert.equal(cnFont?.value.mode, "exact");
  assert.equal(cnFont?.value.exact, "宋体");
  assert.equal(cnFont?.value.unit, "enum");
  assert.equal(cnFont?.severity, "error");

  const size = findField(lib.roles, "body_text", "fontSizePt");
  assert.equal(size?.value.exact, 12);
  assert.equal(size?.severity, "error");

  const indent = findField(lib.roles, "body_text", "firstLineIndentChars");
  assert.equal(indent?.value.exact, 2);
  assert.equal(indent?.value.unit, "chars");
});

test("normalizeRuleLibrary 对已是可编辑结构原样返回", () => {
  const editable = normalizeRuleLibrary(legacy);
  assert.equal(normalizeRuleLibrary(editable), editable);
});

test("toLegacyRuleLibrary round-trip 保留核心字段", () => {
  const back = toLegacyRuleLibrary(normalizeRuleLibrary(legacy));
  assert.equal(back.meta?.name, "Test Rules");
  assert.deepEqual(compactObject(back.document), legacy.document);
  assert.deepEqual(back.page_numbers, legacy.page_numbers);
  assert.deepEqual(back.headers, legacy.headers);
  assert.equal(back.styles.body_text.font_east_asia, "宋体");
  assert.equal(back.styles.body_text.size_pt, 12);
  assert.equal(back.styles.body_text.first_line_indent_chars, 2);
  assert.equal(back.styles.heading1.alignment, "center");
});

test("toLegacyRuleLibrary 按字段模式与启用状态取值", () => {
  const editable: EditableRuleLibrary = {
    id: "x",
    name: "X",
    version: "1",
    roles: [
      {
        role: "body_text",
        label: "正文",
        fields: [
          { key: "fontSizePt", label: "字号", enabled: true, severity: "error", value: { mode: "exact", exact: 12, unit: "pt" } },
          { key: "align", label: "对齐", enabled: true, severity: "warn", value: { mode: "oneOf", oneOf: ["left", "justify"], unit: "enum" } },
          { key: "lineHeightPt", label: "行距", enabled: true, severity: "warn", value: { mode: "range", min: 18, max: 22, unit: "pt" } },
          { key: "spaceBeforePt", label: "段前", enabled: true, severity: "warn", value: { mode: "unset", unit: "pt" } },
          { key: "bold", label: "加粗", enabled: false, severity: "warn", value: { mode: "exact", exact: true, unit: "bool" } },
        ],
      },
    ],
  };
  const bt = toLegacyRuleLibrary(editable).styles.body_text;
  assert.equal(bt.size_pt, 12); // exact + 启用 → 保留
  assert.equal(bt.alignment, undefined); // oneOf → 不还原
  assert.equal(bt.line_spacing_pt, undefined); // range → 不还原
  assert.equal(bt.spacing_before_pt, undefined); // unset → 不还原
  assert.equal(bt.bold, undefined); // 停用 → 不还原
});

test("toLegacyRuleLibrary 对旧结构直接透传", () => {
  assert.equal(toLegacyRuleLibrary(legacy), legacy);
});
