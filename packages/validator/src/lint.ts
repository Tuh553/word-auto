import type {
  EditableRuleLibrary,
  RoleRuleSet,
  RuleField,
  RuleFieldKey,
  RuleLintItem,
  RuleLintLevel,
  RuleLintResult,
  RuleValue,
  RuleValueUnit,
} from "./types.js";

/** 规则合法性问题码：前端可据此做字段定位、特定提示或跳转 */
export const RULE_LINT_CODES = {
  exactMissing: "FIELD_EXACT_MISSING",
  typeMismatch: "FIELD_TYPE_MISMATCH",
  enumInvalid: "FIELD_ENUM_INVALID",
  oneOfEmpty: "FIELD_ONEOF_EMPTY",
  unitMismatch: "FIELD_UNIT_MISMATCH",
  rangeUnit: "FIELD_RANGE_UNIT",
  rangeEmpty: "FIELD_RANGE_EMPTY",
  rangeMinMax: "FIELD_RANGE_MINMAX",
  outOfRange: "FIELD_OUT_OF_RANGE",
  enabledButUnset: "FIELD_ENABLED_BUT_UNSET",
  disabledHasValue: "FIELD_DISABLED_HAS_VALUE",
  roleRequiredMissing: "ROLE_REQUIRED_MISSING",
  hierarchySizeSame: "HIERARCHY_SIZE_SAME",
  fontIncomplete: "FONT_INCOMPLETE",
} as const;

// 字段 → 权威单位。以 key 推导，不信任 value.unit（脏数据可能绕过类型校验）
const FIELD_UNIT: Record<RuleFieldKey, RuleValueUnit> = {
  fontFamilyCn: "enum",
  fontFamilyLatin: "enum",
  fontSizePt: "pt",
  bold: "bool",
  align: "enum",
  lineHeightPt: "pt",
  spaceBeforePt: "pt",
  spaceAfterPt: "pt",
  firstLineIndentChars: "chars",
  hangingIndentChars: "chars",
  leftIndentChars: "chars",
  outlineLevel: "level",
};

// align 为受限枚举（对应 validate.ts 归一词汇）；字体虽也是 enum 但属自由文本，不校验集合
const ALIGN_VALUES = ["left", "center", "right", "justify"];
const FONT_FIELDS: RuleFieldKey[] = ["fontFamilyCn", "fontFamilyLatin"];

// 仅数值类单位可用 range 模式、可谈合理范围
const NUMERIC_UNITS: RuleValueUnit[] = ["pt", "chars", "level"];

// 数值「常见范围」软约束：超出只给 warn（挡明显笔误，不阻断发布）。
// outlineLevel 因正文约定用 10（见规则库 JSON），不设范围以免误报。
const SANE_RANGE: Partial<Record<RuleFieldKey, { min: number; max: number }>> = {
  fontSizePt: { min: 5, max: 72 },
  lineHeightPt: { min: 1, max: 200 },
  spaceBeforePt: { min: 0, max: 200 },
  spaceAfterPt: { min: 0, max: 200 },
  firstLineIndentChars: { min: 0, max: 10 },
  hangingIndentChars: { min: 0, max: 10 },
  leftIndentChars: { min: 0, max: 10 },
};

/** 必填角色：缺失即 error（规则库至少要能校验正文） */
const REQUIRED_ROLES: Array<{ role: string; label: string }> = [
  { role: "body_text", label: "正文" },
];

const isNum = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

/** 值类型是否与字段单位匹配 */
const matchesUnit = (unit: RuleValueUnit, v: unknown): boolean => {
  if (unit === "bool") return typeof v === "boolean";
  if (NUMERIC_UNITS.includes(unit)) return isNum(v);
  return typeof v === "string"; // enum：字体自由文本 / align 受限值
};

const hasSubstantiveValue = (v: RuleValue): boolean =>
  v.exact != null ||
  (Array.isArray(v.oneOf) && v.oneOf.length > 0) ||
  v.min != null ||
  v.max != null;

const findField = (
  roleSet: RoleRuleSet | undefined,
  key: RuleFieldKey,
): RuleField | undefined => roleSet?.fields.find((f) => f.key === key);

const enabledExactNumber = (
  roleSet: RoleRuleSet | undefined,
  key: RuleFieldKey,
): number | undefined => {
  const f = findField(roleSet, key);
  if (!f || !f.enabled || f.value.mode !== "exact") return undefined;
  return isNum(f.value.exact) ? f.value.exact : undefined;
};

type Emit = (level: RuleLintLevel, code: string, message: string) => void;

