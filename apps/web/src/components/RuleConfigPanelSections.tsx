import type {
  RuleDraft,
  RuleField,
  RuleLintItem,
  RuleLintResult,
  RuleValue,
} from "@word-auto/validator";
import { RuleConfigFieldCard } from "./RuleConfigFieldCard.js";
import { SEV_LABEL, formatDateTime } from "./ruleConfigShared.js";

export interface LibraryOption {
  id: string;
  name: string;
  version: string;
}

type PatchField = (fieldIdx: number, patch: Partial<RuleField>) => void;
type PatchFieldValue = (fieldIdx: number, patch: Partial<RuleValue>) => void;

type ToolbarProps = {
  draft: RuleDraft;
  draftDirty: boolean;
  libraryOptions: LibraryOption[];
  lint: RuleLintResult;
  onExportDraft: () => void;
  onExportPublished: () => void;
  onImport: () => void;
  onPublish: () => void;
  onSaveDraft: () => void;
  onSelectLibrary: (id: string) => void;
  publishedUpdatedAt: string;
  statusMessage: string | null;
  unpublishedChanges: boolean;
};

type SummaryProps = {
  draft: RuleDraft;
  lint: RuleLintResult;
  publishedVersion: string;
};

type FieldPaneProps = {
  draft: RuleDraft;
  fieldItems: (roleKey: string, fieldKey: string) => RuleLintItem[];
  onPatchField: PatchField;
  onPatchFieldValue: PatchFieldValue;
  role: RuleDraft["roles"][number] | undefined;
  roleErrors: (roleKey: string) => number;
  safeRoleIdx: number;
  setRoleIdx: (index: number) => void;
};

export function RuleConfigToolbar({
  draft,
  draftDirty,
  libraryOptions,
  lint,
  onExportDraft,
  onExportPublished,
  onImport,
  onPublish,
  onSaveDraft,
  onSelectLibrary,
  publishedUpdatedAt,
  statusMessage,
  unpublishedChanges,
}: ToolbarProps) {
  return (
    <div className="rc-toolbar">
      <div className="rc-toolbar-main">
        <div className="rc-selector">
          <label>当前模板</label>
          <select value={draft.id} onChange={(event) => onSelectLibrary(event.target.value)}>
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
  );
}

export function RuleConfigSummary({
  draft,
  lint,
  publishedVersion,
}: SummaryProps) {
  const counts = {
    error: lint.errors.length,
    warn: lint.warnings.length,
    info: lint.infos.length,
  };

  return (
    <>
      <div className="rc-head">
        <div>
          <div className="rc-name">{draft.name}</div>
          <div className="rc-meta">
            草稿版本 {draft.version} · 生效版本 {publishedVersion} · {draft.roles.length} 个角色
          </div>
        </div>
        <div className="stats" style={{ margin: 0, minWidth: 280 }}>
          {(["error", "warn", "info"] as const).map((severity) => (
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
    </>
  );
}

export function RuleConfigGlobalIssues({
  items,
  roleLabel,
}: {
  items: RuleLintItem[];
  roleLabel: (roleKey: string) => string;
}) {
  if (items.length === 0) return null;

  return (
    <div className="rc-global">
      {items.map((item, index) => (
        <div className={`issue ${item.level}`} key={index}>
          <div className="top">
            <span className={`badge ${item.level}`}>{SEV_LABEL[item.level]}</span>
            <span className="role">{item.role ? roleLabel(item.role) : "规则库"}</span>
          </div>
          <div className="msg">{item.message}</div>
        </div>
      ))}
    </div>
  );
}

export function RuleConfigFieldPane({
  draft,
  fieldItems,
  onPatchField,
  onPatchFieldValue,
  role,
  roleErrors,
  safeRoleIdx,
  setRoleIdx,
}: FieldPaneProps) {
  return (
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
            {role.fields.map((field, fieldIdx) => (
              <RuleConfigFieldCard
                key={field.key}
                field={field}
                fieldIdx={fieldIdx}
                issues={fieldItems(role.role, field.key)}
                onPatchField={onPatchField}
                onPatchFieldValue={onPatchFieldValue}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
