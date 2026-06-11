import { useMemo, useRef, useState } from "react";
import { analyze, type AnalyzeResult } from "./lib/analyze.js";
import { PreviewPanel } from "./components/PreviewPanel.js";
import { ReportPanel } from "./components/ReportPanel.js";
import { RuleConfigPanel } from "./components/RuleConfigPanel.js";
import { TemplateProposalPanel } from "./components/TemplateProposalPanel.js";
import {
  hasUnpublishedChanges,
  loadRuleLibraryRecords,
  parseImportedRuleLibrary,
  publishDraft,
  sameDraftAsSaved,
  saveRuleLibraryRecords,
  serializeRuleLibrary,
  stripDraftMeta,
  touchDraft,
  type RuleLibraryRecord,
} from "./lib/ruleLibraries.js";
import { parseDocx } from "@word-auto/parser";
import {
  applyProposalFieldToDraft,
  applyProposalRoleToDraft,
  extractRuleProposal,
  type RuleProposal,
  type Severity,
} from "@word-auto/validator";

const STEPS = ["上传文件", "选择模板", "配置选项", "检测结果"];
const ALL_SEV: Severity[] = ["error", "warn", "info"];

export default function App() {
  const initialLibraries = useMemo(() => loadRuleLibraryRecords(), []);
  const [view, setView] = useState<"detect" | "rules">("detect");
  const [libraries, setLibraries] = useState<RuleLibraryRecord[]>(initialLibraries);
  const [savedLibraries, setSavedLibraries] = useState<RuleLibraryRecord[]>(
    structuredClone(initialLibraries),
  );

  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [buffer, setBuffer] = useState<ArrayBuffer | null>(null);
  const [templateId, setTemplateId] = useState(initialLibraries[0]?.id ?? "");
  const [active, setActive] = useState<Set<Severity>>(new Set(ALL_SEV));
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ruleMessage, setRuleMessage] = useState<string | null>(null);
  const [selectedText, setSelectedText] = useState<string | null>(null);
  const [proposals, setProposals] = useState<Record<string, RuleProposal>>({});
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const proposalRef = useRef<HTMLInputElement>(null);

  const currentLibrary = libraries.find((item) => item.id === templateId) ?? libraries[0];
  const savedLibrary = savedLibraries.find((item) => item.id === currentLibrary?.id);
  const draftDirty = currentLibrary
    ? !sameDraftAsSaved(currentLibrary, savedLibrary)
    : false;
  const unpublishedChanges = currentLibrary
    ? hasUnpublishedChanges(currentLibrary)
    : false;
  const currentProposal = currentLibrary ? proposals[currentLibrary.id] ?? null : null;

  const pickFile = async (f: File) => {
    if (!f.name.toLowerCase().endsWith(".docx")) {
      setError("请上传 .docx 文件（旧版 .doc 暂不支持）");
      return;
    }
    setError(null);
    setFile(f);
    setBuffer(await f.arrayBuffer());
  };

  const run = () => {
    if (!buffer || !currentLibrary) return;
    try {
      setResult(analyze(buffer, currentLibrary.published));
      setError(null);
      setSelectedText(null);
      setStep(3);
    } catch (e) {
      setError("检测失败：" + (e as Error).message);
    }
  };

  // 点击问题 → 取该段原文交给预览定位（文档级问题 paraIndex<0 不定位）
  const onSelect = (paraIndex: number) => {
    if (!result || paraIndex < 0) {
      setSelectedText(null);
      return;
    }
    setSelectedText(result.model.paragraphs[paraIndex]?.text ?? null);
  };

  const toggle = (s: Severity) => {
    const next = new Set(active);
    next.has(s) ? next.delete(s) : next.add(s);
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

  const updateLibrary = (
    updater: (record: RuleLibraryRecord) => RuleLibraryRecord,
  ) => {
    if (!currentLibrary) return;
    setLibraries((prev) =>
      prev.map((item) => (item.id === currentLibrary.id ? updater(item) : item)),
    );
  };

  const persistLibraries = (next: RuleLibraryRecord[]) => {
    setLibraries(next);
    setSavedLibraries(structuredClone(next));
    saveRuleLibraryRecords(next);
  };

  const downloadJson = (filename: string, content: string) => {
    const blob = new Blob([content], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const saveDraft = () => {
    if (!currentLibrary) return;
    if (!draftDirty) {
      setRuleMessage("当前没有未保存的草稿变更");
      return;
    }

    const next = libraries.map((item) =>
      item.id === currentLibrary.id ? touchDraft(item) : item,
    );
    persistLibraries(next);
    setRuleMessage("草稿已保存到本地浏览器");
  };

  const handlePublish = () => {
    if (!currentLibrary) return;
    if (!unpublishedChanges) {
      setRuleMessage("草稿与已发布版本一致，无需重复发布");
      return;
    }

    try {
      const next = libraries.map((item) =>
        item.id === currentLibrary.id ? publishDraft(item) : item,
      );
      const publishedCurrent = next.find((item) => item.id === currentLibrary.id);
      persistLibraries(next);

      if (publishedCurrent && buffer && result) {
        setResult(analyze(buffer, publishedCurrent.published));
        setRuleMessage(`已发布 ${publishedCurrent.published.version}，并回灌到当前检测结果`);
      } else if (publishedCurrent) {
        setRuleMessage(`已发布 ${publishedCurrent.published.version}`);
      }
    } catch (e) {
      setRuleMessage((e as Error).message);
    }
  };

  const handleImport = async (fileToImport: File) => {
    try {
      const text = await fileToImport.text();
      const nextRecord = parseImportedRuleLibrary(
        text,
        libraries.map((item) => item.id),
      );
      const next = [...libraries, nextRecord];
      persistLibraries(next);
      setTemplateId(nextRecord.id);
      setRuleMessage(`已导入模板「${nextRecord.published.name}」`);
    } catch (e) {
      setRuleMessage((e as Error).message);
    }
  };

  const handleExtractProposal = async (candidateFile: File) => {
    if (!currentLibrary) return;
    if (!candidateFile.name.toLowerCase().endsWith(".docx")) {
      setRuleMessage("候选提取只支持 .docx 文件");
      return;
    }

    try {
      const model = parseDocx(new Uint8Array(await candidateFile.arrayBuffer()));
      const proposal = extractRuleProposal(model, { sourceName: candidateFile.name });
      setProposals((prev) => ({ ...prev, [currentLibrary.id]: proposal }));
      setRuleMessage(
        `已从「${candidateFile.name}」提取 ${proposal.roles.length} 个角色候选，可接受到当前草稿`,
      );
    } catch (e) {
      setRuleMessage("候选提取失败：" + (e as Error).message);
    }
  };

  const acceptProposalField = (
    role: NonNullable<typeof currentProposal>["roles"][number],
    field: NonNullable<typeof currentProposal>["roles"][number]["fields"][number],
  ) => {
    updateLibrary((record) => ({
      ...record,
      draft: applyProposalFieldToDraft(record.draft, role, field),
    }));
    setRuleMessage(`已将 ${role.label} / ${field.key} 候选写入草稿`);
  };

  const acceptProposalRole = (
    role: NonNullable<typeof currentProposal>["roles"][number],
  ) => {
    updateLibrary((record) => ({
      ...record,
      draft: applyProposalRoleToDraft(record.draft, role),
    }));
    setRuleMessage(`已将 ${role.label} 的 ${role.fields.length} 个候选写入草稿`);
  };

  const handleExportDraft = () => {
    if (!currentLibrary) return;
    downloadJson(
      `${currentLibrary.id}.draft.json`,
      serializeRuleLibrary(currentLibrary.draft),
    );
    setRuleMessage("草稿 JSON 已导出");
  };

  const handleExportPublished = () => {
    if (!currentLibrary) return;
    downloadJson(
      `${currentLibrary.id}.published.json`,
      serializeRuleLibrary(currentLibrary.published),
    );
    setRuleMessage("生效规则 JSON 已导出");
  };

  return (
    <div className="app">
      <h1>论文排版合规检测</h1>

      <nav className="nav">
        <button
          className={view === "detect" ? "active" : ""}
          onClick={() => setView("detect")}
        >
          文档检测
        </button>
        <button
          className={view === "rules" ? "active" : ""}
          onClick={() => setView("rules")}
        >
          规则配置
        </button>
      </nav>

      {view === "rules" && currentLibrary && (
        <>
          <RuleConfigPanel
            draft={currentLibrary.draft}
            published={currentLibrary.published}
            publishedUpdatedAt={currentLibrary.publishedUpdatedAt}
            draftDirty={draftDirty}
            unpublishedChanges={unpublishedChanges}
            libraryOptions={libraries.map((item) => ({
              id: item.id,
              name: item.published.name,
              version: item.published.version,
            }))}
            statusMessage={ruleMessage}
            onSelectLibrary={(id) => {
              setTemplateId(id);
              setRuleMessage(null);
            }}
            onChange={(draft) => {
              updateLibrary((record) => ({
                ...record,
                draft: {
                  ...record.draft,
                  ...stripDraftMeta(draft),
                  status: "draft",
                  updatedAt: record.draft.updatedAt,
                },
              }));
              setRuleMessage(null);
            }}
            onSaveDraft={saveDraft}
            onPublish={handlePublish}
            onImport={() => importRef.current?.click()}
            onExportDraft={handleExportDraft}
            onExportPublished={handleExportPublished}
          />
          <TemplateProposalPanel
            draft={currentLibrary.draft}
            proposal={currentProposal}
            onExtract={() => proposalRef.current?.click()}
            onAcceptField={acceptProposalField}
            onAcceptRole={acceptProposalRole}
          />
        </>
      )}

      {view === "detect" && (
        <>
          <p className="subtitle">
            上传 .docx，对照排版规则库逐段检测格式问题。文件全程在浏览器本地处理，不会上传。
          </p>

          <div className="stepper">
            {STEPS.map((s, i) => (
              <div
                key={i}
                className={`step ${i === step ? "active" : ""} ${i < step ? "done" : ""}`}
              >
                <span className="idx">{i < step ? "✓" : i + 1}</span>
                {s}
              </div>
            ))}
          </div>

          {error && <div className="error-banner">{error}</div>}

          {/* 步骤 1：上传 */}
          {step === 0 && (
            <div className="card">
              <div
                className={`dropzone ${over ? "over" : ""}`}
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOver(true);
                }}
                onDragLeave={() => setOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setOver(false);
                  const f = e.dataTransfer.files[0];
                  if (f) void pickFile(f);
                }}
              >
                <div style={{ fontSize: 16 }}>点击或拖拽 .docx 文件到此处</div>
                <div className="hint">文件不会离开你的浏览器</div>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".docx"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void pickFile(f);
                  }}
                />
              </div>
              {file && <div className="filename">已选择：{file.name}</div>}
              <div className="btns">
                <button
                  className="primary"
                  disabled={!buffer}
                  onClick={() => setStep(1)}
                >
                  下一步
                </button>
              </div>
            </div>
          )}

          {/* 步骤 2：选择模板 */}
          {step === 1 && (
            <div className="card">
              <label style={{ fontSize: 14, display: "block", marginBottom: 8 }}>
                选择排版模板
              </label>
              <select
                value={templateId}
                onChange={(e) => {
                  setTemplateId(e.target.value);
                  setError(null);
                }}
              >
                {libraries.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.published.name}
                  </option>
                ))}
              </select>
              {currentLibrary && (
                <div className="template-hint">
                  检测始终使用已发布版本 {currentLibrary.published.version}
                  {hasUnpublishedChanges(currentLibrary)
                    ? "；当前草稿尚未发布"
                    : "；当前草稿已与发布版同步"}
                </div>
              )}
              <div className="btns">
                <button onClick={() => setStep(0)}>上一步</button>
                <button className="primary" onClick={() => setStep(2)}>
                  下一步
                </button>
              </div>
            </div>
          )}

          {/* 步骤 3：配置选项 */}
          {step === 2 && (
            <div className="card">
              <label style={{ fontSize: 14, display: "block", marginBottom: 8 }}>
                检测哪些级别的问题
              </label>
              <div className="checks">
                {ALL_SEV.map((s) => (
                  <label key={s}>
                    <input
                      type="checkbox"
                      checked={active.has(s)}
                      onChange={() => toggle(s)}
                    />
                    {s === "error" ? "错误" : s === "warn" ? "警告" : "提示"}
                  </label>
                ))}
              </div>
              <div className="btns">
                <button onClick={() => setStep(1)}>上一步</button>
                <button className="primary" onClick={run}>
                  开始检测
                </button>
              </div>
            </div>
          )}

          {/* 步骤 4：结果 */}
          {step === 3 && result && buffer && (
            <>
              <div className="btns" style={{ marginBottom: 12 }}>
                <button onClick={reset}>重新开始</button>
              </div>
              <div className="result">
                <div className="preview-wrap">
                  <PreviewPanel buffer={buffer} targetText={selectedText} />
                </div>
                <ReportPanel
                  report={result.report}
                  active={active}
                  onToggle={toggle}
                  onSelect={onSelect}
                />
              </div>
            </>
          )}
        </>
      )}

      <input
        ref={importRef}
        type="file"
        accept=".json"
        hidden
        onChange={(e) => {
          const selected = e.target.files?.[0];
          if (selected) void handleImport(selected);
          e.currentTarget.value = "";
        }}
      />
      <input
        ref={proposalRef}
        type="file"
        accept=".docx"
        hidden
        onChange={(e) => {
          const selected = e.target.files?.[0];
          if (selected) void handleExtractProposal(selected);
          e.currentTarget.value = "";
        }}
      />
    </div>
  );
}
