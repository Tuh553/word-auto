import { normalizeRuleLibrary } from "@word-auto/validator";
import type { EditableRuleLibrary, LegacyRuleLibrary } from "@word-auto/validator";
import chongqing from "../templates/chongqing-thesis-phase1.json";

export interface Template {
  id: string;
  name: string;
  rules: EditableRuleLibrary;
}

// 内置模板。后续多模板时在此扩展，或改为远程加载。
export const TEMPLATES: Template[] = [
  {
    id: "chongqing-thesis-phase1",
    name: "重庆大学专业学位论文（第一阶段）",
    rules: normalizeRuleLibrary(chongqing as LegacyRuleLibrary),
  },
];
