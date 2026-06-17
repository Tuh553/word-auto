import { RuleConfigPanel } from "./RuleConfigPanel.js";
import { TemplateProposalPanel } from "./TemplateProposalPanel.js";
import type {
  DocumentRuleProposal,
  DocumentRuleProposalField,
  RuleProposal,
} from "@word-auto/validator";
import type { RuleLibraryRecord } from "../lib/ruleLibraries.js";

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
  libraries: RuleLibraryRecord[];
  proposalFeedback: ProposalFeedback | null;
  ruleMessage: string | null;
  unpublishedChanges: boolean;
  onAcceptDocument: (proposal: DocumentRuleProposal) => void;
  onAcceptDocumentField: (proposal: DocumentRuleProposal, field: DocumentRuleProposalField) => void;
  onAcceptField: (role: ProposalRole, field: ProposalField) => void;
  onAcceptRole: (role: ProposalRole) => void;
  onChangeDraft: (draft: RuleLibraryRecord["draft"]) => void;
  onClearProposalFeedback: () => void;
  onExportDraft: () => void;
  onExportPublished: () => void;
  onExtract: () => void;
  onImport: () => void;
  onPublish: () => void;
  onSaveDraft: () => void;
  onSelectLibrary: (id: string) => void;
};

export function RulesWorkspace({
  currentLibrary,
  currentProposal,
  draftDirty,
  libraries,
  proposalFeedback,
  ruleMessage,
  unpublishedChanges,
  onAcceptDocument,
  onAcceptDocumentField,
  onAcceptField,
  onAcceptRole,
  onChangeDraft,
  onClearProposalFeedback,
  onExportDraft,
  onExportPublished,
  onExtract,
  onImport,
  onPublish,
  onSaveDraft,
  onSelectLibrary,
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
          name: item.published.name,
          version: item.published.version,
        }))}
        statusMessage={ruleMessage}
        onSelectLibrary={onSelectLibrary}
        onChange={onChangeDraft}
        onSaveDraft={onSaveDraft}
        onPublish={onPublish}
        onImport={onImport}
        onExportDraft={onExportDraft}
        onExportPublished={onExportPublished}
      />
      <TemplateProposalPanel
        draft={currentLibrary.draft}
        proposal={currentProposal}
        proposalFeedback={proposalFeedback}
        onAcceptDocument={onAcceptDocument}
        onAcceptDocumentField={onAcceptDocumentField}
        onExtract={onExtract}
        onAcceptField={onAcceptField}
        onAcceptRole={onAcceptRole}
        onClearFeedback={onClearProposalFeedback}
      />
    </>
  );
}
