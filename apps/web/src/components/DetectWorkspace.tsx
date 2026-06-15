import { useRef } from "react";
import { PreviewPanel } from "./PreviewPanel.js";
import { ReportPanel } from "./ReportPanel.js";
import type { Severity } from "@word-auto/validator";
import type { ReportGroupBy, ReportSortBy } from "../lib/reportGroups.js";
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
  libraries: RuleLibraryRecord[];
  over: boolean;
  reportGroupBy: ReportGroupBy;
  reportSortBy: ReportSortBy;
  result: AnalyzeResult | null;
  selectedText: string | null;
  step: number;
  templateId: string;
  unpublishedChanges: boolean;
  onGroupByChange: (value: ReportGroupBy) => void;
  onOverChange: (next: boolean) => void;
  onPickFile: (file: File) => Promise<void>;
  onReset: () => void;
  onRun: () => void;
  onSelectIssue: (paragraphIndex: number) => void;
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
  onRun,
  onStepChange,
  onToggleSeverity,
}: Pick<DetectWorkspaceProps, "active" | "onRun" | "onStepChange" | "onToggleSeverity">) {
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
              onChange={() => onToggleSeverity(severity)}
            />
            {getSeverityLabel(severity)}
          </label>
        ))}
      </div>
      <div className="btns">
        <button onClick={() => onStepChange(1)}>上一步</button>
        <button className="primary" onClick={onRun}>
          开始检测
        </button>
      </div>
    </div>
  );
}

function ResultStep({
  active,
  buffer,
  reportGroupBy,
  reportSortBy,
  result,
  selectedText,
  onGroupByChange,
  onReset,
  onSelectIssue,
  onSortByChange,
  onToggleSeverity,
}: Pick<
  DetectWorkspaceProps,
  | "active"
  | "buffer"
  | "reportGroupBy"
  | "reportSortBy"
  | "result"
  | "selectedText"
  | "onGroupByChange"
  | "onReset"
  | "onSelectIssue"
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
          <PreviewPanel buffer={buffer} targetText={selectedText} />
        </div>
        <ReportPanel
          report={result.report}
          active={active}
          groupBy={reportGroupBy}
          sortBy={reportSortBy}
          onToggle={onToggleSeverity}
          onGroupByChange={onGroupByChange}
          onSortByChange={onSortByChange}
          onSelect={onSelectIssue}
        />
      </div>
    </>
  );
}

export function DetectWorkspace({
  active,
  buffer,
  currentLibrary,
  error,
  fileName,
  libraries,
  over,
  reportGroupBy,
  reportSortBy,
  result,
  selectedText,
  step,
  templateId,
  unpublishedChanges,
  onGroupByChange,
  onOverChange,
  onPickFile,
  onReset,
  onRun,
  onSelectIssue,
  onSortByChange,
  onStepChange,
  onTemplateChange,
  onToggleSeverity,
}: DetectWorkspaceProps) {
  return (
    <>
      <p className="subtitle">
        上传 .docx，对照排版规则库逐段检测格式问题。文件全程在浏览器本地处理，不会上传。
      </p>
      <Stepper step={step} />
      {error && <div className="error-banner">{error}</div>}
      {step === 0 && (
        <UploadStep
          buffer={buffer}
          fileName={fileName}
          over={over}
          onOverChange={onOverChange}
          onPickFile={onPickFile}
          onStepChange={onStepChange}
        />
      )}
      {step === 1 && (
        <TemplateStep
          currentLibrary={currentLibrary}
          libraries={libraries}
          templateId={templateId}
          unpublishedChanges={unpublishedChanges}
          onStepChange={onStepChange}
          onTemplateChange={onTemplateChange}
        />
      )}
      {step === 2 && (
        <SeverityStep
          active={active}
          onRun={onRun}
          onStepChange={onStepChange}
          onToggleSeverity={onToggleSeverity}
        />
      )}
      {step === 3 && (
        <ResultStep
          active={active}
          buffer={buffer}
          reportGroupBy={reportGroupBy}
          reportSortBy={reportSortBy}
          result={result}
          selectedText={selectedText}
          onGroupByChange={onGroupByChange}
          onReset={onReset}
          onSelectIssue={onSelectIssue}
          onSortByChange={onSortByChange}
          onToggleSeverity={onToggleSeverity}
        />
      )}
    </>
  );
}
