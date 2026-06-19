import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addIgnoredProposalKey,
  loadIgnoredProposalKeys,
  removeIgnoredProposalKey,
  roleFieldProposalIgnoreKey,
  saveIgnoredProposalKeys,
} from "./proposalIgnores.js";

const withMockStorage = (run: () => void): void => {
  const holder = globalThis as typeof globalThis & { window?: unknown };
  const previous = holder.window;
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => store.set(key, value),
      },
    },
  });
  try {
    run();
  } finally {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: previous,
    });
  }
};

test("proposal ignores：稳定 key 可持久化并恢复", () => {
  withMockStorage(() => {
    const key = roleFieldProposalIgnoreKey("tpl", "body_text", "fontSizePt");
    const saved = addIgnoredProposalKey(new Set(), key);
    saveIgnoredProposalKeys(saved);

    assert.equal(loadIgnoredProposalKeys().has(key), true);

    saveIgnoredProposalKeys(removeIgnoredProposalKey(saved, key));
    assert.equal(loadIgnoredProposalKeys().has(key), false);
  });
});
