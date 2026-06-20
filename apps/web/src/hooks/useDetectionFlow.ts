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
  const visibleIssues = result.report.issues.filter((issue) => active.has(issue.severity));
  const firstIssue = findFirstNavigableIssue(visibleIssues);
  return buildPreviewHighlightTarget(firstIssue, result.model.paragraphs, visibleIssues);
};

const getIssuePreviewTarget = (
  result: AnalyzeResult,
  issueKey: string | null,
  visibleIssues: AnalyzeResult["report"]["issues"],
): PreviewHighlightTarget | null => {
  const issue = findIssueByKey(result.report.issues, issueKey);
  return buildPreviewHighlightTarget(issue, result.model.paragraphs, visibleIssues);
};

const getVisibleIssues = (
  result: AnalyzeResult,
  active: Set<Severity>,
) => result.report.issues.filter((issue) => active.has(issue.severity));

const getSelectionVisibleIssues = (
  result: AnalyzeResult | null,
  active: Set<Severity>,
) => result ? getVisibleIssues(result, active) : [];

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
    const visibleIssues = getVisibleIssues(result, active);
    const selectedIssue = resolveSelectedIssue(visibleIssues, preferredIssueKey);
    const issueKey = selectedIssue ? getIssueKey(selectedIssue) : null;
    setSelectedIssueKey(issueKey);
    setSelectedPreviewTarget(
      issueKey
        ? getIssuePreviewTarget(result, issueKey, visibleIssues)
        : getFirstNavigablePreviewTarget(result, active),
    );
    setShouldScrollSelectedPreviewTarget(true);
  };

  const selectIssueFromSource = (
    result: AnalyzeResult | null,
    issueKey: string | null,
    visibleIssues: AnalyzeResult["report"]["issues"],
    source: SelectionSource,
  ) => {
    if (!result || !issueKey) {
      clearSelection();
      return;
    }
    if (source === "preview-scroll" && issueKey === selectedIssueKey) return;
    setSelectedIssueKey(issueKey);
    setSelectedPreviewTarget(getIssuePreviewTarget(result, issueKey, visibleIssues));
    setShouldScrollSelectedPreviewTarget(source === "report-click");
    if (source === "report-click") {
      setSuppressScrollSelectionUntil(Date.now() + REPORT_SCROLL_SUPPRESSION_MS);
      return;
    }
    setSuppressScrollSelectionUntil(0);
  };

  return {
    clearSelection,
    selectIssueFromSource,
    selectResolvedIssue,
    selectedIssueKey,
    selectedPreviewTarget,
    shouldScrollSelectedPreviewTarget,
    suppressScrollSelectionUntil,
  };
};

const useVisibleSelection = (
  result: AnalyzeResult | null,
  active: Set<Severity>,
  selection: ReturnType<typeof useIssueSelection>,
) => {
  const visibleIssues = getSelectionVisibleIssues(result, active);

  const selectIssue = (issueKey: string | null) => {
    selection.selectIssueFromSource(result, issueKey, visibleIssues, "report-click");
  };

  const selectIssueFromSource = (
    nextResult: AnalyzeResult | null,
    issueKey: string | null,
    source: SelectionSource,
  ) => {
    const nextVisibleIssues = getSelectionVisibleIssues(nextResult, active);
    selection.selectIssueFromSource(nextResult, issueKey, nextVisibleIssues, source);
  };

  return { selectIssue, selectIssueFromSource, visibleIssues };
};

const useDetectionState = () => {
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [buffer, setBuffer] = useState<ArrayBuffer | null>(null);
  const [active, setActive] = useState<Set<Severity>>(new Set(ALL_SEVERITIES));
  const [reportGroupBy, setReportGroupBy] = useState<ReportGroupBy>("section");
  const [reportSortBy, setReportSortBy] = useState<ReportSortBy>("paragraph");
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);

  return {
    active,
    buffer,
    error,
    file,
    over,
    reportGroupBy,
    reportSortBy,
    result,
    setActive,
    setBuffer,
    setError,
    setFile,
    setOver,
    setReportGroupBy,
    setReportSortBy,
    setResult,
    setStep,
    step,
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
  const state = useDetectionState();
  const selection = useIssueSelection();

  const applyResult = (nextResult: AnalyzeResult, advanceToResult = false) => {
    state.setResult(nextResult);
    state.setError(null);
    selection.selectResolvedIssue(nextResult, state.active);
    if (advanceToResult) state.setStep(3);
  };

  const { invalidateAnalysis, isAnalyzing, runAnalysis } = useAnalysisRunner({
    applyResult,
    buffer: state.buffer,
    setError: state.setError,
  });

  const pickFile = async (selectedFile: File) => {
    invalidateAnalysis();
    state.setError(null);
    state.setFile(selectedFile);
    state.setBuffer(await selectedFile.arrayBuffer());
  };

  const {
    selectIssue,
    selectIssueFromSource,
    visibleIssues,
  } = useVisibleSelection(state.result, state.active, selection);

  const toggleSeverity = (severity: Severity) => {
    const next = new Set(state.active);
    if (next.has(severity)) next.delete(severity);
    else next.add(severity);
    state.setActive(next);
    if (state.result) {
      selection.selectResolvedIssue(state.result, next, selection.selectedIssueKey);
    }
  };

  const reset = () => {
    invalidateAnalysis();
    state.setStep(0);
    state.setFile(null);
    state.setBuffer(null);
    state.setResult(null);
    state.setError(null);
    selection.clearSelection();
  };

  const previewIssueTargets = state.result
    ? buildPreviewIssueTargets(visibleIssues, state.result.model.paragraphs)
    : [];

  return {
    active: state.active,
    buffer: state.buffer,
    clearError: () => state.setError(null),
    error: state.error,
    file: state.file,
    isAnalyzing,
    over: state.over,
    reportGroupBy: state.reportGroupBy,
    reportSortBy: state.reportSortBy,
    result: state.result,
    previewIssueTargets,
    selectedIssueKey: selection.selectedIssueKey,
    selectedPreviewTarget: selection.selectedPreviewTarget,
    shouldScrollSelectedPreviewTarget: selection.shouldScrollSelectedPreviewTarget,
    suppressScrollSelectionUntil: selection.suppressScrollSelectionUntil,
    step: state.step,
    applyResult,
    pickFile,
    reset,
    runAnalysis,
    selectIssue,
    selectIssueFromSource,
    setOver: state.setOver,
    setReportGroupBy: state.setReportGroupBy,
    setReportSortBy: state.setReportSortBy,
    setStep: state.setStep,
    toggleSeverity,
  };
};
