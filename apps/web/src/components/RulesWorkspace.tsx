import { RuleConfigPanel } from "./RuleConfigPanel.js";
import { TemplateProposalPanel } from "./TemplateProposalPanel.js";
import type {
  DocumentRuleProposal,
  DocumentRuleProposalField,
  RuleProposal,
} from "@word-auto/validator";
import type { RuleLibraryRecord } from "../lib/ruleLibraries.js";
import { isBuiltinRuleLibrary } from "../lib/ruleLibraries.js";
import type { ProposalIgnoreKey } from "../lib/proposalIgnores.js";

type ProposalRole = RuleProposal["roles"][number];
type ProposalField = ProposalRole["fields"][number];
type ProposalFeedback = {
  kind: "success" | "error" | "info";
  title: string;
  details: string[];
};

type RulesWorkspaceProps = {
  currentLibrary: RuleLibraryRecord | undefined;
  currentProposal: RuleProposal | null;
  draftDirty: boolean;
  ignoredProposalKeys: Set<ProposalIgnoreKey>;
  libraries: RuleLibraryRecord[];
  proposalFeedback: ProposalFeedback | null;
  ruleMessage: string | null;
  showIgnoredProposals: boolean;
  unpublishedChanges: boolean;
  onAcceptDocument: (proposal: DocumentRuleProposal) => void;
  onAcceptDocumentField: (proposal: DocumentRuleProposal, field: DocumentRuleProposalField) => void;
  onAcceptField: (role: ProposalRole, field: ProposalField) => void;
  onAcceptRole: (role: ProposalRole) => void;
  onChangeDraft: (draft: RuleLibraryRecord["draft"]) => void;
  onClearProposalFeedback: () => void;
  onCreateLibrary: (name: string) => void;
  onDeleteLibrary: () => void;
  onDuplicateLibrary: (name?: string) => void;
  onExportDraft: () => void;
  onExportPublished: () => void;
  onExtract: () => void;
  onIgnoreProposal: (key: ProposalIgnoreKey) => void;
  onImport: () => void;
  onPublish: () => void;
  onRenameLibrary: (name: string) => void;
  onRestoreProposal: (key: ProposalIgnoreKey) => void;
  onSaveDraft: () => void;
  onSelectLibrary: (id: string) => void;
  onToggleIgnoredProposals: () => void;
};

export function RulesWorkspace({
  currentLibrary,
  currentProposal,
  draftDirty,
  ignoredProposalKeys,
  libraries,
  proposalFeedback,
  ruleMessage,
  showIgnoredProposals,
  unpublishedChanges,
  onAcceptDocument,
  onAcceptDocumentField,
  onAcceptField,
  onAcceptRole,
  onChangeDraft,
  onClearProposalFeedback,
  onCreateLibrary,
  onDeleteLibrary,
  onDuplicateLibrary,
  onExportDraft,
  onExportPublished,
  onExtract,
  onIgnoreProposal,
  onImport,
  onPublish,
  onRenameLibrary,
  onRestoreProposal,
  onSaveDraft,
  onSelectLibrary,
  onToggleIgnoredProposals,
}: RulesWorkspaceProps) {
  if (!currentLibrary) return null;

  return (
    <>
      <RuleConfigPanel
        draft={currentLibrary.draft}
        published={currentLibrary.published}
        publishedUpdatedAt={currentLibrary.publishedUpdatedAt}
        draftDirty={draftDirty}
        unpublishedChanges={unpublishedChanges}
        libraryOptions={libraries.map((item) => ({
          id: item.id,
          isBuiltin: isBuiltinRuleLibrary(item.id),
          name: item.published.name,
          version: item.published.version,
        }))}
        statusMessage={ruleMessage}
        onSelectLibrary={onSelectLibrary}
        onChange={onChangeDraft}
        onCreateLibrary={onCreateLibrary}
        onDeleteLibrary={onDeleteLibrary}
        onDuplicateLibrary={onDuplicateLibrary}
        onSaveDraft={onSaveDraft}
        onPublish={onPublish}
        onImport={onImport}
        onExportDraft={onExportDraft}
        onExportPublished={onExportPublished}
        onRenameLibrary={onRenameLibrary}
      />
      <TemplateProposalPanel
        draft={currentLibrary.draft}
        ignoredProposalKeys={ignoredProposalKeys}
        proposal={currentProposal}
        proposalFeedback={proposalFeedback}
        showIgnoredProposals={showIgnoredProposals}
        templateId={currentLibrary.id}
        onAcceptDocument={onAcceptDocument}
        onAcceptDocumentField={onAcceptDocumentField}
        onExtract={onExtract}
        onAcceptField={onAcceptField}
        onAcceptRole={onAcceptRole}
        onClearFeedback={onClearProposalFeedback}
        onIgnoreProposal={onIgnoreProposal}
        onRestoreProposal={onRestoreProposal}
        onToggleIgnoredProposals={onToggleIgnoredProposals}
      />
    </>
  );
}
