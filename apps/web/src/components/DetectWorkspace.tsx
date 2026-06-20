import { useRef } from "react";
import { PreviewPanel } from "./PreviewPanel.js";
import { ReportPanel } from "./ReportPanel.js";
import type { Severity } from "@word-auto/validator";
import type {
  PreviewIssueTarget,
  ReportGroupBy,
  ReportSortBy,
} from "../lib/reportGroups.js";
import type { PreviewHighlightTarget } from "../lib/previewHighlight.js";
import type { AnalyzeResult } from "../lib/analyze.js";
import type { RuleLibraryRecord } from "../lib/ruleLibraries.js";

const STEPS = ["上传文件", "选择模板", "配置选项", "检测结果"];
const ALL_SEVERITIES: Severity[] = ["error", "warn", "info"];

type DetectWorkspaceProps = {
  active: Set<Severity>;
  buffer: ArrayBuffer | null;
  currentLibrary: RuleLibraryRecord | undefined;
  error: string | null;
  fileName: string | null;
  isAnalyzing: boolean;
  libraries: RuleLibraryRecord[];
  over: boolean;
  previewIssueTargets: PreviewIssueTarget[];
  selectedPreviewTarget: PreviewHighlightTarget | null;
  reportGroupBy: ReportGroupBy;
  reportSortBy: ReportSortBy;
  result: AnalyzeResult | null;
  selectedIssueKey: string | null;
  step: number;
  shouldScrollSelectedPreviewTarget: boolean;
  suppressScrollSelectionUntil: number;
  templateId: string;
  unpublishedChanges: boolean;
  onGroupByChange: (value: ReportGroupBy) => void;
  onOverChange: (next: boolean) => void;
  onPickFile: (file: File) => Promise<void>;
  onReset: () => void;
  onRun: () => void;
  onSelectIssue: (issueKey: string | null) => void;
  onSelectIssueFromPreview: (
    issueKey: string,
    source: "preview-click" | "preview-scroll",
  ) => void;
  onSortByChange: (value: ReportSortBy) => void;
  onStepChange: (step: number) => void;
  onTemplateChange: (id: string) => void;
  onToggleSeverity: (severity: Severity) => void;
};

const getSeverityLabel = (severity: Severity) =>
  severity === "error" ? "错误" : severity === "warn" ? "警告" : "提示";

function Stepper({ step }: { step: number }) {
  return (
    <div className="stepper">
      {STEPS.map((label, index) => (
        <div
          key={label}
          className={`step ${index === step ? "active" : ""} ${index < step ? "done" : ""}`}
        >
          <span className="idx">{index < step ? "✓" : index + 1}</span>
          {label}
        </div>
      ))}
    </div>
  );
}

