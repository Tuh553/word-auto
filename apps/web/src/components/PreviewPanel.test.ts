import { test } from "node:test";
import assert from "node:assert/strict";
import { findPreviewIssueKeyFromNode } from "../lib/previewHighlight.js";

test("PreviewPanel：点击预览 issue 片段时可解析到对应 issueKey", () => {
  const hit = {
    dataset: { issueKey: "issue-1" },
    parentElement: null,
  };
  const fragment = {
    dataset: {},
    parentElement: hit,
  };
  const textNodeHost = {
    parentElement: fragment,
  };

  assert.equal(findPreviewIssueKeyFromNode(textNodeHost), "issue-1");
});
