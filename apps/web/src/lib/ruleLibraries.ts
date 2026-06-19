import { lintRuleLibrary, normalizeRuleLibrary } from "@word-auto/validator";
import type {
  EditableRuleLibrary,
  LegacyRuleLibrary,
  RuleDraft,
} from "@word-auto/validator";
import { BUILTIN_RULE_LIBRARIES } from "./templates.js";

const STORAGE_KEY = "word-auto.rule-libraries.v1";
const SELECTED_STORAGE_KEY = "word-auto.rule-libraries.selected.v1";

export interface RuleLibraryRecord {
  id: string;
  published: EditableRuleLibrary;
  publishedUpdatedAt: string;
  draft: RuleDraft;
}

const clone = <T,>(value: T): T => structuredClone(value);

const nowIso = (): string => new Date().toISOString();
const BUILTIN_RULE_LIBRARY_IDS = new Set(BUILTIN_RULE_LIBRARIES.map((lib) => lib.id));

export const isBuiltinRuleLibrary = (id: string): boolean =>
  BUILTIN_RULE_LIBRARY_IDS.has(id);

const toEditableLibrary = (
  input: EditableRuleLibrary | LegacyRuleLibrary | RuleDraft,
): EditableRuleLibrary => {
  const normalized = normalizeRuleLibrary(input);
  return clone({
    id: normalized.id,
    name: normalized.name,
    version: normalized.version,
    basedOn: normalized.basedOn,
    source: normalized.source,
    document: normalized.document,
    pageNumbers: normalized.pageNumbers,
    headers: normalized.headers,
    statistics: normalized.statistics,
    roles: normalized.roles,
  });
};

const toDraft = (
  lib: EditableRuleLibrary,
  updatedAt = nowIso(),
): RuleDraft => ({
  ...clone(lib),
  status: "draft",
  updatedAt,
});

const seedRecords = (): RuleLibraryRecord[] =>
  BUILTIN_RULE_LIBRARIES.map((lib) => {
    const published = toEditableLibrary(lib);
    const updatedAt = nowIso();
    return {
      id: published.id,
      published,
      publishedUpdatedAt: updatedAt,
      draft: toDraft(published, updatedAt),
    };
  });

const normalizeName = (name: string): string => name.trim().replace(/\s+/g, " ");

const slugify = (name: string): string => {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "rule-library";
};

const uniqueId = (base: string, existingIds: string[]): string => {
  let id = base;
  let n = 2;
  while (existingIds.includes(id)) {
    id = `${base}-${n}`;
    n++;
  }
  return id;
};

const uniqueTemplateName = (base: string, existingNames: string[]): string => {
  if (!existingNames.includes(base)) return base;
  let n = 2;
  let name = `${base} ${n}`;
  while (existingNames.includes(name)) {
    n++;
    name = `${base} ${n}`;
  }
  return name;
};

const emptyEditableLibrary = (id: string, name: string): EditableRuleLibrary => ({
  id,
  name,
  version: "1.0.0",
  roles: [
    {
      role: "body_text",
      label: "正文",
      fields: [],
    },
  ],
});

const withBuiltinDefaults = (records: RuleLibraryRecord[]): RuleLibraryRecord[] => {
  const byId = new Map(records.map((record) => [record.id, record]));
  for (const builtin of BUILTIN_RULE_LIBRARIES) {
    if (!byId.has(builtin.id)) {
      const updatedAt = nowIso();
      byId.set(builtin.id, {
        id: builtin.id,
        published: toEditableLibrary(builtin),
        publishedUpdatedAt: updatedAt,
        draft: toDraft(builtin, updatedAt),
      });
    }
  }
  return [...byId.values()];
};

const normalizeRecord = (record: RuleLibraryRecord): RuleLibraryRecord => {
  const published = toEditableLibrary(record.published);
  const updatedAt = record.publishedUpdatedAt ?? nowIso();
  const draftSource = record.draft ? toEditableLibrary(record.draft) : published;
  return {
    id: published.id,
    published,
    publishedUpdatedAt: updatedAt,
    draft: toDraft({ ...draftSource, id: published.id }, record.draft?.updatedAt ?? updatedAt),
  };
};

export const loadRuleLibraryRecords = (): RuleLibraryRecord[] => {
  if (typeof window === "undefined" || !window.localStorage) {
    return seedRecords();
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const seeded = seedRecords();
    saveRuleLibraryRecords(seeded);
    return seeded;
  }

  try {
    const parsed = JSON.parse(raw) as RuleLibraryRecord[];
    const normalized = withBuiltinDefaults(parsed.map(normalizeRecord));
    saveRuleLibraryRecords(normalized);
    return normalized;
  } catch {
    const seeded = seedRecords();
    saveRuleLibraryRecords(seeded);
    return seeded;
  }
};

export const saveRuleLibraryRecords = (records: RuleLibraryRecord[]): void => {
  if (typeof window === "undefined" || !window.localStorage) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
};

export const loadSelectedRuleLibraryId = (records: RuleLibraryRecord[]): string => {
  if (typeof window === "undefined" || !window.localStorage) {
    return records[0]?.id ?? "";
  }

  const selected = window.localStorage.getItem(SELECTED_STORAGE_KEY);
  if (selected && records.some((record) => record.id === selected)) {
    return selected;
  }
  return records[0]?.id ?? "";
};

export const saveSelectedRuleLibraryId = (id: string): void => {
  if (typeof window === "undefined" || !window.localStorage) return;
  window.localStorage.setItem(SELECTED_STORAGE_KEY, id);
};

