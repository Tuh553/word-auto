import { RuleConfigPanel } from "./RuleConfigPanel.js";
import { TemplateProposalPanel } from "./TemplateProposalPanel.js";
import type { RuleProposal } from "@word-auto/validator";
import type { RuleLibraryRecord } from "../lib/ruleLibraries.js";

type ProposalRole = RuleProposal["roles"][number];
type ProposalField = ProposalRole["fields"][number];

type RulesWorkspaceProps = {
  currentLibrary: RuleLibraryRecord | undefined;
  currentProposal: RuleProposal | null;
  draftDirty: boolean;
  libraries: RuleLibraryRecord[];
  ruleMessage: string | null;
  unpublishedChanges: boolean;
  onAcceptField: (role: ProposalRole, field: ProposalField) => void;
  onAcceptRole: (role: ProposalRole) => void;
  onChangeDraft: (draft: RuleLibraryRecord["draft"]) => void;
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
  ruleMessage,
  unpublishedChanges,
  onAcceptField,
  onAcceptRole,
  onChangeDraft,
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
        onExtract={onExtract}
        onAcceptField={onAcceptField}
        onAcceptRole={onAcceptRole}
      />
    </>
  );
}
