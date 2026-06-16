import type { RuleValue } from "./types.js";

export type Scalar = string | number | boolean;
export type ValueFormatter = (value: Scalar) => string;

export const EDITABLE_FIELD_TOLERANCE = 0.01;

export const approx = (a: number, b: number, tolerance: number): boolean =>
  Math.abs(a - b) <= tolerance;

export const preview = (text: string): string =>
  text.replace(/\s+/g, " ").trim().slice(0, 24);

export const textHasCJK = (text: string): boolean => /[一-鿿]/.test(text);
export const textHasLatin = (text: string): boolean => /[A-Za-z]/.test(text);

export const compareScalar = (
  actual: Scalar,
  expected: Scalar,
  tolerance = EDITABLE_FIELD_TOLERANCE,
): boolean => {
  if (typeof actual === "number" && typeof expected === "number") {
    return approx(actual, expected, tolerance);
  }
  return actual === expected;
};

export const matchesRuleValue = (
  ruleValue: RuleValue,
  actual: Scalar | undefined,
  tolerance = EDITABLE_FIELD_TOLERANCE,
): boolean => {
  if (ruleValue.mode === "unset") return true;
  if (actual == null) return false;
  switch (ruleValue.mode) {
    case "exact":
      return ruleValue.exact != null && compareScalar(actual, ruleValue.exact, tolerance);
    case "oneOf":
      return (ruleValue.oneOf ?? []).some((item) => compareScalar(actual, item, tolerance));
    case "range":
      if (typeof actual !== "number") return false;
      if (ruleValue.min != null && actual < ruleValue.min) return false;
      return ruleValue.max == null || actual <= ruleValue.max;
  }
};

export const describeRuleValue = (ruleValue: RuleValue, formatter: ValueFormatter): string => {
  switch (ruleValue.mode) {
    case "exact":
      return `应为 ${formatter(ruleValue.exact as Scalar)}`;
    case "oneOf":
      return `应为以下之一：${(ruleValue.oneOf ?? []).map(formatter).join(" / ")}`;
    case "range":
      if (ruleValue.min != null && ruleValue.max != null) {
        return `应在 ${formatter(ruleValue.min)} ~ ${formatter(ruleValue.max)} 范围内`;
      }
      if (ruleValue.min != null) return `应不小于 ${formatter(ruleValue.min)}`;
      return `应不大于 ${formatter(ruleValue.max as number)}`;
    case "unset":
      return "不校验";
  }
};
