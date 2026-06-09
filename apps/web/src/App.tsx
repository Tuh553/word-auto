import { useRef, useState } from "react";
import { analyze, type ValidationReport } from "./lib/analyze.js";
import { TEMPLATES } from "./lib/templates.js";
import { PreviewPanel } from "./components/PreviewPanel.js";
import { ReportPanel } from "./components/ReportPanel.js";
import type { Severity } from "@word-auto/validator";

const STEPS = ["上传文件", "选择模板", "配置选项", "检测结果"];
const ALL_SEV: Severity[] = ["error", "warn", "info"];

export default function App() {
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [buffer, setBuffer] = useState<ArrayBuffer | null>(null);
  const [templateId, setTemplateId] = useState(TEMPLATES[0].id);
  const [active, setActive] = useState<Set<Severity>>(new Set(ALL_SEV));
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
    if (!buffer) return;
    try {
      const tpl = TEMPLATES.find((t) => t.id === templateId)!;
      setReport(analyze(buffer, tpl.rules));
      setError(null);
      setStep(3);
    } catch (e) {
      setError("检测失败：" + (e as Error).message);
    }
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
    setReport(null);
    setError(null);
    setSelectedIndex(null);
  };

  return (
    <div className="app">
      <h1>论文排版合规检测</h1>
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
            onChange={(e) => setTemplateId(e.target.value)}
          >
            {TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
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
      {step === 3 && report && buffer && (
        <>
          <div className="btns" style={{ marginBottom: 12 }}>
            <button onClick={reset}>重新开始</button>
          </div>
          <div className="result">
            <div className="preview-wrap">
              <PreviewPanel buffer={buffer} selectedIndex={selectedIndex} />
            </div>
            <ReportPanel
              report={report}
              active={active}
              onToggle={toggle}
              onSelect={setSelectedIndex}
            />
          </div>
        </>
      )}
    </div>
  );
}
