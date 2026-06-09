import { parseDocx } from "@word-auto/parser";
import { validateDoc } from "@word-auto/validator";
import type { RuleLibrary, ValidationReport } from "@word-auto/validator";

export type { ValidationReport };

/** 浏览器内完成：解析 docx + 规则校验（文件不上传，纯本地计算） */
export const analyze = (
  buf: ArrayBuffer,
  rules: RuleLibrary,
): ValidationReport => validateDoc(parseDocx(new Uint8Array(buf)), rules);