function UploadStep({
  buffer,
  fileName,
  over,
  onOverChange,
  onPickFile,
  onStepChange,
}: Pick<
  DetectWorkspaceProps,
  "buffer" | "fileName" | "over" | "onOverChange" | "onPickFile" | "onStepChange"
>) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="card">
      <div
        className={`dropzone ${over ? "over" : ""}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          onOverChange(true);
        }}
        onDragLeave={() => onOverChange(false)}
        onDrop={(event) => {
          event.preventDefault();
          onOverChange(false);
          const droppedFile = event.dataTransfer.files[0];
          if (droppedFile) void onPickFile(droppedFile);
        }}
      >
        <div style={{ fontSize: 16 }}>点击或拖拽 Word 文档到此处</div>
        <div className="hint">推荐上传 .docx；异常文件会给出明确提示，文件不会离开你的浏览器</div>
        <input
          ref={inputRef}
          type="file"
          accept=".doc,.docx"
          hidden
          onChange={(event) => {
            const selected = event.target.files?.[0];
            if (selected) void onPickFile(selected);
          }}
        />
      </div>
      {fileName && <div className="filename">已选择：{fileName}</div>}
      <div className="btns">
        <button className="primary" disabled={!buffer} onClick={() => onStepChange(1)}>
          下一步
        </button>
      </div>
    </div>
  );
}

function TemplateStep({
  currentLibrary,
  libraries,
  templateId,
  unpublishedChanges,
  onStepChange,
  onTemplateChange,
}: Pick<
  DetectWorkspaceProps,
  | "currentLibrary"
  | "libraries"
  | "templateId"
  | "unpublishedChanges"
  | "onStepChange"
  | "onTemplateChange"
>) {
  return (
    <div className="card">
      <label style={{ fontSize: 14, display: "block", marginBottom: 8 }}>
        选择排版模板
      </label>
      <select value={templateId} onChange={(event) => onTemplateChange(event.target.value)}>
        {libraries.map((item) => (
          <option key={item.id} value={item.id}>
            {item.published.name}
          </option>
        ))}
      </select>
      {currentLibrary && (
        <div className="template-hint">
          检测始终使用已发布版本 {currentLibrary.published.version}
          {unpublishedChanges
            ? "；当前草稿尚未发布"
            : "；当前草稿已与发布版同步"}
        </div>
      )}
      <div className="btns">
        <button onClick={() => onStepChange(0)}>上一步</button>
        <button className="primary" onClick={() => onStepChange(2)}>
          下一步
        </button>
      </div>
    </div>
  );
}

function SeverityStep({
  active,
  isAnalyzing,
  onRun,
  onStepChange,
  onToggleSeverity,
}: Pick<
  DetectWorkspaceProps,
  "active" | "isAnalyzing" | "onRun" | "onStepChange" | "onToggleSeverity"
>) {
  return (
    <div className="card">
      <label style={{ fontSize: 14, display: "block", marginBottom: 8 }}>
        检测哪些级别的问题
      </label>
      <div className="checks">
        {ALL_SEVERITIES.map((severity) => (
          <label key={severity}>
            <input
              type="checkbox"
              checked={active.has(severity)}
              disabled={isAnalyzing}
              onChange={() => onToggleSeverity(severity)}
            />
            {getSeverityLabel(severity)}
          </label>
        ))}
      </div>
      {isAnalyzing && <div className="template-hint">正在解析并检测，请稍候...</div>}
      <div className="btns">
        <button disabled={isAnalyzing} onClick={() => onStepChange(1)}>
          上一步
        </button>
        <button className="primary" disabled={isAnalyzing} onClick={onRun}>
          {isAnalyzing ? "检测中..." : "开始检测"}
        </button>
      </div>
    </div>
  );
}

function ResultStep({
  active,
  buffer,
  fileName,
  reportGroupBy,
  reportSortBy,
  result,
  previewIssueTargets,
  selectedIssueKey,
  selectedPreviewTarget,
  shouldScrollSelectedPreviewTarget,
  suppressScrollSelectionUntil,
  onGroupByChange,
  onReset,
  onSelectIssue,
  onSelectIssueFromPreview,
  onSortByChange,
  onToggleSeverity,
}: Pick<
  DetectWorkspaceProps,
  | "active"
  | "buffer"
  | "fileName"
  | "reportGroupBy"
  | "reportSortBy"
  | "result"
  | "previewIssueTargets"
  | "selectedIssueKey"
  | "selectedPreviewTarget"
  | "shouldScrollSelectedPreviewTarget"
  | "suppressScrollSelectionUntil"
  | "onGroupByChange"
  | "onReset"
  | "onSelectIssue"
  | "onSelectIssueFromPreview"
  | "onSortByChange"
  | "onToggleSeverity"
>) {
  if (!result || !buffer) return null;

  return (
    <>
      <div className="btns" style={{ marginBottom: 12 }}>
        <button onClick={onReset}>重新开始</button>
      </div>
      <div className="result">
        <div className="preview-wrap">
          <PreviewPanel
            buffer={buffer}
            shouldScrollToTarget={shouldScrollSelectedPreviewTarget}
            suppressScrollSelectionUntil={suppressScrollSelectionUntil}
            target={selectedPreviewTarget}
            targets={previewIssueTargets}
            onSelectTarget={onSelectIssueFromPreview}
          />
        </div>
        <ReportPanel
          report={result.report}
          active={active}
          fileName={fileName}
          groupBy={reportGroupBy}
          sortBy={reportSortBy}
          selectedIssueKey={selectedIssueKey}
          onToggle={onToggleSeverity}
          onGroupByChange={onGroupByChange}
          onSortByChange={onSortByChange}
          onSelect={onSelectIssue}
        />
      </div>
    </>
  );
}

function StepContent(props: DetectWorkspaceProps) {
  if (props.step === 0) {
    return (
      <UploadStep
        buffer={props.buffer}
        fileName={props.fileName}
        over={props.over}
        onOverChange={props.onOverChange}
        onPickFile={props.onPickFile}
        onStepChange={props.onStepChange}
      />
    );
  }
  if (props.step === 1) {
    return (
      <TemplateStep
        currentLibrary={props.currentLibrary}
        libraries={props.libraries}
        templateId={props.templateId}
        unpublishedChanges={props.unpublishedChanges}
        onStepChange={props.onStepChange}
        onTemplateChange={props.onTemplateChange}
      />
    );
  }
  if (props.step === 2) {
    return (
      <SeverityStep
        active={props.active}
        isAnalyzing={props.isAnalyzing}
        onRun={props.onRun}
        onStepChange={props.onStepChange}
        onToggleSeverity={props.onToggleSeverity}
      />
    );
  }
  if (props.step !== 3) return null;
  return (
    <ResultStep
      active={props.active}
      buffer={props.buffer}
      fileName={props.fileName}
      previewIssueTargets={props.previewIssueTargets}
      reportGroupBy={props.reportGroupBy}
      reportSortBy={props.reportSortBy}
      result={props.result}
      selectedIssueKey={props.selectedIssueKey}
      selectedPreviewTarget={props.selectedPreviewTarget}
      shouldScrollSelectedPreviewTarget={props.shouldScrollSelectedPreviewTarget}
      suppressScrollSelectionUntil={props.suppressScrollSelectionUntil}
      onGroupByChange={props.onGroupByChange}
      onReset={props.onReset}
      onSelectIssue={props.onSelectIssue}
      onSelectIssueFromPreview={props.onSelectIssueFromPreview}
      onSortByChange={props.onSortByChange}
      onToggleSeverity={props.onToggleSeverity}
    />
  );
}

export function DetectWorkspace({
  error,
  step,
  ...props
}: DetectWorkspaceProps) {
  return (
    <>
      <p className="subtitle">
        上传 .docx，对照排版规则库逐段检测格式问题。文件全程在浏览器本地处理，不会上传。
      </p>
      <Stepper step={step} />
      {error && <div className="error-banner">{error}</div>}
      <StepContent {...props} error={error} step={step} />
    </>
  );
}