/** 校验单个「已启用」字段的规则值（结构 + 一致性 + 合理范围） */
const lintFieldValue = (field: RuleField, emit: Emit): void => {
  const unit = FIELD_UNIT[field.key];
  const v = field.value;
  const label = field.label;

  // 声明单位与字段类型不符（脏数据）
  if (v.unit != null && v.unit !== unit) {
    emit("warn", RULE_LINT_CODES.unitMismatch,
      `「${label}」的单位「${v.unit}」与字段类型不符（应为「${unit}」）`);
  }

  const checkSane = (value: number): void => {
    const range = SANE_RANGE[field.key];
    if (range && (value < range.min || value > range.max)) {
      emit("warn", RULE_LINT_CODES.outOfRange,
        `「${label}」的值 ${value} 超出常见范围 ${range.min}~${range.max}，请确认`);
    }
  };
  const checkAlign = (value: unknown): void => {
    if (field.key === "align" && !ALIGN_VALUES.includes(value as string)) {
      emit("error", RULE_LINT_CODES.enumInvalid,
        `「${label}」的值「${value}」不是合法对齐方式（${ALIGN_VALUES.join(" / ")}）`);
    }
  };

  switch (v.mode) {
    case "unset":
      emit("warn", RULE_LINT_CODES.enabledButUnset,
        `「${label}」已启用校验，但规则方式为「不校验」，请改用具体规则或停用该字段`);
      break;

    case "exact": {
      const ex = v.exact;
      if (ex == null || (typeof ex === "string" && ex.trim() === "")) {
        emit("error", RULE_LINT_CODES.exactMissing,
          `「${label}」选择了精确值，但未填写规则值`);
        break;
      }
      if (!matchesUnit(unit, ex)) {
        emit("error", RULE_LINT_CODES.typeMismatch,
          `「${label}」的规则值类型与字段不匹配`);
        break;
      }
      checkAlign(ex);
      if (isNum(ex)) checkSane(ex);
      break;
    }

    case "oneOf": {
      const list = v.oneOf;
      if (!Array.isArray(list) || list.length === 0) {
        emit("error", RULE_LINT_CODES.oneOfEmpty,
          `「${label}」选择了候选值之一，但候选列表为空`);
        break;
      }
      for (const item of list) {
        if (!matchesUnit(unit, item)) {
          emit("error", RULE_LINT_CODES.typeMismatch,
            `「${label}」的候选值「${item}」类型与字段不匹配`);
          continue;
        }
        checkAlign(item);
        if (isNum(item)) checkSane(item);
      }
      break;
    }

    case "range": {
      if (!NUMERIC_UNITS.includes(unit)) {
        emit("error", RULE_LINT_CODES.rangeUnit,
          `「${label}」是非数值字段，不能使用「范围」方式`);
        break;
      }
      const { min, max } = v;
      if (min == null && max == null) {
        emit("error", RULE_LINT_CODES.rangeEmpty,
          `「${label}」选择了范围，但未填写上下限`);
        break;
      }
      if (min != null && !isNum(min)) {
        emit("error", RULE_LINT_CODES.typeMismatch, `「${label}」范围下限不是有效数值`);
      }
      if (max != null && !isNum(max)) {
        emit("error", RULE_LINT_CODES.typeMismatch, `「${label}」范围上限不是有效数值`);
      }
      if (isNum(min) && isNum(max) && min > max) {
        emit("error", RULE_LINT_CODES.rangeMinMax,
          `「${label}」范围下限 ${min} 大于上限 ${max}`);
      }
      if (isNum(min)) checkSane(min);
      if (isNum(max)) checkSane(max);
      break;
    }
  }
};

/** 遍历一个角色下的全部字段 */
const lintRole = (roleSet: RoleRuleSet, out: RuleLintItem[]): void => {
  for (const field of roleSet.fields) {
    const emit: Emit = (level, code, message) =>
      out.push({ level, code, message, role: roleSet.role, field: field.key });

    if (!field.enabled) {
      // 停用字段不参与校验；仅在残留实质值时提示清理
      if (field.value.mode !== "unset" && hasSubstantiveValue(field.value)) {
        emit("info", RULE_LINT_CODES.disabledHasValue,
          `「${field.label}」已停用，但仍保留规则值，可清理`);
      }
      continue;
    }
    lintFieldValue(field, emit);
  }
};

/** 库级业务提示（PRD §8.3）：必填角色、层级区分、字体完整性 */
const lintLibraryLevel = (lib: EditableRuleLibrary, out: RuleLintItem[]): void => {
  const byRole = new Map(lib.roles.map((r) => [r.role, r]));

  for (const { role, label } of REQUIRED_ROLES) {
    if (!byRole.has(role)) {
      out.push({
        level: "error",
        code: RULE_LINT_CODES.roleRequiredMissing,
        role,
        message: `缺少必填角色「${label}」`,
      });
    }
  }

  // 正文与一级标题字号相同 → 层级区分不足
  const bodySize = enabledExactNumber(byRole.get("body_text"), "fontSizePt");
  const h1Size = enabledExactNumber(byRole.get("heading1"), "fontSizePt");
  if (bodySize != null && h1Size != null && bodySize === h1Size) {
    out.push({
      level: "warn",
      code: RULE_LINT_CODES.hierarchySizeSame,
      role: "heading1",
      field: "fontSizePt",
      message: `一级标题字号与正文相同（${bodySize}pt），可能缺乏层级区分`,
    });
  }

  // 正文中、西文字体都未启用 → 字体检测可能不稳定
  const body = byRole.get("body_text");
  if (body && !FONT_FIELDS.some((k) => findField(body, k)?.enabled)) {
    out.push({
      level: "info",
      code: RULE_LINT_CODES.fontIncomplete,
      role: "body_text",
      message: "正文未配置中文/西文字体，字体检测可能不稳定",
    });
  }
};

/**
 * 规则合法性校验：对规则库「配置本身」做静态检查（结构 / 一致性 / 业务提示），
 * 不依赖真实 .docx。只有 errors 为空才视为可发布（warn / info 不阻断）。
 */
export const lintRuleLibrary = (lib: EditableRuleLibrary): RuleLintResult => {
  const items: RuleLintItem[] = [];
  for (const roleSet of lib.roles) lintRole(roleSet, items);
  lintLibraryLevel(lib, items);

  const errors = items.filter((i) => i.level === "error");
  const warnings = items.filter((i) => i.level === "warn");
  const infos = items.filter((i) => i.level === "info");
  return { ok: errors.length === 0, errors, warnings, infos };
};
