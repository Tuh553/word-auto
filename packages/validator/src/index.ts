export * from "./types.js";
export { classifyParagraphs } from "./classify.js";
export { validateDoc } from "./validate.js";
export { computeFixHint, type FixHint, type Fixability } from "./fixhints.js";
export {
  buildCaptionReferenceGraph,
} from "./caption-links.js";
export {
  checkCaptionReferenceValidity,
} from "./reference-check.js";
export {
  checkNoteConsistency,
} from "./notes-check.js";
export {
  checkHeadingSequence,
  checkFigureCaptionSequence,
  checkTableCaptionSequence,
  checkNumberingSequence,
} from "./numbering-check.js";
export {
  recognizeList,
  recognizeAllLists,
  groupLists,
  type ListType,
  type ListItem,
  type ListGroup,
} from "./list-recognition.js";
export {
  FIELD_LABELS,
  ROLE_LABELS,
  RULE_FIELD_ORDER,
  RULE_FIELD_UNITS,
  buildRuleField,
  defaultSeverityForField,
  getFieldLabel,
  getRoleLabel,
  isEditableRuleLibrary,
  normalizeRuleLibrary,
  toLegacyRuleLibrary,
} from "./rules.js";
export { lintRuleLibrary, RULE_LINT_CODES } from "./lint.js";
export {
  applyProposalFieldToDraft,
  applyProposalRoleToDraft,
  extractRuleProposal,
} from "./proposals.js";
