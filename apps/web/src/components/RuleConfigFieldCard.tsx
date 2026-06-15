import type {
  RuleField,
  RuleFieldSeverity,
  RuleLintItem,
  RuleValue,
} from "@word-auto/validator";
import {
  ALIGN_OPTIONS,
  BOOL_OPTIONS,
  FONT_SUGGESTIONS,
  MODE_LABEL,
  SEV_LABEL,
  formatOneOfList,
  formatRuleValue,
  modesForField,
  nextValueForMode,
  parseScalarValue,
} from "./ruleConfigShared.js";

type RuleConfigFieldCardProps = {
  field: RuleField;
  fieldIdx: number;
  issues: RuleLintItem[];
  onPatchField: (fieldIdx: number, patch: Partial<RuleField>) => void;
  onPatchFieldValue: (fieldIdx: number, patch: Partial<RuleValue>) => void;
};

const toggleOneOfValue = (
  field: RuleField,
  value: string | number | boolean,
): Array<string | number | boolean> => {
  const current = field.value.oneOf ?? [];
  return current.some((item) => item === value)
    ? current.filter((item) => item !== value)
    : [...current, value];
};

function ExactEditor({
  field,
  fieldIdx,
  onPatchFieldValue,
}: Pick<RuleConfigFieldCardProps, "field" | "fieldIdx" | "onPatchFieldValue">) {
  if (field.value.unit === "bool") {
    return (
      <select
        value={String(field.value.exact ?? true)}
        disabled={!field.enabled}
        onChange={(event) =>
          onPatchFieldValue(fieldIdx, { exact: event.target.value === "true" })
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
        onChange={(event) => onPatchFieldValue(fieldIdx, { exact: event.target.value })}
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
          onChange={(event) => onPatchFieldValue(fieldIdx, { exact: event.target.value })}
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
      onChange={(event) =>
        onPatchFieldValue(fieldIdx, {
          exact: event.target.value === "" ? undefined : Number(event.target.value),
        })
      }
    />
  );
}

function OneOfEditor({
  field,
  fieldIdx,
  onPatchFieldValue,
}: Pick<RuleConfigFieldCardProps, "field" | "fieldIdx" | "onPatchFieldValue">) {
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
              onChange={() =>
                onPatchFieldValue(fieldIdx, { oneOf: toggleOneOfValue(field, item.value) })
              }
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
              onChange={() =>
                onPatchFieldValue(fieldIdx, { oneOf: toggleOneOfValue(field, item) })
              }
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
      value={formatOneOfList(field)}
      disabled={!field.enabled}
      placeholder={field.value.unit === "enum" ? "用逗号分隔多个值" : "如 10.5, 12"}
      onChange={(event) =>
        onPatchFieldValue(fieldIdx, {
          oneOf: event.target.value
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean)
            .map((item) => parseScalarValue(item, field.value.unit)),
        })
      }
    />
  );
}

function RangeEditor({
  field,
  fieldIdx,
  onPatchFieldValue,
}: Pick<RuleConfigFieldCardProps, "field" | "fieldIdx" | "onPatchFieldValue">) {
  return (
    <div className="rc-range-inputs">
      <input
        type="number"
        step={field.value.unit === "pt" ? "0.1" : "1"}
        value={String(field.value.min ?? "")}
        disabled={!field.enabled}
        placeholder="最小值"
        onChange={(event) =>
          onPatchFieldValue(fieldIdx, {
            min: event.target.value === "" ? undefined : Number(event.target.value),
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
        onChange={(event) =>
          onPatchFieldValue(fieldIdx, {
            max: event.target.value === "" ? undefined : Number(event.target.value),
          })
        }
      />
    </div>
  );
}

function FieldCardBody({
  field,
  fieldIdx,
  onPatchFieldValue,
}: Pick<RuleConfigFieldCardProps, "field" | "fieldIdx" | "onPatchFieldValue">) {
  return (
    <div className="rc-field-grid">
      <select
        value={field.value.mode}
        disabled={!field.enabled}
        onChange={(event) =>
          onPatchFieldValue(
            fieldIdx,
            nextValueForMode(field, event.target.value as RuleValue["mode"]),
          )
        }
      >
        {modesForField(field).map((mode) => (
          <option key={mode} value={mode}>
            {MODE_LABEL[mode]}
          </option>
        ))}
      </select>

      <div className="rc-field-editor">
        {field.value.mode === "exact" && (
          <ExactEditor
            field={field}
            fieldIdx={fieldIdx}
            onPatchFieldValue={onPatchFieldValue}
          />
        )}
        {field.value.mode === "oneOf" && (
          <OneOfEditor
            field={field}
            fieldIdx={fieldIdx}
            onPatchFieldValue={onPatchFieldValue}
          />
        )}
        {field.value.mode === "range" && (
          <RangeEditor
            field={field}
            fieldIdx={fieldIdx}
            onPatchFieldValue={onPatchFieldValue}
          />
        )}
        {field.value.mode === "unset" && (
          <span className="rc-unset-text">该字段不会参与检测</span>
        )}
      </div>

      <span className="rc-field-preview">{formatRuleValue(field.value)}</span>
    </div>
  );
}

export function RuleConfigFieldCard({
  field,
  fieldIdx,
  issues,
  onPatchField,
  onPatchFieldValue,
}: RuleConfigFieldCardProps) {
  return (
    <div className={`rc-field ${field.enabled ? "" : "off"}`}>
      <div className="rc-field-top">
        <label className="rc-field-toggle">
          <input
            type="checkbox"
            checked={field.enabled}
            onChange={(event) => onPatchField(fieldIdx, { enabled: event.target.checked })}
          />
          <span className="rc-field-label">{field.label}</span>
        </label>
        <select
          className="rc-field-sev"
          value={field.severity}
          disabled={!field.enabled}
          onChange={(event) =>
            onPatchField(fieldIdx, {
              severity: event.target.value as RuleFieldSeverity,
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

      <FieldCardBody
        field={field}
        fieldIdx={fieldIdx}
        onPatchFieldValue={onPatchFieldValue}
      />

      {issues.length > 0 && (
        <div className="rc-field-issues">
          {issues.map((item, index) => (
            <span className={`rc-field-issue ${item.level}`} key={index}>
              {item.message}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
