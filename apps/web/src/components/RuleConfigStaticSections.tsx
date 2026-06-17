import type {
  DocumentRuleKey,
  EditableRuleLibrary,
  HeaderRuleKey,
  PageNumberRuleKey,
  RuleDraft,
} from "@word-auto/validator";
import {
  DOCUMENT_FIELD_ORDER,
  HEADER_FIELD_ORDER,
  PAGE_NUMBER_FIELD_ORDER,
  getDocumentFieldLabel,
  getHeaderFieldLabel,
  getPageNumberFieldLabel,
} from "@word-auto/validator";
import { MODE_LABEL, SEV_LABEL, formatRuleValue } from "./ruleConfigShared.js";
import type { RuleConfigSection } from "./RuleConfigPanelSections.js";

type PlainSectionPaneProps = {
  draft: RuleDraft;
  published: EditableRuleLibrary;
  section: Exclude<RuleConfigSection, "roles">;
};

const formatPlainValue = (value: unknown, unit?: string): string => {
  if (typeof value === "boolean") return value ? "是" : "否";
  if (value == null || value === "") return "（未配置）";
  return `${String(value)}${unit ?? ""}`;
};

const plainStatus = (draftValue: unknown, publishedValue: unknown): string => {
  if (draftValue == null && publishedValue == null) return "未配置";
  return JSON.stringify(draftValue) === JSON.stringify(publishedValue)
    ? "与生效一致"
    : "草稿待发布";
};

const sectionTitle = (section: PlainSectionPaneProps["section"]): string => {
  if (section === "document") return "document / 页面设置";
  if (section === "pageNumbers") return "pageNumbers / 页码";
  return "headers / 页眉";
};

function PlainRuleRow({
  draftValue,
  label,
  publishedValue,
  unit,
}: {
  draftValue: unknown;
  label: string;
  publishedValue: unknown;
  unit?: string;
}) {
  const status = plainStatus(draftValue, publishedValue);
  return (
    <div className="rc-plain-row">
      <div>
        <div className="rc-plain-label">{label}</div>
        <div className="rc-plain-meta">{status}</div>
      </div>
      <div className="rc-plain-values">
        <span>草稿：{formatPlainValue(draftValue, unit)}</span>
        <span>生效：{formatPlainValue(publishedValue, unit)}</span>
      </div>
    </div>
  );
}

function DocumentRows({
  draft,
  published,
}: {
  draft: RuleDraft;
  published: EditableRuleLibrary;
}) {
  return (
    <>
      {DOCUMENT_FIELD_ORDER.map((key: DocumentRuleKey) => (
        <PlainRuleRow
          key={key}
          draftValue={draft.document?.[key]}
          label={getDocumentFieldLabel(key)}
          publishedValue={published.document?.[key]}
          unit={key === "paper_size" ? "" : " cm"}
        />
      ))}
    </>
  );
}

function PageNumberRows({
  draft,
  published,
}: {
  draft: RuleDraft;
  published: EditableRuleLibrary;
}) {
  return (
    <>
      {PAGE_NUMBER_FIELD_ORDER.map((key: PageNumberRuleKey) => (
        <PlainRuleRow
          key={key}
          draftValue={draft.pageNumbers?.[key]}
          label={getPageNumberFieldLabel(key)}
          publishedValue={published.pageNumbers?.[key]}
          unit={key === "size_pt" ? " pt" : ""}
        />
      ))}
    </>
  );
}

function HeaderRows({
  draft,
  published,
}: {
  draft: RuleDraft;
  published: EditableRuleLibrary;
}) {
  return (
    <>
      {HEADER_FIELD_ORDER.map((key: HeaderRuleKey) => (
        <PlainRuleRow
          key={key}
          draftValue={draft.headers?.[key]}
          label={getHeaderFieldLabel(key)}
          publishedValue={published.headers?.[key]}
          unit={key === "size_pt" ? " pt" : ""}
        />
      ))}
    </>
  );
}

export function RuleConfigPlainSectionPane({
  draft,
  published,
  section,
}: PlainSectionPaneProps) {
  return (
    <div className="rc-fields">
      <div className="rc-fields-head">{sectionTitle(section)}</div>
      <div className="rc-plain-list">
        {section === "document" && <DocumentRows draft={draft} published={published} />}
        {section === "pageNumbers" && <PageNumberRows draft={draft} published={published} />}
        {section === "headers" && <HeaderRows draft={draft} published={published} />}
      </div>
    </div>
  );
}

export function RuleConfigRoleSnapshot({
  role,
}: {
  role: RuleDraft["roles"][number] | undefined;
}) {
  if (!role) return null;
  return (
    <div className="rc-role-snapshot">
      {role.fields.map((field) => (
        <span key={field.key}>
          {field.label}: {field.enabled ? "启用" : "停用"} · {SEV_LABEL[field.severity]} · {MODE_LABEL[field.value.mode]} · {formatRuleValue(field.value)}
        </span>
      ))}
    </div>
  );
}
