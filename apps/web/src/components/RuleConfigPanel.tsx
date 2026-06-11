import { useMemo, useState } from "react";
import { lintRuleLibrary } from "@word-auto/validator";
import type {
  EditableRuleLibrary,
  RuleDraft,
  RuleField,
  RuleFieldSeverity,
  RuleLintItem,
  RuleValue,
} from "@word-auto/validator";

const MODE_LABEL: Record<RuleValue["mode"], string> = {
  exact: "精确值",
  oneOf: "候选之一",
  range: "范围",
  unset: "不校验",
};

const SEV_LABEL: Record<RuleFieldSeverity, string> = {
  error: "错误",
  warn: "警告",
  info: "提示",
};

const ALIGN_OPTIONS = ["left", "center", "right", "justify"] as const;
const BOOL_OPTIONS = [
  { label: "是", value: true },
  { label: "否", value: false },
] as const;
const FONT_SUGGESTIONS = [
  "宋体",
  "黑体",
  "仿宋",
  "楷体",
  "Times New Roman",
  "Arial",
  "Calibri",
];

const unitText = (u?: string): string =>
  u === "pt" ? " pt" : u === "chars" ? " 字符" : u === "level" ? " 级" : "";

const fmtScalar = (v: unknown): string => {
  if (typeof v === "boolean") return v ? "是" : "否";
  return v == null ? "—" : String(v);
};

const fmtValue = (v: RuleValue): string => {
  switch (v.mode) {
    case "exact":
      return `${fmtScalar(v.exact)}${unitText(v.unit)}`;
    case "oneOf":
      return (v.oneOf ?? []).map(fmtScalar).join(" / ") || "（空）";
    case "range":
      return `${v.min ?? "?"} ~ ${v.max ?? "?"}${unitText(v.unit)}`;
    case "unset":
      return "不校验";
  }
};

const isNumericUnit = (unit?: string): boolean =>
  unit === "pt" || unit === "chars" || unit === "level";

const parseScalar = (raw: string, unit?: string): string | number | boolean => {
  const text = raw.trim();
  if (unit === "bool") {
    if (["true", "1", "是", "yes"].includes(text.toLowerCase())) return true;
    if (["false", "0", "否", "no"].includes(text.toLowerCase())) return false;
    return text;
  }
  if (isNumericUnit(unit)) {
    const num = Number(text);
    return Number.isFinite(num) ? num : text;
  }
  return text;
};

const formatDateTime = (value?: string): string =>
  value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "未保存";

const modesForField = (field: RuleField): RuleValue["mode"][] =>
  isNumericUnit(field.value.unit)
    ? ["exact", "oneOf", "range", "unset"]
    : ["exact", "oneOf", "unset"];

const nextValueForMode = (
  field: RuleField,
  mode: RuleValue["mode"],
): RuleValue => {
  const unit = field.value.unit;
  const exactFromCurrent =
    field.value.exact ??
    field.value.oneOf?.[0] ??
    field.value.min ??
    (unit === "bool" ? false : undefined);

  switch (mode) {
    case "exact":
      return { mode, unit, exact: exactFromCurrent };
    case "oneOf":
      return {
        mode,
        unit,
        oneOf: field.value.oneOf ?? (exactFromCurrent != null ? [exactFromCurrent] : []),
      };
    case "range":
      return {
        mode,
        unit,
        min: typeof exactFromCurrent === "number" ? exactFromCurrent : field.value.min,
        max: typeof exactFromCurrent === "number" ? exactFromCurrent : field.value.max,
      };
    case "unset":
      return { mode, unit };
  }
};

const listText = (field: RuleField): string =>
  (field.value.oneOf ?? []).map((item) => fmtScalar(item)).join(", ");

