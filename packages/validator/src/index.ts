export * from "./types.js";
export {
  classifyParagraphDetails,
  classifyParagraphs,
} from "./classify.js";
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
  DOCUMENT_FIELD_LABELS,
  DOCUMENT_FIELD_ORDER,
  FIELD_LABELS,
  HEADER_FIELD_LABELS,
  HEADER_FIELD_ORDER,
  PAGE_NUMBER_FIELD_LABELS,
  PAGE_NUMBER_FIELD_ORDER,
  ROLE_LABELS,
  RULE_FIELD_ORDER,
  RULE_FIELD_UNITS,
  buildRuleField,
  defaultSeverityForField,
  getDocumentFieldLabel,
  getFieldLabel,
  getHeaderFieldLabel,
  getPageNumberFieldLabel,
  getRoleLabel,
  isEditableRuleLibrary,
  normalizeRuleLibrary,
  toLegacyRuleLibrary,
} from "./rules.js";
export { lintRuleLibrary, RULE_LINT_CODES } from "./lint.js";
export {
  extractRuleProposal,
} from "./proposals.js";
export {
  applyDocumentProposalFieldToDraftWithResult,
  applyDocumentProposalToDraftWithResult,
  applyProposalFieldToDraft,
  applyProposalFieldToDraftWithResult,
  applyProposalRoleToDraft,
  applyProposalRoleToDraftWithResult,
} from "./proposals-apply.js";
