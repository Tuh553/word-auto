import { useState } from "react";
import {
  analyze,
  getFriendlyAnalyzeErrorMessage,
  type AnalyzeResult,
} from "../lib/analyze.js";
import {
  findFirstNavigableIssue,
  type ReportGroupBy,
  type ReportSortBy,
} from "../lib/reportGroups.js";
import type { RuleLibraryRecord } from "../lib/ruleLibraries.js";
import type { Severity } from "@word-auto/validator";

const ALL_SEVERITIES: Severity[] = ["error", "warn", "info"];

const getFirstNavigableText = (
  result: AnalyzeResult,
  active: Set<Severity>,
): string | null => {
  const firstIssue = findFirstNavigableIssue(
    result.report.issues.filter((issue) => active.has(issue.severity)),
  );
  return firstIssue ? result.model.paragraphs[firstIssue.paraIndex]?.text ?? null : null;
};

export const useDetectionFlow = () => {
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [buffer, setBuffer] = useState<ArrayBuffer | null>(null);
  const [active, setActive] = useState<Set<Severity>>(new Set(ALL_SEVERITIES));
  const [reportGroupBy, setReportGroupBy] = useState<ReportGroupBy>("section");
  const [reportSortBy, setReportSortBy] = useState<ReportSortBy>("paragraph");
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedText, setSelectedText] = useState<string | null>(null);
  const [over, setOver] = useState(false);

  const applyResult = (nextResult: AnalyzeResult, advanceToResult = false) => {
    setResult(nextResult);
    setError(null);
    setSelectedText(getFirstNavigableText(nextResult, active));
    if (advanceToResult) setStep(3);
  };

  const pickFile = async (selectedFile: File) => {
    setError(null);
    setFile(selectedFile);
    setBuffer(await selectedFile.arrayBuffer());
  };

  const runAnalysis = (publishedRules: RuleLibraryRecord["published"] | null) => {
    if (!buffer || !publishedRules) return null;
    try {
      const nextResult = analyze(buffer, publishedRules);
      applyResult(nextResult, true);
      return nextResult;
    } catch (cause) {
      setError(getFriendlyAnalyzeErrorMessage(cause));
      return null;
    }
  };

  const selectParagraph = (paragraphIndex: number) => {
    if (!result || paragraphIndex < 0) {
      setSelectedText(null);
      return;
    }
    setSelectedText(result.model.paragraphs[paragraphIndex]?.text ?? null);
  };

  const toggleSeverity = (severity: Severity) => {
    const next = new Set(active);
    if (next.has(severity)) next.delete(severity);
    else next.add(severity);
    setActive(next);
  };

  const reset = () => {
    setStep(0);
    setFile(null);
    setBuffer(null);
    setResult(null);
    setError(null);
    setSelectedText(null);
  };

  return {
    active,
    buffer,
    clearError: () => setError(null),
    error,
    file,
    over,
    reportGroupBy,
    reportSortBy,
    result,
    selectedText,
    step,
    applyResult,
    pickFile,
    reset,
    runAnalysis,
    selectParagraph,
    setOver,
    setReportGroupBy,
    setReportSortBy,
    setStep,
    toggleSeverity,
  };
};
