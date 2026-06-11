import { test } from "node:test";
import assert from "node:assert/strict";
import { lintRuleLibrary, RULE_LINT_CODES } from "./lint.js";
import type {
  EditableRuleLibrary,
  RoleRuleSet,
  RuleField,
  RuleFieldKey,
  RuleLintItem,
  RuleValue,
} from "./types.js";

const mkField = (
  key: RuleFieldKey,
  value: RuleValue,
  opts: Partial<Pick<RuleField, "enabled" | "severity" | "label">> = {},
): RuleField => ({
  key,
  label: opts.label ?? key,
  enabled: opts.enabled ?? true,
  severity: opts.severity ?? "warn",
  value,
});

const mkLib = (roles: RoleRuleSet[]): EditableRuleLibrary => ({
  id: "t",
  name: "T",
  version: "1",
  roles,
});

// 把字段挂在 body_text 下，避免触发「缺必填角色」干扰字段级断言
const body = (...fields: RuleField[]): RoleRuleSet => ({
  role: "body_text",
  label: "正文",
  fields,
});

const heading1 = (...fields: RuleField[]): RoleRuleSet => ({
  role: "heading1",
  label: "一级标题",
  fields,
});

const codes = (items: RuleLintItem[]): string[] => items.map((i) => i.code);

test("合法规则库：无 error", () => {
  const r = lintRuleLibrary(
    mkLib([
      body(
        mkField("fontFamilyCn", { mode: "exact", exact: "宋体", unit: "enum" }),
        mkField("fontSizePt", { mode: "exact", exact: 12, unit: "pt" }),
      ),
      heading1(mkField("fontSizePt", { mode: "exact", exact: 16, unit: "pt" })),
    ]),
  );
  assert.equal(r.ok, true);
  assert.equal(r.errors.length, 0);
});

test("缺必填角色正文：error", () => {
  const r = lintRuleLibrary(
    mkLib([heading1(mkField("fontSizePt", { mode: "exact", exact: 16, unit: "pt" }))]),
  );
  assert.equal(r.ok, false);
  assert.ok(codes(r.errors).includes(RULE_LINT_CODES.roleRequiredMissing));
});

test("exact 缺值：error", () => {
  const r = lintRuleLibrary(mkLib([body(mkField("fontSizePt", { mode: "exact", unit: "pt" }))]));
  assert.ok(codes(r.errors).includes(RULE_LINT_CODES.exactMissing));
});

test("类型不匹配：error", () => {
  const r = lintRuleLibrary(
    mkLib([body(mkField("fontSizePt", { mode: "exact", exact: "大号", unit: "pt" }))]),
  );
  assert.ok(codes(r.errors).includes(RULE_LINT_CODES.typeMismatch));
});

test("对齐枚举非法：error", () => {
  const r = lintRuleLibrary(
    mkLib([body(mkField("align", { mode: "exact", exact: "middle", unit: "enum" }))]),
  );
  assert.ok(codes(r.errors).includes(RULE_LINT_CODES.enumInvalid));
});

test("oneOf 空列表：error", () => {
  const r = lintRuleLibrary(
    mkLib([body(mkField("align", { mode: "oneOf", oneOf: [], unit: "enum" }))]),
  );
  assert.ok(codes(r.errors).includes(RULE_LINT_CODES.oneOfEmpty));
});

test("range 下限大于上限：error", () => {
  const r = lintRuleLibrary(
    mkLib([body(mkField("lineHeightPt", { mode: "range", min: 30, max: 18, unit: "pt" }))]),
  );
  assert.ok(codes(r.errors).includes(RULE_LINT_CODES.rangeMinMax));
});

test("range 用于非数值字段：error", () => {
  const r = lintRuleLibrary(
    mkLib([body(mkField("align", { mode: "range", min: 1, max: 2, unit: "enum" }))]),
  );
  assert.ok(codes(r.errors).includes(RULE_LINT_CODES.rangeUnit));
});

test("range 无上下限：error", () => {
  const r = lintRuleLibrary(
    mkLib([body(mkField("lineHeightPt", { mode: "range", unit: "pt" }))]),
  );
  assert.ok(codes(r.errors).includes(RULE_LINT_CODES.rangeEmpty));
});

test("启用却选不校验：warn", () => {
  const r = lintRuleLibrary(
    mkLib([body(mkField("spaceBeforePt", { mode: "unset", unit: "pt" }))]),
  );
  assert.ok(codes(r.warnings).includes(RULE_LINT_CODES.enabledButUnset));
});

test("停用字段残留值：info", () => {
  const r = lintRuleLibrary(
    mkLib([
      body(
        mkField("fontSizePt", { mode: "exact", exact: 12, unit: "pt" }),
        mkField("bold", { mode: "exact", exact: true, unit: "bool" }, { enabled: false }),
      ),
    ]),
  );
  assert.ok(codes(r.infos).includes(RULE_LINT_CODES.disabledHasValue));
});

test("正文与一级标题字号相同：warn 层级", () => {
  const r = lintRuleLibrary(
    mkLib([
      body(
        mkField("fontFamilyCn", { mode: "exact", exact: "宋体", unit: "enum" }),
        mkField("fontSizePt", { mode: "exact", exact: 14, unit: "pt" }),
      ),
      heading1(mkField("fontSizePt", { mode: "exact", exact: 14, unit: "pt" })),
    ]),
  );
  assert.ok(codes(r.warnings).includes(RULE_LINT_CODES.hierarchySizeSame));
});

test("正文未配置字体：info", () => {
  const r = lintRuleLibrary(
    mkLib([body(mkField("fontSizePt", { mode: "exact", exact: 12, unit: "pt" }))]),
  );
  assert.ok(codes(r.infos).includes(RULE_LINT_CODES.fontIncomplete));
});

test("数值超出常见范围：warn", () => {
  const r = lintRuleLibrary(
    mkLib([body(mkField("fontSizePt", { mode: "exact", exact: 200, unit: "pt" }))]),
  );
  assert.ok(codes(r.warnings).includes(RULE_LINT_CODES.outOfRange));
});

test("单位声明与字段类型不符：warn", () => {
  const r = lintRuleLibrary(
    mkLib([body(mkField("fontSizePt", { mode: "exact", exact: 12, unit: "enum" }))]),
  );
  assert.ok(codes(r.warnings).includes(RULE_LINT_CODES.unitMismatch));
});
