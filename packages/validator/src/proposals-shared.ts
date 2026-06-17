export type Scalar = string | number | boolean;

export type CandidateSample = {
  value: Scalar;
  preview: string;
  sampleIndex: number;
};

export const roundNumber = (value: number, digits = 2): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const toKey = (value: Scalar): string => JSON.stringify(value);

const confidenceLevelOf = (confidence: number): "high" | "medium" | "low" => {
  if (confidence >= 0.85) return "high";
  if (confidence >= 0.6) return "medium";
  return "low";
};

const confidenceHintOf = (
  confidence: number,
  coverage: number,
  totalCount: number,
  conflictCount: number,
): string => {
  if (totalCount < 2) return "样本过少，仅供人工参考";
  if (confidence >= 0.85 && conflictCount === 0) return "主值集中，可直接进入草稿复核";
  if (coverage >= 0.6) return "存在少量冲突，建议接受后结合原文抽查";
  return "覆盖不足或冲突偏多，建议先检查样本质量与角色识别";
};

export const summarizeSamples = (
  samples: CandidateSample[],
  totalCount: number,
): {
  primaryValue: Scalar;
  confidence: number;
  confidenceHint: string;
  confidenceLevel: "high" | "medium" | "low";
  conflicts: Array<{ value: Scalar; sampleCount: number; evidence: string[] }>;
  coverage: number;
  evidence: string[];
  observedCount: number;
  sampleCount: number;
  totalCount: number;
} | null => {
  if (samples.length === 0) return null;

  const groups = new Map<string, CandidateSample[]>();
  for (const sample of samples) {
    const key = toKey(sample.value);
    const arr = groups.get(key) ?? [];
    arr.push(sample);
    groups.set(key, arr);
  }

  const ordered = [...groups.entries()]
    .map(([key, values]) => ({ key, values, value: JSON.parse(key) as Scalar }))
    .sort((left, right) => right.values.length - left.values.length || left.key.localeCompare(right.key));

  const primary = ordered[0];
  const sampleCount = primary.values.length;
  const observedCount = samples.length;
  const coverage = totalCount === 0 ? 0 : roundNumber(sampleCount / totalCount, 2);
  const dominance = observedCount === 0 ? 0 : sampleCount / observedCount;
  const sampleFactor = Math.min(1, observedCount / 5);
  const confidence = roundNumber((dominance * 0.7 + coverage * 0.3) * (0.6 + sampleFactor * 0.4), 2);
  const conflicts = ordered.slice(1).map((item) => ({
    value: item.value,
    sampleCount: item.values.length,
    evidence: item.values.slice(0, 3).map(
      (sample) => `样本 ${sample.sampleIndex}: ${sample.preview}`,
    ),
  }));
  const evidence = primary.values.slice(0, 3).map(
    (sample) => `样本 ${sample.sampleIndex}: ${sample.preview}`,
  );

  return {
    primaryValue: primary.value,
    confidence,
    confidenceHint: confidenceHintOf(confidence, coverage, totalCount, conflicts.length),
    confidenceLevel: confidenceLevelOf(confidence),
    conflicts,
    coverage,
    evidence,
    observedCount,
    sampleCount,
    totalCount,
  };
};
