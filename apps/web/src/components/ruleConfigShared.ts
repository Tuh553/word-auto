import type {
  RuleField,
  RuleFieldSeverity,
  RuleValue,
} from "@word-auto/validator";

export const MODE_LABEL: Record<RuleValue["mode"], string> = {
  exact: "精确值",
  oneOf: "候选之一",
  range: "范围",
  unset: "不校验",
};

export const SEV_LABEL: Record<RuleFieldSeverity, string> = {
  error: "错误",
  warn: "警告",
  info: "提示",
};

export const RULE_SECTION_LABEL = {
  document: "页面设置",
  pageNumbers: "页码规则",
  headers: "页眉规则",
  roles: "段落角色",
} as const;

export const ALIGN_OPTIONS = ["left", "center", "right", "justify"] as const;
export const VALUE_LABELS: Record<string, string> = {
  left: "左对齐",
  center: "居中",
  right: "右对齐",
  justify: "两端对齐",
  left_with_right_tab: "左文右码",
  RomanUpper: "大写罗马数字",
  RomanLower: "小写罗马数字",
  Arabic: "阿拉伯数字",
};
export const BOOL_OPTIONS = [
  { label: "是", value: true },
  { label: "否", value: false },
] as const;
export const FONT_SUGGESTIONS = [
  "宋体",
  "黑体",
  "仿宋",
  "楷体",
  "Times New Roman",
  "Arial",
  "Calibri",
];

const unitText = (unit?: string): string =>
  unit === "pt" ? " pt" : unit === "chars" ? " 字符" : unit === "level" ? " 级" : "";

const formatScalar = (value: unknown): string => {
  if (typeof value === "boolean") return value ? "是" : "否";
  if (typeof value === "string") return VALUE_LABELS[value] ?? value;
  return value == null ? "—" : String(value);
};

const formatRawScalar = (value: unknown): string => {
  if (typeof value === "boolean") return value ? "是" : "否";
  return value == null ? "" : String(value);
};

export const formatRuleValue = (value: RuleValue): string => {
  switch (value.mode) {
    case "exact":
      return `${formatScalar(value.exact)}${unitText(value.unit)}`;
    case "oneOf":
      return (value.oneOf ?? []).map(formatScalar).join(" / ") || "（空）";
    case "range":
      return `${value.min ?? "?"} ~ ${value.max ?? "?"}${unitText(value.unit)}`;
    case "unset":
      return "不校验";
  }
};

const isNumericUnit = (unit?: string): boolean =>
  unit === "pt" || unit === "chars" || unit === "level";

export const parseScalarValue = (
  raw: string,
  unit?: string,
): string | number | boolean => {
  const text = raw.trim();
  if (unit === "bool") {
    if (["true", "1", "是", "yes"].includes(text.toLowerCase())) return true;
    if (["false", "0", "否", "no"].includes(text.toLowerCase())) return false;
    return text;
  }
  if (isNumericUnit(unit)) {
    const num = Number(text);
    return Number.isFinite(num) ? num : text;
  }
  return text;
};

export const formatDateTime = (value?: string): string =>
  value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "未保存";

export const modesForField = (field: RuleField): RuleValue["mode"][] =>
  isNumericUnit(field.value.unit)
    ? ["exact", "oneOf", "range", "unset"]
    : ["exact", "oneOf", "unset"];

export const nextValueForMode = (
  field: RuleField,
  mode: RuleValue["mode"],
): RuleValue => {
  const unit = field.value.unit;
  const exactFromCurrent =
    field.value.exact
    ?? field.value.oneOf?.[0]
    ?? field.value.min
    ?? (unit === "bool" ? false : undefined);

  switch (mode) {
    case "exact":
      return { mode, unit, exact: exactFromCurrent };
    case "oneOf":
      return {
        mode,
        unit,
        oneOf: field.value.oneOf ?? (exactFromCurrent != null ? [exactFromCurrent] : []),
      };
    case "range":
      return {
        mode,
        unit,
        min: typeof exactFromCurrent === "number" ? exactFromCurrent : field.value.min,
        max: typeof exactFromCurrent === "number" ? exactFromCurrent : field.value.max,
      };
    case "unset":
      return { mode, unit };
  }
};

export const formatOneOfList = (field: RuleField): string =>
  (field.value.oneOf ?? []).map((item) => formatRawScalar(item)).join(", ");
