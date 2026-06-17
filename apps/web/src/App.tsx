import { useMemo, useRef, useState, type RefObject } from "react";
import { analyze } from "./lib/analyze.js";
import { DetectWorkspace } from "./components/DetectWorkspace.js";
import { RulesWorkspace } from "./components/RulesWorkspace.js";
import { useDetectionFlow } from "./hooks/useDetectionFlow.js";
import { useRuleLibraries } from "./hooks/useRuleLibraries.js";
import { useRuleProposals } from "./hooks/useRuleProposals.js";
import { loadRuleLibraryRecords } from "./lib/ruleLibraries.js";

function ViewNav({
  view,
  onChange,
}: {
  view: "detect" | "rules";
  onChange: (view: "detect" | "rules") => void;
}) {
  return (
    <nav className="nav">
      <button className={view === "detect" ? "active" : ""} onClick={() => onChange("detect")}>
        文档检测
      </button>
      <button className={view === "rules" ? "active" : ""} onClick={() => onChange("rules")}>
        规则配置
      </button>
    </nav>
  );
}

function RuleFileInputs({
  importRef,
  proposalRef,
  onImport,
  onExtract,
}: {
  importRef: RefObject<HTMLInputElement>;
  proposalRef: RefObject<HTMLInputElement>;
  onImport: (file: File) => Promise<void>;
  onExtract: (file: File) => Promise<void>;
}) {
  return (
    <>
      <input
        ref={importRef}
        type="file"
        accept=".json"
        hidden
        onChange={(event) => {
          const selected = event.target.files?.[0];
          if (selected) void onImport(selected);
          event.currentTarget.value = "";
        }}
      />
      <input
        ref={proposalRef}
        type="file"
        accept=".doc,.docx"
        hidden
        onChange={(event) => {
          const selected = event.target.files?.[0];
          if (selected) void onExtract(selected);
          event.currentTarget.value = "";
        }}
      />
    </>
  );
}

function RulesScreen({
  importRef,
  proposalRef,
  proposals,
  rules,
  onPublish,
}: {
  importRef: RefObject<HTMLInputElement>;
  proposalRef: RefObject<HTMLInputElement>;
  proposals: ReturnType<typeof useRuleProposals>;
  rules: ReturnType<typeof useRuleLibraries>;
  onPublish: () => void;
}) {
  return (
    <>
      <RulesWorkspace
        currentLibrary={rules.currentLibrary}
        currentProposal={proposals.currentProposal}
        draftDirty={rules.draftDirty}
        libraries={rules.libraries}
        proposalFeedback={proposals.proposalFeedback}
        ruleMessage={rules.ruleMessage}
        unpublishedChanges={rules.unpublishedChanges}
        onAcceptDocument={proposals.acceptDocumentProposal}
        onAcceptDocumentField={proposals.acceptDocumentProposalField}
        onAcceptField={proposals.acceptProposalField}
        onAcceptRole={proposals.acceptProposalRole}
        onChangeDraft={rules.updateDraft}
        onClearProposalFeedback={proposals.clearProposalFeedback}
        onExportDraft={rules.exportDraft}
        onExportPublished={rules.exportPublished}
        onExtract={() => proposalRef.current?.click()}
        onImport={() => importRef.current?.click()}
        onPublish={onPublish}
        onSaveDraft={rules.saveDraft}
        onSelectLibrary={rules.selectLibrary}
      />
      <RuleFileInputs
        importRef={importRef}
        proposalRef={proposalRef}
        onImport={rules.importLibrary}
        onExtract={proposals.extractProposalFromFile}
      />
    </>
  );
}

function DetectScreen({
  detect,
  rules,
}: {
  detect: ReturnType<typeof useDetectionFlow>;
  rules: ReturnType<typeof useRuleLibraries>;
}) {
  return (
    <DetectWorkspace
      active={detect.active}
      buffer={detect.buffer}
      currentLibrary={rules.currentLibrary}
      error={detect.error}
      fileName={detect.file?.name ?? null}
      libraries={rules.libraries}
      over={detect.over}
      reportGroupBy={detect.reportGroupBy}
      reportSortBy={detect.reportSortBy}
      result={detect.result}
      selectedText={detect.selectedText}
      step={detect.step}
      templateId={rules.templateId}
      unpublishedChanges={rules.unpublishedChanges}
      onGroupByChange={detect.setReportGroupBy}
      onOverChange={detect.setOver}
      onPickFile={detect.pickFile}
      onReset={detect.reset}
      onRun={() => detect.runAnalysis(rules.currentLibrary?.published ?? null)}
      onSelectIssue={detect.selectParagraph}
      onSortByChange={detect.setReportSortBy}
      onStepChange={detect.setStep}
      onTemplateChange={(id) => {
        rules.selectLibrary(id);
        detect.clearError();
      }}
      onToggleSeverity={detect.toggleSeverity}
    />
  );
}

export default function App() {
  const initialLibraries = useMemo(() => loadRuleLibraryRecords(), []);
  const [view, setView] = useState<"detect" | "rules">("detect");
  const importRef = useRef<HTMLInputElement>(null);
  const proposalRef = useRef<HTMLInputElement>(null);
  const detect = useDetectionFlow();
  const rules = useRuleLibraries(initialLibraries);
  const proposals = useRuleProposals({
    currentLibrary: rules.currentLibrary,
    setRuleMessage: rules.setRuleMessage,
    updateLibrary: rules.updateLibrary,
  });

  const handlePublish = () => {
    const publishedCurrent = rules.publishCurrentLibrary();
    if (!publishedCurrent || !detect.buffer || !detect.result) return;
    try {
      detect.applyResult(analyze(detect.buffer, publishedCurrent.published));
      rules.setRuleMessage(`已发布 ${publishedCurrent.published.version}，并回灌到当前检测结果`);
    } catch (cause) {
      rules.setRuleMessage((cause as Error).message);
    }
  };

  return (
    <div className="app">
      <h1>论文排版合规检测</h1>
      <ViewNav view={view} onChange={setView} />
      {view === "rules" && (
        <RulesScreen
          importRef={importRef}
          proposalRef={proposalRef}
          proposals={proposals}
          rules={rules}
          onPublish={handlePublish}
        />
      )}
      {view === "detect" && <DetectScreen detect={detect} rules={rules} />}
    </div>
  );
}
