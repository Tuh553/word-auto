import { useRef, useState } from "react";
import {
  getFriendlyAnalyzeErrorMessage,
  type AnalyzeResult,
} from "../lib/analyze.js";
import { analyzeInWorker } from "../lib/analyzeWorkerClient.js";
import {
  buildPreviewHighlightTarget,
  buildPreviewIssueTargets,
  findIssueByKey,
  findFirstNavigableIssue,
  getIssueKey,
  resolveSelectedIssue,
  type ReportGroupBy,
  type ReportSortBy,
} from "../lib/reportGroups.js";
import type { PreviewHighlightTarget } from "../lib/previewHighlight.js";
import type { RuleLibraryRecord } from "../lib/ruleLibraries.js";
import type { Severity } from "@word-auto/validator";

const ALL_SEVERITIES: Severity[] = ["error", "warn", "info"];
const REPORT_SCROLL_SUPPRESSION_MS = 400;

type SelectionSource = "report-click" | "preview-click" | "preview-scroll";

type RunAnalysisOptions = {
  advanceToResult?: boolean;
};

type AnalysisRunnerParams = {
  buffer: ArrayBuffer | null;
  applyResult: (nextResult: AnalyzeResult, advanceToResult?: boolean) => void;
  setError: (message: string | null) => void;
};

const getFirstNavigablePreviewTarget = (
  result: AnalyzeResult,
  active: Set<Severity>,
): PreviewHighlightTarget | null => {
  const firstIssue = findFirstNavigableIssue(
    result.report.issues.filter((issue) => active.has(issue.severity)),
  );
  return buildPreviewHighlightTarget(firstIssue, result.model.paragraphs);
};

const getIssuePreviewTarget = (
  result: AnalyzeResult,
  issueKey: string | null,
): PreviewHighlightTarget | null => {
  const issue = findIssueByKey(result.report.issues, issueKey);
  return buildPreviewHighlightTarget(issue, result.model.paragraphs);
};

const getVisibleIssues = (
  result: AnalyzeResult,
  active: Set<Severity>,
) => result.report.issues.filter((issue) => active.has(issue.severity));

const useIssueSelection = () => {
  const [selectedIssueKey, setSelectedIssueKey] = useState<string | null>(null);
  const [selectedPreviewTarget, setSelectedPreviewTarget] =
    useState<PreviewHighlightTarget | null>(null);
  const [shouldScrollSelectedPreviewTarget, setShouldScrollSelectedPreviewTarget] =
    useState(false);
  const [suppressScrollSelectionUntil, setSuppressScrollSelectionUntil] = useState(0);

  const clearSelection = () => {
    setSelectedIssueKey(null);
    setSelectedPreviewTarget(null);
    setShouldScrollSelectedPreviewTarget(false);
    setSuppressScrollSelectionUntil(0);
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
    setSelectedPreviewTarget(
      issueKey
        ? getIssuePreviewTarget(result, issueKey)
        : getFirstNavigablePreviewTarget(result, active),
    );
    setShouldScrollSelectedPreviewTarget(true);
  };

  const selectIssue = (result: AnalyzeResult | null, issueKey: string | null) => {
    if (!result || !issueKey) {
      clearSelection();
      return;
    }
    setSelectedIssueKey(issueKey);
    setSelectedPreviewTarget(getIssuePreviewTarget(result, issueKey));
    setShouldScrollSelectedPreviewTarget(true);
  };

  const selectIssueFromSource = (
    result: AnalyzeResult | null,
    issueKey: string | null,
    source: SelectionSource,
  ) => {
    if (!result || !issueKey) {
      clearSelection();
      return;
    }
    if (source === "preview-scroll" && issueKey === selectedIssueKey) return;
    setSelectedIssueKey(issueKey);
    setSelectedPreviewTarget(getIssuePreviewTarget(result, issueKey));
    setShouldScrollSelectedPreviewTarget(source === "report-click");
    if (source === "report-click") {
      setSuppressScrollSelectionUntil(Date.now() + REPORT_SCROLL_SUPPRESSION_MS);
      return;
    }
    setSuppressScrollSelectionUntil(0);
  };

  return {
    clearSelection,
    selectIssue,
    selectIssueFromSource,
    selectResolvedIssue,
    selectedIssueKey,
    selectedPreviewTarget,
    shouldScrollSelectedPreviewTarget,
    suppressScrollSelectionUntil,
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
    selection.selectIssueFromSource(result, issueKey, "report-click");
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
    selectedPreviewTarget: selection.selectedPreviewTarget,
    shouldScrollSelectedPreviewTarget: selection.shouldScrollSelectedPreviewTarget,
    suppressScrollSelectionUntil: selection.suppressScrollSelectionUntil,
    step,
    applyResult,
    pickFile,
    reset,
    runAnalysis,
    selectIssue,
    selectIssueFromSource: selection.selectIssueFromSource,
    setOver,
    setReportGroupBy,
    setReportSortBy,
    setStep,
    toggleSeverity,
  };
};