interface LibraryOption {
  id: string;
  name: string;
  version: string;
}

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

  const setFieldMode = (fieldIdx: number, field: RuleField, mode: RuleValue["mode"]): void => {
    patchFieldValue(fieldIdx, nextValueForMode(field, mode));
  };

  const toggleOneOfValue = (fieldIdx: number, field: RuleField, value: string | number | boolean): void => {
    const current = field.value.oneOf ?? [];
    const exists = current.some((item) => item === value);
    patchFieldValue(fieldIdx, {
      oneOf: exists
        ? current.filter((item) => item !== value)
        : [...current, value],
    });
  };

  const renderExactEditor = (field: RuleField, fieldIdx: number) => {
    if (field.value.unit === "bool") {
      return (
        <select
          value={String(field.value.exact ?? true)}
          disabled={!field.enabled}
          onChange={(e) =>
            patchFieldValue(fieldIdx, { exact: e.target.value === "true" })
          }
        >
          {BOOL_OPTIONS.map((item) => (
            <option key={String(item.value)} value={String(item.value)}>
              {item.label}
            </option>
          ))}
        </select>
      );
    }

    if (field.key === "align") {
      return (
        <select
          value={String(field.value.exact ?? "left")}
          disabled={!field.enabled}
          onChange={(e) => patchFieldValue(fieldIdx, { exact: e.target.value })}
        >
          {ALIGN_OPTIONS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      );
    }

    if (field.value.unit === "enum") {
      const listId = `font-list-${field.key}`;
      return (
        <>
          <input
            list={listId}
            type="text"
            value={String(field.value.exact ?? "")}
            disabled={!field.enabled}
            onChange={(e) => patchFieldValue(fieldIdx, { exact: e.target.value })}
          />
          <datalist id={listId}>
            {FONT_SUGGESTIONS.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        </>
      );
    }

    return (
      <input
        type="number"
        step={field.value.unit === "pt" ? "0.1" : "1"}
        value={String(field.value.exact ?? "")}
        disabled={!field.enabled}
        onChange={(e) =>
          patchFieldValue(fieldIdx, {
            exact: e.target.value === "" ? undefined : Number(e.target.value),
          })
        }
      />
    );
  };

  const renderOneOfEditor = (field: RuleField, fieldIdx: number) => {
    if (field.value.unit === "bool") {
      const current = field.value.oneOf ?? [];
      return (
        <div className="rc-inline-options">
          {BOOL_OPTIONS.map((item) => (
            <label key={String(item.value)}>
              <input
                type="checkbox"
                checked={current.includes(item.value)}
                disabled={!field.enabled}
                onChange={() => toggleOneOfValue(fieldIdx, field, item.value)}
              />
              {item.label}
            </label>
          ))}
        </div>
      );
    }

    if (field.key === "align") {
      const current = field.value.oneOf ?? [];
      return (
        <div className="rc-inline-options">
          {ALIGN_OPTIONS.map((item) => (
            <label key={item}>
              <input
                type="checkbox"
                checked={current.includes(item)}
                disabled={!field.enabled}
                onChange={() => toggleOneOfValue(fieldIdx, field, item)}
              />
              {item}
            </label>
          ))}
        </div>
      );
    }

    return (
      <input
        type="text"
        value={listText(field)}
        disabled={!field.enabled}
        placeholder={field.value.unit === "enum" ? "用逗号分隔多个值" : "如 10.5, 12"}
        onChange={(e) =>
          patchFieldValue(fieldIdx, {
            oneOf: e.target.value
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean)
              .map((item) => parseScalar(item, field.value.unit)),
          })
        }
      />
    );
  };

  const renderRangeEditor = (field: RuleField, fieldIdx: number) => (
    <div className="rc-range-inputs">
      <input
        type="number"
        step={field.value.unit === "pt" ? "0.1" : "1"}
        value={String(field.value.min ?? "")}
        disabled={!field.enabled}
        placeholder="最小值"
        onChange={(e) =>
          patchFieldValue(fieldIdx, {
            min: e.target.value === "" ? undefined : Number(e.target.value),
          })
        }
      />
      <span>~</span>
      <input
        type="number"
        step={field.value.unit === "pt" ? "0.1" : "1"}
        value={String(field.value.max ?? "")}
        disabled={!field.enabled}
        placeholder="最大值"
        onChange={(e) =>
          patchFieldValue(fieldIdx, {
            max: e.target.value === "" ? undefined : Number(e.target.value),
          })
        }
      />
    </div>
  );

  const counts: Record<RuleFieldSeverity, number> = {
    error: lint.errors.length,
    warn: lint.warnings.length,
    info: lint.infos.length,
  };

  return (
    <div className="card">
      <div className="rc-toolbar">
        <div className="rc-toolbar-main">
          <div className="rc-selector">
            <label>当前模板</label>
            <select value={draft.id} onChange={(e) => onSelectLibrary(e.target.value)}>
              {libraryOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · v{item.version}
                </option>
              ))}
            </select>
          </div>
          <div className="rc-actions">
            <button onClick={onImport}>导入 JSON</button>
            <button onClick={onExportDraft}>导出草稿</button>
            <button onClick={onExportPublished}>导出生效</button>
            <button onClick={onSaveDraft}>保存草稿</button>
            <button className="primary" onClick={onPublish} disabled={!lint.ok}>
              发布规则
            </button>
          </div>
        </div>
        <div className="rc-toolbar-meta">
          <span>草稿：{draftDirty ? "未保存" : "已保存"}</span>
          <span>发布：{unpublishedChanges ? "有未发布变更" : "已同步到检测"}</span>
          <span>上次草稿保存：{formatDateTime(draft.updatedAt)}</span>
          <span>上次发布：{formatDateTime(publishedUpdatedAt)}</span>
        </div>
        {statusMessage && <div className="rc-message">{statusMessage}</div>}
      </div>

      <div className="rc-head">
        <div>
          <div className="rc-name">{draft.name}</div>
          <div className="rc-meta">
            草稿版本 {draft.version} · 生效版本 {published.version} · {draft.roles.length} 个角色
          </div>
        </div>
        <div className="stats" style={{ margin: 0, minWidth: 280 }}>
          {(["error", "warn", "info"] as RuleFieldSeverity[]).map((severity) => (
            <div className={`stat ${severity}`} key={severity}>
              <div className="n">{counts[severity]}</div>
              <div className="l">{SEV_LABEL[severity]}</div>
            </div>
          ))}
        </div>
      </div>

      <div className={`rc-status ${lint.ok ? "ok" : "bad"}`}>
        {lint.ok
          ? "✓ 规则合法性校验通过；发布后新的已发布版本会立即回灌检测"
          : "✗ 存在阻断性错误，需先修正后才能发布"}
      </div>

      {globalItems.length > 0 && (
        <div className="rc-global">
          {globalItems.map((item, index) => (
            <div className={`issue ${item.level}`} key={index}>
              <div className="top">
                <span className={`badge ${item.level}`}>{SEV_LABEL[item.level]}</span>
                <span className="role">{item.role ? roleLabel(item.role) : "规则库"}</span>
              </div>
              <div className="msg">{item.message}</div>
            </div>
          ))}
        </div>
      )}

      <div className="rc-body">
        <div className="rc-roles">
          {draft.roles.map((item, index) => (
            <button
              key={item.role}
              className={`rc-role ${index === safeRoleIdx ? "active" : ""}`}
              onClick={() => setRoleIdx(index)}
            >
              <span className="rc-role-name">{item.label}</span>
              <span className="rc-role-meta">
                {item.fields.filter((field) => field.enabled).length}/{item.fields.length}
                {roleErrors(item.role) > 0 && <span className="rc-dot" />}
              </span>
            </button>
          ))}
        </div>

        <div className="rc-fields">
          {!role ? (
            <div className="empty">请选择左侧角色</div>
          ) : (
            <>
              <div className="rc-fields-head">
                {role.label} · {role.role}
              </div>
              {role.fields.map((field, fieldIdx) => {
                const items = fieldItems(role.role, field.key);
                return (
                  <div className={`rc-field ${field.enabled ? "" : "off"}`} key={field.key}>
                    <div className="rc-field-top">
                      <label className="rc-field-toggle">
                        <input
                          type="checkbox"
                          checked={field.enabled}
                          onChange={(e) => patchField(fieldIdx, { enabled: e.target.checked })}
                        />
                        <span className="rc-field-label">{field.label}</span>
                      </label>
                      <select
                        className="rc-field-sev"
                        value={field.severity}
                        disabled={!field.enabled}
                        onChange={(e) =>
                          patchField(fieldIdx, {
                            severity: e.target.value as RuleFieldSeverity,
                          })
                        }
                      >
                        {(["error", "warn", "info"] as RuleFieldSeverity[]).map((severity) => (
                          <option key={severity} value={severity}>
                            {SEV_LABEL[severity]}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="rc-field-grid">
                      <select
                        value={field.value.mode}
                        disabled={!field.enabled}
                        onChange={(e) =>
                          setFieldMode(fieldIdx, field, e.target.value as RuleValue["mode"])
                        }
                      >
                        {modesForField(field).map((mode) => (
                          <option key={mode} value={mode}>
                            {MODE_LABEL[mode]}
                          </option>
                        ))}
                      </select>

                      <div className="rc-field-editor">
                        {field.value.mode === "exact" && renderExactEditor(field, fieldIdx)}
                        {field.value.mode === "oneOf" && renderOneOfEditor(field, fieldIdx)}
                        {field.value.mode === "range" && renderRangeEditor(field, fieldIdx)}
                        {field.value.mode === "unset" && (
                          <span className="rc-unset-text">该字段不会参与检测</span>
                        )}
                      </div>

                      <span className="rc-field-preview">{fmtValue(field.value)}</span>
                    </div>

                    {items.length > 0 && (
                      <div className="rc-field-issues">
                        {items.map((item, index) => (
                          <span className={`rc-field-issue ${item.level}`} key={index}>
                            {item.message}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
