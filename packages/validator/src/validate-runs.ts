import type { Paragraph } from "@word-auto/parser";
import type { Issue, Role, RuleField } from "./types.js";
import {
  compareScalar,
  describeRuleValue,
  matchesRuleValue,
  preview,
  type Scalar,
  type ValueFormatter,
} from "./validate-style-utils.js";

type RunValueSelector = (run: Paragraph["runs"][number]) => Scalar | undefined;
type RunTextPredicate = (text: string) => boolean;

interface RunIssueContext {
  para: Paragraph;
  role: Role;
  provenance?: string;
}

interface ComparableRun {
  index: number;
  text: string;
  actual: Scalar;
}

interface RunIssueGroup {
  startIndex: number;
  endIndex: number;
  text: string;
  actual: Scalar;
}

interface EditableRunFieldCheck {
  context: RunIssueContext;
  field: RuleField;
  fieldName: string;
  acceptsText: RunTextPredicate;
  selectValue: RunValueSelector;
  formatter: ValueFormatter;
  tolerance?: number;
}

interface LegacyRunMessageArgs {
  expected: Scalar;
  actual: Scalar;
  range: string;
  text: string;
}

interface LegacyRunFieldCheck {
  context: RunIssueContext;
  fieldName: string;
  expected?: Scalar;
  acceptsText: RunTextPredicate;
  selectValue: RunValueSelector;
  message: (args: LegacyRunMessageArgs) => string;
}

const collectComparableRuns = ({
  para,
  acceptsText,
  selectValue,
}: {
  para: Paragraph;
  acceptsText: RunTextPredicate;
  selectValue: RunValueSelector;
}): ComparableRun[] =>
  para.runs
    .map((run, index) => ({
      index,
      text: run.text,
      actual: selectValue(run),
    }))
    .filter((item): item is ComparableRun =>
      item.text.trim().length > 0 &&
      acceptsText(item.text) &&
      item.actual !== undefined,
    );

const buildRunIssueGroups = (
  runs: ComparableRun[],
  isIssue: (run: ComparableRun) => boolean,
): RunIssueGroup[] => {
  const groups: RunIssueGroup[] = [];
  for (const run of runs) {
    if (!isIssue(run)) continue;
    const last = groups.at(-1);
    if (last && last.endIndex + 1 === run.index && compareScalar(last.actual, run.actual)) {
      last.endIndex = run.index;
      last.text += run.text;
      continue;
    }
    groups.push({
      startIndex: run.index,
      endIndex: run.index,
      text: run.text,
      actual: run.actual,
    });
  }
  return groups;
};

const describeRunRange = (group: RunIssueGroup): string =>
  group.startIndex === group.endIndex
    ? `第 ${group.startIndex + 1} 个文本片段`
    : `第 ${group.startIndex + 1}-${group.endIndex + 1} 个文本片段`;

const createRunIssue = ({
  context,
  field,
  expected,
  actual,
  severity,
  message,
  group,
}: {
  context: RunIssueContext;
  field: string;
  expected: unknown;
  actual: unknown;
  severity: Issue["severity"];
  message: string;
  group: RunIssueGroup;
}): Issue => ({
  paraIndex: context.para.index,
  role: context.role,
  field,
  expected,
  actual,
  severity,
  message,
  textPreview: preview(group.text),
  startRunIndex: group.startIndex,
  endRunIndex: group.endIndex,
  affectedText: group.text,
  provenance: context.provenance,
});

export const checkEditableRunField = ({
  context,
  field,
  fieldName,
  acceptsText,
  selectValue,
  formatter,
  tolerance,
}: EditableRunFieldCheck): Issue[] | undefined => {
  if (!field.enabled || field.value.mode === "unset") return [];
  const runs = collectComparableRuns({ para: context.para, acceptsText, selectValue });
  if (runs.length === 0) return undefined;

  return buildRunIssueGroups(
    runs,
    (run) => !matchesRuleValue(field.value, run.actual, tolerance),
  ).map((group) => createRunIssue({
    context,
    field: fieldName,
    expected: field.value,
    actual: group.actual,
    severity: field.severity,
    message: `${describeRunRange(group)}「${group.text}」${field.label}${describeRuleValue(field.value, formatter)}，实际 ${formatter(group.actual)}`,
    group,
  }));
};

export const checkLegacyRunField = ({
  context,
  fieldName,
  expected,
  acceptsText,
  selectValue,
  message,
}: LegacyRunFieldCheck): Issue[] | undefined => {
  if (expected == null) return [];
  const runs = collectComparableRuns({ para: context.para, acceptsText, selectValue });
  if (runs.length === 0) return undefined;

  return buildRunIssueGroups(
    runs,
    (run) => !compareScalar(run.actual, expected),
  ).map((group) => createRunIssue({
    context,
    field: fieldName,
    expected,
    actual: group.actual,
    severity: "error",
    message: message({
      expected,
      actual: group.actual,
      range: describeRunRange(group),
      text: group.text,
    }),
    group,
  }));
};
