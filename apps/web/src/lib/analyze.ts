import { ParseError, parseDocx, type DocModel } from "@word-auto/parser";
import { validateDoc } from "@word-auto/validator";
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

const PARSE_ERROR_MESSAGES: Record<ParseError["code"], string> = {
  NOT_ZIP: "上传的文件不是有效的 .docx 文档。请确认文件格式正确后重试。",
  ENCRYPTED: "检测到受密码保护的 Word 文档，当前不支持解析。请先另存为未加密的 .docx 后再上传。",
  LEGACY_DOC: "检测到旧版 .doc 文档，当前只支持 .docx（OOXML）格式。",
  CORRUPT: "文档文件已损坏，或 ZIP 结构不完整，无法解析。请确认文件可正常打开后重试。",
  NOT_DOCX: "这个文件不是有效的 .docx 文档，缺少 Word OOXML 所需结构。",
};

/** 浏览器内完成：解析 docx + 规则校验（文件不上传，纯本地计算） */
export const analyze = (
  buf: ArrayBuffer,
  rules: LegacyRuleLibrary | EditableRuleLibrary,
): AnalyzeResult => {
  const model = parseDocx(new Uint8Array(buf));
  return { model, report: validateDoc(model, rules) };
};

export const getFriendlyAnalyzeErrorMessage = (error: unknown): string => {
  if (error instanceof ParseError) {
    return PARSE_ERROR_MESSAGES[error.code];
  }
  return "检测失败：" + (error instanceof Error ? error.message : String(error));
};