export const stripDraftMeta = (draft: RuleDraft): EditableRuleLibrary =>
  toEditableLibrary(draft);

export const createBlankRuleLibraryRecord = (
  name: string,
  existing: RuleLibraryRecord[],
): RuleLibraryRecord => {
  const normalizedName = normalizeName(name) || "新建模板";
  const id = uniqueId(slugify(normalizedName), existing.map((item) => item.id));
  const uniqueName = uniqueTemplateName(
    normalizedName,
    existing.map((item) => item.published.name),
  );
  const published = emptyEditableLibrary(id, uniqueName);
  const updatedAt = nowIso();
  return {
    id,
    published,
    publishedUpdatedAt: updatedAt,
    draft: toDraft(published, updatedAt),
  };
};

export const duplicateRuleLibraryRecord = (
  source: RuleLibraryRecord,
  existing: RuleLibraryRecord[],
  name?: string,
): RuleLibraryRecord => {
  const requestedName = normalizeName(name ?? `${source.published.name} 副本`);
  const uniqueName = uniqueTemplateName(
    requestedName || `${source.published.name} 副本`,
    existing.map((item) => item.published.name),
  );
  const id = uniqueId(slugify(uniqueName), existing.map((item) => item.id));
  const updatedAt = nowIso();
  const published: EditableRuleLibrary = {
    ...clone(source.published),
    id,
    name: uniqueName,
    basedOn: source.published.id,
  };
  const draftSource = stripDraftMeta(source.draft);
  const draft = toDraft({
    ...draftSource,
    id,
    name: uniqueName,
    basedOn: draftSource.basedOn ?? source.published.id,
  }, source.draft.updatedAt ?? updatedAt);
  return {
    id,
    published,
    publishedUpdatedAt: source.publishedUpdatedAt,
    draft,
  };
};

export const renameRuleLibraryRecord = (
  record: RuleLibraryRecord,
  name: string,
): RuleLibraryRecord => {
  const normalizedName = normalizeName(name);
  if (!normalizedName) throw new Error("模板名称不能为空");
  return {
    ...record,
    published: {
      ...record.published,
      name: normalizedName,
    },
    draft: {
      ...record.draft,
      name: normalizedName,
    },
  };
};

export const deleteRuleLibraryRecord = (
  records: RuleLibraryRecord[],
  id: string,
): { records: RuleLibraryRecord[]; nextTemplateId: string } => {
  if (isBuiltinRuleLibrary(id)) {
    throw new Error("内置模板不能删除");
  }
  const next = records.filter((record) => record.id !== id);
  if (next.length === records.length) {
    throw new Error("要删除的模板不存在");
  }
  const preferred = next.find((record) => isBuiltinRuleLibrary(record.id)) ?? next[0];
  return {
    records: next,
    nextTemplateId: preferred?.id ?? "",
  };
};

const stableStringify = (value: unknown): string => JSON.stringify(value);

export const hasUnpublishedChanges = (record: RuleLibraryRecord): boolean =>
  stableStringify(stripDraftMeta(record.draft)) !== stableStringify(record.published);

export const sameDraftAsSaved = (
  current: RuleLibraryRecord,
  saved: RuleLibraryRecord | undefined,
): boolean =>
  saved != null &&
  stableStringify(stripDraftMeta(current.draft)) === stableStringify(stripDraftMeta(saved.draft));

export const touchDraft = (record: RuleLibraryRecord): RuleLibraryRecord => {
  const updatedAt = nowIso();
  return {
    ...record,
    draft: toDraft({ ...stripDraftMeta(record.draft), id: record.id }, updatedAt),
  };
};

const bumpVersion = (version: string): string => {
  const parts = version.split(".");
  const last = Number(parts.at(-1));
  if (!Number.isFinite(last)) return `${version}-1`;
  parts[parts.length - 1] = String(last + 1);
  return parts.join(".");
};

export const publishDraft = (record: RuleLibraryRecord): RuleLibraryRecord => {
  const lint = lintRuleLibrary(stripDraftMeta(record.draft));
  if (!lint.ok) {
    throw new Error("规则草稿仍有阻断性错误，无法发布");
  }

  const updatedAt = nowIso();
  const draft = stripDraftMeta(record.draft);
  const version = hasUnpublishedChanges(record)
    ? bumpVersion(record.published.version)
    : record.published.version;
  const published = {
    ...draft,
    id: record.id,
    version,
  };

  return {
    id: record.id,
    published,
    publishedUpdatedAt: updatedAt,
    draft: toDraft(published, updatedAt),
  };
};

export const parseImportedRuleLibrary = (
  text: string,
  existingIds: string[],
): RuleLibraryRecord => {
  const parsed = JSON.parse(text.replace(/^﻿/, "")) as LegacyRuleLibrary | EditableRuleLibrary | RuleDraft;
  const normalized = toEditableLibrary(parsed);
  const lint = lintRuleLibrary(normalized);
  if (!lint.ok) {
    throw new Error(`导入失败：规则库存在 ${lint.errors.length} 个阻断性错误`);
  }

  let id = normalized.id || "rule-library";
  let n = 2;
  while (existingIds.includes(id)) {
    id = `${normalized.id || "rule-library"}-${n}`;
    n++;
  }

  const published = { ...normalized, id };
  const updatedAt = nowIso();
  return {
    id,
    published,
    publishedUpdatedAt: updatedAt,
    draft: toDraft(published, updatedAt),
  };
};

export const serializeRuleLibrary = (lib: EditableRuleLibrary | RuleDraft): string =>
  JSON.stringify(lib, null, 2);
