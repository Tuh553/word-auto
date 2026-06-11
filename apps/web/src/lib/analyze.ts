import { parseDocx, type DocModel } from "@word-auto/parser";
import { toLegacyRuleLibrary, validateDoc } from "@word-auto/validator";
import type {
  EditableRuleLibrary,
  LegacyRuleLibrary,
  ValidationReport,
} from "@word-auto/validator";

export type { ValidationReport };

export interface AnalyzeResult {
  model: DocModel;
  report: ValidationReport;
}

/** 浏览器内完成：解析 docx + 规则校验（文件不上传，纯本地计算） */
export const analyze = (
  buf: ArrayBuffer,
  rules: LegacyRuleLibrary | EditableRuleLibrary,
): AnalyzeResult => {
  const model = parseDocx(new Uint8Array(buf));
  return { model, report: validateDoc(model, toLegacyRuleLibrary(rules)) };
};
