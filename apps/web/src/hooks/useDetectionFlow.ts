import { useRef, useState } from "react";
import {
  getFriendlyAnalyzeErrorMessage,
  type AnalyzeResult,
} from "../lib/analyze.js";
import { analyzeInWorker } from "../lib/analyzeWorkerClient.js";
import {
  buildPreviewIssueTargets,
  findIssueByKey,
  findFirstNavigableIssue,
  getIssueKey,
  resolveSelectedIssue,
  type ReportGroupBy,
  type ReportSortBy,
} from "../lib/reportGroups.js";
import type { RuleLibraryRecord } from "../lib/ruleLibraries.js";
import type { Severity } from "@word-auto/validator";

const ALL_SEVERITIES: Severity[] = ["error", "warn", "info"];

type RunAnalysisOptions = {
  advanceToResult?: boolean;
};

type AnalysisRunnerParams = {
  buffer: ArrayBuffer | null;
  applyResult: (nextResult: AnalyzeResult, advanceToResult?: boolean) => void;
  setError: (message: string | null) => void;
};

const getFirstNavigableText = (
  result: AnalyzeResult,
  active: Set<Severity>,
): string | null => {
  const firstIssue = findFirstNavigableIssue(
    result.report.issues.filter((issue) => active.has(issue.severity)),
  );
  return firstIssue ? result.model.paragraphs[firstIssue.paraIndex]?.text ?? null : null;
};

const getIssueText = (
  result: AnalyzeResult,
  issueKey: string | null,
): string | null => {
  const issue = findIssueByKey(result.report.issues, issueKey);
  if (!issue || issue.paraIndex < 0) return null;
  return result.model.paragraphs[issue.paraIndex]?.text ?? null;
};

const getVisibleIssues = (
  result: AnalyzeResult,
  active: Set<Severity>,
) => result.report.issues.filter((issue) => active.has(issue.severity));

const useIssueSelection = () => {
  const [selectedIssueKey, setSelectedIssueKey] = useState<string | null>(null);
  const [selectedText, setSelectedText] = useState<string | null>(null);

  const clearSelection = () => {
    setSelectedIssueKey(null);
    setSelectedText(null);
  };

  const selectResolvedIssue = (
    result: AnalyzeResult,
    active: Set<Severity>,
    preferredIssueKey = selectedIssueKey,
  ) => {
    const selectedIssue = resolveSelectedIssue(
      getVisibleIssues(result, active),
      preferredIssueKey,
    );
    const issueKey = selectedIssue ? getIssueKey(selectedIssue) : null;
    setSelectedIssueKey(issueKey);
    setSelectedText(
      issueKey ? getIssueText(result, issueKey) : getFirstNavigableText(result, active),
    );
  };

  const selectIssue = (result: AnalyzeResult | null, issueKey: string | null) => {
    if (!result || !issueKey) {
      clearSelection();
      return;
    }
    setSelectedIssueKey(issueKey);
    setSelectedText(getIssueText(result, issueKey));
  };

  return {
    clearSelection,
    selectIssue,
    selectResolvedIssue,
    selectedIssueKey,
    selectedText,
  };
};

const useAnalysisRunner = ({
  buffer,
  applyResult,
  setError,
}: AnalysisRunnerParams) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const runIdRef = useRef(0);
  const isAnalyzingRef = useRef(false);

  const invalidateAnalysis = () => {
    runIdRef.current++;
    isAnalyzingRef.current = false;
    setIsAnalyzing(false);
  };

  const runAnalysis = async (
    publishedRules: RuleLibraryRecord["published"] | null,
    options: RunAnalysisOptions = {},
  ) => {
    if (!buffer || !publishedRules || isAnalyzingRef.current) return null;
    const runId = ++runIdRef.current;
    isAnalyzingRef.current = true;
    setIsAnalyzing(true);
    setError(null);
    try {
      const nextResult = await analyzeInWorker(buffer, publishedRules);
      if (runId !== runIdRef.current) return null;
      applyResult(nextResult, options.advanceToResult ?? true);
      return nextResult;
    } catch (cause) {
      if (runId !== runIdRef.current) return null;
      setError(getFriendlyAnalyzeErrorMessage(cause));
      return null;
    } finally {
      if (runId === runIdRef.current) {
        isAnalyzingRef.current = false;
        setIsAnalyzing(false);
      }
    }
  };

  return { invalidateAnalysis, isAnalyzing, runAnalysis };
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
  const selection = useIssueSelection();
  const [over, setOver] = useState(false);

  const applyResult = (nextResult: AnalyzeResult, advanceToResult = false) => {
    setResult(nextResult);
    setError(null);
    selection.selectResolvedIssue(nextResult, active);
    if (advanceToResult) setStep(3);
  };

  const { invalidateAnalysis, isAnalyzing, runAnalysis } = useAnalysisRunner({
    applyResult,
    buffer,
    setError,
  });

  const pickFile = async (selectedFile: File) => {
    invalidateAnalysis();
    setError(null);
    setFile(selectedFile);
    setBuffer(await selectedFile.arrayBuffer());
  };

  const selectIssue = (issueKey: string | null) => {
    selection.selectIssue(result, issueKey);
  };

  const toggleSeverity = (severity: Severity) => {
    const next = new Set(active);
    if (next.has(severity)) next.delete(severity);
    else next.add(severity);
    setActive(next);
    if (result) selection.selectResolvedIssue(result, next, selection.selectedIssueKey);
  };

  const reset = () => {
    invalidateAnalysis();
    setStep(0);
    setFile(null);
    setBuffer(null);
    setResult(null);
    setError(null);
    selection.clearSelection();
  };

  const previewIssueTargets = result
    ? buildPreviewIssueTargets(getVisibleIssues(result, active), result.model.paragraphs)
    : [];

  return {
    active,
    buffer,
    clearError: () => setError(null),
    error,
    file,
    isAnalyzing,
    over,
    reportGroupBy,
    reportSortBy,
    result,
    previewIssueTargets,
    selectedIssueKey: selection.selectedIssueKey,
    selectedText: selection.selectedText,
    step,
    applyResult,
    pickFile,
    reset,
    runAnalysis,
    selectIssue,
    setOver,
    setReportGroupBy,
    setReportSortBy,
    setStep,
    toggleSeverity,
  };
};
