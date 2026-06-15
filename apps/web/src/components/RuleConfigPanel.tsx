import { useMemo, useState } from "react";
import { lintRuleLibrary } from "@word-auto/validator";
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
  RuleConfigSummary,
  RuleConfigToolbar,
  type LibraryOption,
} from "./RuleConfigPanelSections.js";


interface Props {
  draft: RuleDraft;
  published: EditableRuleLibrary;
  publishedUpdatedAt: string;
  draftDirty: boolean;
  unpublishedChanges: boolean;
  libraryOptions: LibraryOption[];
  statusMessage: string | null;
  onSelectLibrary: (id: string) => void;
  onChange: (draft: RuleDraft) => void;
  onSaveDraft: () => void;
  onPublish: () => void;
  onImport: () => void;
  onExportDraft: () => void;
  onExportPublished: () => void;
}

export function RuleConfigPanel({
  draft,
  published,
  publishedUpdatedAt,
  draftDirty,
  unpublishedChanges,
  libraryOptions,
  statusMessage,
  onSelectLibrary,
  onChange,
  onSaveDraft,
  onPublish,
  onImport,
  onExportDraft,
  onExportPublished,
}: Props) {
  const [roleIdx, setRoleIdx] = useState(0);
  const lint = useMemo(() => lintRuleLibrary(draft), [draft]);
  const safeRoleIdx = Math.min(roleIdx, Math.max(draft.roles.length - 1, 0));
  const role = draft.roles[safeRoleIdx];

  const allItems: RuleLintItem[] = [...lint.errors, ...lint.warnings, ...lint.infos];
  const globalItems = allItems.filter((item) => !item.field);
  const fieldItems = (roleKey: string, fieldKey: string): RuleLintItem[] =>
    allItems.filter((item) => item.role === roleKey && item.field === fieldKey);
  const roleErrors = (roleKey: string): number =>
    lint.errors.filter((item) => item.role === roleKey).length;
  const roleLabel = (roleKey: string): string =>
    draft.roles.find((item) => item.role === roleKey)?.label ?? roleKey;

  const patchDraft = (updater: (next: RuleDraft) => void): void => {
    const next = structuredClone(draft);
    updater(next);
    onChange(next);
  };

  const patchField = (fieldIdx: number, patch: Partial<RuleField>): void => {
    patchDraft((next) => {
      Object.assign(next.roles[safeRoleIdx].fields[fieldIdx], patch);
    });
  };

  const patchFieldValue = (fieldIdx: number, patch: Partial<RuleValue>): void => {
    patchDraft((next) => {
      Object.assign(next.roles[safeRoleIdx].fields[fieldIdx].value, patch);
    });
  };

  return (
    <div className="card">
      <RuleConfigToolbar
        draft={draft}
        draftDirty={draftDirty}
        libraryOptions={libraryOptions}
        lint={lint}
        onExportDraft={onExportDraft}
        onExportPublished={onExportPublished}
        onImport={onImport}
        onPublish={onPublish}
        onSaveDraft={onSaveDraft}
        onSelectLibrary={onSelectLibrary}
        publishedUpdatedAt={publishedUpdatedAt}
        statusMessage={statusMessage}
        unpublishedChanges={unpublishedChanges}
      />
      <RuleConfigSummary
        draft={draft}
        lint={lint}
        publishedVersion={published.version}
      />
      <RuleConfigGlobalIssues items={globalItems} roleLabel={roleLabel} />
      <RuleConfigFieldPane
        draft={draft}
        fieldItems={fieldItems}
        onPatchField={patchField}
        onPatchFieldValue={patchFieldValue}
        role={role}
        roleErrors={roleErrors}
        safeRoleIdx={safeRoleIdx}
        setRoleIdx={setRoleIdx}
      />
    </div>
  );
}
