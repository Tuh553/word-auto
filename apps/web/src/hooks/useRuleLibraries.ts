import { useState } from "react";
import {
  hasUnpublishedChanges,
  parseImportedRuleLibrary,
  publishDraft,
  sameDraftAsSaved,
  saveRuleLibraryRecords,
  serializeRuleLibrary,
  stripDraftMeta,
  touchDraft,
  type RuleLibraryRecord,
} from "../lib/ruleLibraries.js";

const downloadJson = (filename: string, content: string) => {
  const blob = new Blob([content], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

const useRuleLibraryState = (initialLibraries: RuleLibraryRecord[]) => {
  const [libraries, setLibraries] = useState(initialLibraries);
  const [savedLibraries, setSavedLibraries] = useState(
    structuredClone(initialLibraries),
  );
  const [templateId, setTemplateId] = useState(initialLibraries[0]?.id ?? "");
  const [ruleMessage, setRuleMessage] = useState<string | null>(null);

  const currentLibrary = libraries.find((item) => item.id === templateId) ?? libraries[0];
  const savedLibrary = savedLibraries.find((item) => item.id === currentLibrary?.id);
  const draftDirty = currentLibrary ? !sameDraftAsSaved(currentLibrary, savedLibrary) : false;
  const unpublishedChanges = currentLibrary ? hasUnpublishedChanges(currentLibrary) : false;
  const persistLibraries = (next: RuleLibraryRecord[]) => {
    setLibraries(next);
    setSavedLibraries(structuredClone(next));
    saveRuleLibraryRecords(next);
  };

  return {
    currentLibrary,
    draftDirty,
    libraries,
    persistLibraries,
    ruleMessage,
    setLibraries,
    setRuleMessage,
    setTemplateId,
    templateId,
    unpublishedChanges,
  };
};

const useRuleLibraryActions = ({
  currentLibrary,
  draftDirty,
  libraries,
  persistLibraries,
  setRuleMessage,
  setLibraries,
  setTemplateId,
  unpublishedChanges,
}: ReturnType<typeof useRuleLibraryState>) => {
  const updateLibrary = (updater: (record: RuleLibraryRecord) => RuleLibraryRecord) => {
    if (!currentLibrary) return;
    setLibraries((prev) =>
      prev.map((item) => (item.id === currentLibrary.id ? updater(item) : item)),
    );
  };

  const selectLibrary = (id: string) => {
    setTemplateId(id);
    setRuleMessage(null);
  };

  const updateDraft = (draft: RuleLibraryRecord["draft"]) => {
    updateLibrary((record) => ({
      ...record,
      draft: {
        ...record.draft,
        ...stripDraftMeta(draft),
        status: "draft",
        updatedAt: record.draft.updatedAt,
      },
    }));
    setRuleMessage(null);
  };

  const saveDraft = () => {
    if (!currentLibrary) return;
    if (!draftDirty) {
      setRuleMessage("当前没有未保存的草稿变更");
      return;
    }
    const next = libraries.map((item) =>
      item.id === currentLibrary.id ? touchDraft(item) : item,
    );
    persistLibraries(next);
    setRuleMessage("草稿已保存到本地浏览器");
  };

  return {
    currentLibrary,
    libraries,
    persistLibraries,
    saveDraft,
    selectLibrary,
    setRuleMessage,
    setTemplateId,
    unpublishedChanges,
    updateDraft,
    updateLibrary,
  };
};

const useRuleLibraryPublishActions = ({
  currentLibrary,
  libraries,
  persistLibraries,
  setRuleMessage,
  unpublishedChanges,
}: Pick<
  ReturnType<typeof useRuleLibraryActions>,
  "currentLibrary" | "libraries" | "persistLibraries" | "setRuleMessage" | "unpublishedChanges"
>) => {
  const publishCurrentLibrary = () => {
    if (!currentLibrary) return null;
    if (!unpublishedChanges) {
      setRuleMessage("草稿与已发布版本一致，无需重复发布");
      return null;
    }
    try {
      const next = libraries.map((item) =>
        item.id === currentLibrary.id ? publishDraft(item) : item,
      );
      const publishedCurrent = next.find((item) => item.id === currentLibrary.id) ?? null;
      persistLibraries(next);
      if (publishedCurrent) setRuleMessage(`已发布 ${publishedCurrent.published.version}`);
      return publishedCurrent;
    } catch (cause) {
      setRuleMessage((cause as Error).message);
      return null;
    }
  };

  return { publishCurrentLibrary };
};

const useRuleLibraryIoActions = ({
  currentLibrary,
  libraries,
  persistLibraries,
  setRuleMessage,
  setTemplateId,
}: Pick<
  ReturnType<typeof useRuleLibraryActions>,
  "currentLibrary" | "libraries" | "persistLibraries" | "setRuleMessage" | "setTemplateId"
>) => {
  const importLibrary = async (fileToImport: File) => {
    try {
      const text = await fileToImport.text();
      const nextRecord = parseImportedRuleLibrary(
        text,
        libraries.map((item) => item.id),
      );
      const next = [...libraries, nextRecord];
      persistLibraries(next);
      setTemplateId(nextRecord.id);
      setRuleMessage(`已导入模板「${nextRecord.published.name}」`);
    } catch (cause) {
      setRuleMessage((cause as Error).message);
    }
  };

  const exportDraft = () => {
    if (!currentLibrary) return;
    downloadJson(
      `${currentLibrary.id}.draft.json`,
      serializeRuleLibrary(currentLibrary.draft),
    );
    setRuleMessage("草稿规则已导出");
  };

  const exportPublished = () => {
    if (!currentLibrary) return;
    downloadJson(
      `${currentLibrary.id}.published.json`,
      serializeRuleLibrary(currentLibrary.published),
    );
    setRuleMessage("生效规则已导出");
  };

  return { exportDraft, exportPublished, importLibrary };
};

export const useRuleLibraries = (initialLibraries: RuleLibraryRecord[]) => {
  const state = useRuleLibraryState(initialLibraries);
  const actions = useRuleLibraryActions(state);
  return {
    ...state,
    ...actions,
    ...useRuleLibraryPublishActions(actions),
    ...useRuleLibraryIoActions(actions),
  };
};
