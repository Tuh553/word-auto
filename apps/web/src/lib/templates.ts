import { normalizeRuleLibrary } from "@word-auto/validator";
import type { EditableRuleLibrary, LegacyRuleLibrary } from "@word-auto/validator";
import chongqing from "../templates/chongqing-thesis-phase1.json";

export const BUILTIN_RULE_LIBRARIES: EditableRuleLibrary[] = [
  normalizeRuleLibrary(chongqing as LegacyRuleLibrary),
];
