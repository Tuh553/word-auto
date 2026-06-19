import { useMemo, useState } from "react";
import { getRoleLabel, lintRuleLibrary } from "@word-auto/validator";
import type {
  EditableRuleLibrary,
  RuleDraft,
  RuleField,
  RuleLintItem,
  RuleValue,
} from "@word-auto/validator";
import {
  RuleConfigFieldPane,
  RuleConfigGlobalIssues,
  RuleConfigSectionTabs,
  RuleConfigSummary,
  RuleConfigToolbar,
  type RuleConfigSection,
  type LibraryOption,
} from "./RuleConfigPanelSections.js";
import {
  RuleConfigPlainSectionPane,
  RuleConfigRoleSnapshot,
} from "./RuleConfigStaticSections.js";


interface Props {
  draft: RuleDraft;
  published: EditableRuleLibrary;
  publishedUpdatedAt: string;
  draftDirty: boolean;
  unpublishedChanges: boolean;
  libraryOptions: LibraryOption[];
  onCreateLibrary: (name: string) => void;
  onDeleteLibrary: () => void;
  onDuplicateLibrary: (name?: string) => void;
  statusMessage: string | null;
  onSelectLibrary: (id: string) => void;
  onChange: (draft: RuleDraft) => void;
  onSaveDraft: () => void;
  onPublish: () => void;
  onImport: () => void;
  onExportDraft: () => void;
  onExportPublished: () => void;
  onRenameLibrary: (name: string) => void;
}

type EditorProps = {
  activeSection: RuleConfigSection;
  draft: RuleDraft;
  fieldItems: (roleKey: string, fieldKey: string) => RuleLintItem[];
  onPatchField: (fieldIdx: number, patch: Partial<RuleField>) => void;
  onPatchFieldValue: (fieldIdx: number, patch: Partial<RuleValue>) => void;
  onSectionChange: (section: RuleConfigSection) => void;
  published: EditableRuleLibrary;
  role: RuleDraft["roles"][number] | undefined;
  roleErrors: (roleKey: string) => number;
  safeRoleIdx: number;
  setRoleIdx: (index: number) => void;
};

function RuleConfigEditor({
  activeSection,
  draft,
  fieldItems,
  onPatchField,
  onPatchFieldValue,
  onSectionChange,
  published,
  role,
  roleErrors,
  safeRoleIdx,
  setRoleIdx,
}: EditorProps) {
  return (
    <>
      <RuleConfigSectionTabs
        activeSection={activeSection}
        draft={draft}
        onChange={onSectionChange}
      />
      {activeSection === "roles" ? (
        <>
          <RuleConfigRoleSnapshot role={role} />
          <RuleConfigFieldPane
            draft={draft}
            fieldItems={fieldItems}
            onPatchField={onPatchField}
            onPatchFieldValue={onPatchFieldValue}
            role={role}
            roleErrors={roleErrors}
            safeRoleIdx={safeRoleIdx}
            setRoleIdx={setRoleIdx}
          />
        </>
      ) : (
        <RuleConfigPlainSectionPane
          draft={draft}
          published={published}
          section={activeSection}
        />
      )}
    </>
  );
}

const patchDraftClone = (
  draft: RuleDraft,
  onChange: (draft: RuleDraft) => void,
  updater: (next: RuleDraft) => void,
): void => {
  const next = structuredClone(draft);
  updater(next);
  onChange(next);
};

const displayRoleLabel = (draft: RuleDraft, roleKey: string): string => {
  const configuredLabel = draft.roles.find((item) => item.role === roleKey)?.label;
  if (configuredLabel) return configuredLabel;
  const fallback = getRoleLabel(roleKey);
  return fallback === roleKey ? "未知角色" : fallback;
};

const useRuleConfigPanelModel = (
  draft: RuleDraft,
  onChange: (draft: RuleDraft) => void,
) => {
  const [roleIdx, setRoleIdx] = useState(0);
  const [activeSection, setActiveSection] = useState<RuleConfigSection>("roles");
  const lint = useMemo(() => lintRuleLibrary(draft), [draft]);
  const safeRoleIdx = Math.min(roleIdx, Math.max(draft.roles.length - 1, 0));
  const role = draft.roles[safeRoleIdx];
  const allItems: RuleLintItem[] = [...lint.errors, ...lint.warnings, ...lint.infos];
  const globalItems = allItems.filter((item) => !item.field);
  const fieldItems = (roleKey: string, fieldKey: string): RuleLintItem[] =>
    allItems.filter((item) => item.role === roleKey && item.field === fieldKey);
  const roleErrors = (roleKey: string): number =>
    lint.errors.filter((item) => item.role === roleKey).length;
  const roleLabel = (roleKey: string): string => displayRoleLabel(draft, roleKey);
  const patchField = (fieldIdx: number, patch: Partial<RuleField>): void => {
    patchDraftClone(draft, onChange, (next) => {
      Object.assign(next.roles[safeRoleIdx].fields[fieldIdx], patch);
    });
  };
  const patchFieldValue = (fieldIdx: number, patch: Partial<RuleValue>): void => {
    patchDraftClone(draft, onChange, (next) => {
      Object.assign(next.roles[safeRoleIdx].fields[fieldIdx].value, patch);
    });
  };

  return {
    activeSection,
    fieldItems,
    globalItems,
    lint,
    patchField,
    patchFieldValue,
    role,
    roleErrors,
    roleLabel,
    safeRoleIdx,
    setActiveSection,
    setRoleIdx,
  };
};

export function RuleConfigPanel({
  draft,
  published,
  publishedUpdatedAt,
  draftDirty,
  unpublishedChanges,
  libraryOptions,
  onCreateLibrary,
  onDeleteLibrary,
  onDuplicateLibrary,
  statusMessage,
  onSelectLibrary,
  onChange,
  onSaveDraft,
  onPublish,
  onImport,
  onExportDraft,
  onExportPublished,
  onRenameLibrary,
}: Props) {
  const model = useRuleConfigPanelModel(draft, onChange);

  return (
    <div className="card">
      <RuleConfigToolbar
        draft={draft}
        draftDirty={draftDirty}
        libraryOptions={libraryOptions}
        lint={model.lint}
        onCreateLibrary={onCreateLibrary}
        onDeleteLibrary={onDeleteLibrary}
        onDuplicateLibrary={onDuplicateLibrary}
        onExportDraft={onExportDraft}
        onExportPublished={onExportPublished}
        onImport={onImport}
        onPublish={onPublish}
        onRenameLibrary={onRenameLibrary}
        onSaveDraft={onSaveDraft}
        onSelectLibrary={onSelectLibrary}
        publishedUpdatedAt={publishedUpdatedAt}
        statusMessage={statusMessage}
        unpublishedChanges={unpublishedChanges}
      />
      <RuleConfigSummary
        draft={draft}
        lint={model.lint}
        publishedVersion={published.version}
      />
      <RuleConfigGlobalIssues
        items={model.globalItems}
        roleLabel={model.roleLabel}
      />
      <RuleConfigEditor
        activeSection={model.activeSection}
        draft={draft}
        fieldItems={model.fieldItems}
        onPatchField={model.patchField}
        onPatchFieldValue={model.patchFieldValue}
        onSectionChange={model.setActiveSection}
        published={published}
        role={model.role}
        roleErrors={model.roleErrors}
        safeRoleIdx={model.safeRoleIdx}
        setRoleIdx={model.setRoleIdx}
      />
    </div>
  );
}
