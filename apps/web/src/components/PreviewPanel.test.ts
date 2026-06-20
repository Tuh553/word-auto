import { test } from "node:test";
import assert from "node:assert/strict";
import {
  findPreviewIssueKeyFromNode,
  findPreviewParagraphIssueKeysFromNode,
  pickParagraphIssueKey,
} from "../lib/previewHighlight.js";

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

test("PreviewPanel：点击段级弱标记区域时可按稳定优先级选中对应 issue", () => {
  const block = {
    dataset: { paragraphIssueKeys: "warn-1|error-1" },
    parentElement: null,
  };
  const leaf = {
    dataset: {},
    parentElement: block,
  };

  const issueKeys = findPreviewParagraphIssueKeysFromNode(leaf);
  const issueKey = pickParagraphIssueKey(issueKeys, {
    issueKey: "warn-1",
    paraIndex: 0,
    text: "正文内容",
    paragraphIssues: [
      { issueKey: "warn-1", affectedText: null, severity: "warn" },
      { issueKey: "error-1", affectedText: "正文", severity: "error" },
    ],
  });

  assert.equal(issueKey, "error-1");
});
