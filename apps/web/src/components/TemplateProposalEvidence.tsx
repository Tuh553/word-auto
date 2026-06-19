import type {
  RuleProposalEvidenceSample,
  RuleValue,
} from "@word-auto/validator";
import { formatRuleValue } from "./ruleConfigShared.js";

const ROLE_CONFIDENCE_LABEL = {
  high: "高",
  medium: "中",
  low: "低",
} as const;

const formatSampleValue = (value: unknown): string => {
  if (
    value &&
    typeof value === "object" &&
    "mode" in value
  ) {
    return formatRuleValue(value as RuleValue);
  }
  if (typeof value === "boolean") return value ? "是" : "否";
  return String(value);
};

function EvidenceSampleRow({
  sample,
}: {
  sample: RuleProposalEvidenceSample;
}) {
  return (
    <div className="proposal-sample">
      <div className="proposal-sample-meta">
        样本 {sample.sampleIndex}
        {sample.roleLabel ? ` · ${sample.roleLabel}` : ""}
        {sample.roleConfidence ? ` · 角色置信度${ROLE_CONFIDENCE_LABEL[sample.roleConfidence]}` : ""}
      </div>
      <div>样本值：{formatSampleValue(sample.value)}</div>
      {sample.roleConfidence === "low" && (
        <div className="proposal-low-confidence">
          角色识别置信度低{sample.roleConfidenceReason ? `：${sample.roleConfidenceReason}` : ""}
        </div>
      )}
      <div className="proposal-sample-text">{sample.text}</div>
    </div>
  );
}

export function ProposalEvidenceDetails({
  evidence,
  samples,
}: {
  evidence: string[];
  samples: RuleProposalEvidenceSample[] | undefined;
}) {
  return (
    <details className="proposal-evidence-details">
      <summary>查看证据</summary>
      <div className="proposal-evidence">
        {evidence.map((item, index) => (
          <div key={index}>{item}</div>
        ))}
      </div>
      {samples && samples.length > 0 && (
        <div className="proposal-samples">
          {samples.map((sample) => (
            <EvidenceSampleRow key={`${sample.sampleIndex}-${String(sample.value)}`} sample={sample} />
          ))}
        </div>
      )}
    </details>
  );
}
