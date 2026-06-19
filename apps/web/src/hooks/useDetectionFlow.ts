import { useRef, useState } from "react";
import {
  getFriendlyAnalyzeErrorMessage,
  type AnalyzeResult,
} from "../lib/analyze.js";
import { analyzeInWorker } from "../lib/analyzeWorkerClient.js";
import {
  findFirstNavigableIssue,
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
  const [selectedText, setSelectedText] = useState<string | null>(null);
  const [over, setOver] = useState(false);

  const applyResult = (nextResult: AnalyzeResult, advanceToResult = false) => {
    setResult(nextResult);
    setError(null);
    setSelectedText(getFirstNavigableText(nextResult, active));
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
    invalidateAnalysis();
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
    isAnalyzing,
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
