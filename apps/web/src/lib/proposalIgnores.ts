const STORAGE_KEY = "word-auto.proposal-ignores.v1";

export type ProposalIgnoreKey = string;

const encode = (value: string): string => encodeURIComponent(value);

export const roleProposalIgnoreKey = (
  templateId: string,
  role: string,
): ProposalIgnoreKey =>
  `${encode(templateId)}|role|${encode(role)}`;

export const roleFieldProposalIgnoreKey = (
  templateId: string,
  role: string,
  fieldKey: string,
): ProposalIgnoreKey =>
  `${encode(templateId)}|role-field|${encode(role)}|${encode(fieldKey)}`;

export const documentFieldProposalIgnoreKey = (
  templateId: string,
  fieldKey: string,
): ProposalIgnoreKey =>
  `${encode(templateId)}|document-field|document|${encode(fieldKey)}`;

export const loadIgnoredProposalKeys = (): Set<ProposalIgnoreKey> => {
  if (typeof window === "undefined" || !window.localStorage) return new Set();
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return new Set();
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? new Set(parsed.filter((item): item is string => typeof item === "string"))
      : new Set();
  } catch {
    return new Set();
  }
};

export const saveIgnoredProposalKeys = (
  keys: Set<ProposalIgnoreKey>,
): void => {
  if (typeof window === "undefined" || !window.localStorage) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...keys].sort()));
};

export const addIgnoredProposalKey = (
  keys: Set<ProposalIgnoreKey>,
  key: ProposalIgnoreKey,
): Set<ProposalIgnoreKey> => {
  const next = new Set(keys);
  next.add(key);
  return next;
};

export const removeIgnoredProposalKey = (
  keys: Set<ProposalIgnoreKey>,
  key: ProposalIgnoreKey,
): Set<ProposalIgnoreKey> => {
  const next = new Set(keys);
  next.delete(key);
  return next;
};
