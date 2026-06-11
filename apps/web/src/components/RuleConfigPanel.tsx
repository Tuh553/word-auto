import { useMemo, useState } from "react";
import {
  lintRuleLibrary,
  type EditableRuleLibrary,
  type RuleField,
  type RuleFieldSeverity,
  type RuleLintItem,
  type RuleValue,
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

const unitText = (u?: string): string =>
  u === "pt" ? " pt" : u === "chars" ? " 字符" : u === "level" ? " 级" : "";

const fmtScalar = (v: unknown): string => {
  if (typeof v === "boolean") return v ? "是" : "否";
  return v == null ? "—" : String(v);
};

/** 把规则值格式化为人类可读文本（不暴露底层单位） */
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

interface Props {
  lib: EditableRuleLibrary;
  onChange: (lib: EditableRuleLibrary) => void;
}

/**
 * 规则配置页骨架（PRD §7）：左侧角色列表，右侧字段编辑区。
 * 当前支持浏览全部角色/字段、切换启用、调整严重级别，并实时跑 lintRuleLibrary
 * 展示字段级与库级校验反馈。完整的值编辑控件（数值/枚举/范围输入）后续迭代。
 */
export function RuleConfigPanel({ lib, onChange }: Props) {
  const [roleIdx, setRoleIdx] = useState(0);
  const lint = useMemo(() => lintRuleLibrary(lib), [lib]);

  const allItems: RuleLintItem[] = [...lint.errors, ...lint.warnings, ...lint.infos];
  // 无具体字段定位的问题（库级 / 角色级）单独在顶部展示
  const globalItems = allItems.filter((i) => !i.field);
  const fieldItems = (role: string, field: string): RuleLintItem[] =>
    allItems.filter((i) => i.role === role && i.field === field);
  const roleErrors = (role: string): number =>
    lint.errors.filter((i) => i.role === role).length;
  const roleLabel = (role: string): string =>
    lib.roles.find((r) => r.role === role)?.label ?? role;

  const role = lib.roles[roleIdx];

  const patchField = (fieldIdx: number, patch: Partial<RuleField>): void => {
    const next = structuredClone(lib);
    Object.assign(next.roles[roleIdx].fields[fieldIdx], patch);
    onChange(next);
  };

  const counts: Record<RuleFieldSeverity, number> = {
    error: lint.errors.length,
    warn: lint.warnings.length,
    info: lint.infos.length,
  };

  return (
    <div className="card">
      <div className="rc-head">
        <div>
          <div className="rc-name">{lib.name}</div>
          <div className="rc-meta">
            版本 {lib.version} · {lib.roles.length} 个角色
          </div>
        </div>
        <div className="stats" style={{ margin: 0, minWidth: 280 }}>
          {(["error", "warn", "info"] as RuleFieldSeverity[]).map((s) => (
            <div className={`stat ${s}`} key={s}>
              <div className="n">{counts[s]}</div>
              <div className="l">{SEV_LABEL[s]}</div>
            </div>
          ))}
        </div>
      </div>

      <div className={`rc-status ${lint.ok ? "ok" : "bad"}`}>
        {lint.ok
          ? "✓ 规则合法性校验通过，可发布"
          : "✗ 存在阻断性错误，需修正后才能发布"}
      </div>

      {globalItems.length > 0 && (
        <div className="rc-global">
          {globalItems.map((it, k) => (
            <div className={`issue ${it.level}`} key={k}>
              <div className="top">
                <span className={`badge ${it.level}`}>{SEV_LABEL[it.level]}</span>
                <span className="role">{it.role ? roleLabel(it.role) : "规则库"}</span>
              </div>
              <div className="msg">{it.message}</div>
            </div>
          ))}
        </div>
      )}

      <div className="rc-body">
        <div className="rc-roles">
          {lib.roles.map((r, i) => (
            <button
              key={r.role}
              className={`rc-role ${i === roleIdx ? "active" : ""}`}
              onClick={() => setRoleIdx(i)}
            >
              <span className="rc-role-name">{r.label}</span>
              <span className="rc-role-meta">
                {r.fields.filter((f) => f.enabled).length}/{r.fields.length}
                {roleErrors(r.role) > 0 && <span className="rc-dot" />}
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
              {role.fields.map((f, i) => {
                const items = fieldItems(role.role, f.key);
                return (
                  <div className={`rc-field ${f.enabled ? "" : "off"}`} key={f.key}>
                    <label className="rc-field-toggle">
                      <input
                        type="checkbox"
                        checked={f.enabled}
                        onChange={(e) => patchField(i, { enabled: e.target.checked })}
                      />
                      <span className="rc-field-label">{f.label}</span>
                    </label>
                    <span className="rc-field-mode">{MODE_LABEL[f.value.mode]}</span>
                    <span className="rc-field-value">{fmtValue(f.value)}</span>
                    <select
                      className="rc-field-sev"
                      value={f.severity}
                      disabled={!f.enabled}
                      onChange={(e) =>
                        patchField(i, { severity: e.target.value as RuleFieldSeverity })
                      }
                    >
                      {(["error", "warn", "info"] as RuleFieldSeverity[]).map((s) => (
                        <option key={s} value={s}>
                          {SEV_LABEL[s]}
                        </option>
                      ))}
                    </select>
                    {items.length > 0 && (
                      <div className="rc-field-issues">
                        {items.map((it, k) => (
                          <span className={`rc-field-issue ${it.level}`} key={k}>
                            {it.message}
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
