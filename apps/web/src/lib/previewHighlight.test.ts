import { test } from "node:test";
import assert from "node:assert/strict";
import {
  findBestFragmentMatch,
  findFragmentMatchCandidates,
  findPreviewIssueKeyFromNode,
  findPreviewParagraphIssueKeysFromNode,
  findNormalizedTextRange,
  findPreviewBlockTextIndex,
  normalizePreviewText,
  pickParagraphIssueKey,
  pickPreviewIssueInViewport,
} from "./previewHighlight.js";

test("normalizePreviewText：移除空白用于预览文本匹配", () => {
  assert.equal(normalizePreviewText(" 中 文 \n text\t"), "中文text");
});

test("findPreviewBlockTextIndex：只返回目标段落文本命中的 block", () => {
  const index = findPreviewBlockTextIndex(
    ["第一段有重复片段", "目标段包含 局部错误 文本", "第三段也有局部错误"],
    "目标段包含局部错误文本",
  );

  assert.equal(index, 1);
});

test("findPreviewBlockTextIndex：目标文本太短时不猜测命中", () => {
  assert.equal(findPreviewBlockTextIndex(["甲", "乙"], "甲"), -1);
});

test("findNormalizedTextRange：在段落内返回片段原始下标范围", () => {
  const text = "这是一个局部错误片段。";

  assert.deepEqual(findNormalizedTextRange(text, "局部错误"), {
    start: 4,
    end: 8,
  });
});

test("findNormalizedTextRange：片段匹配兼容渲染文本空白差异", () => {
  const text = "混排  字体\n异常";

  assert.deepEqual(findNormalizedTextRange(text, "字体异常"), {
    start: 4,
    end: 9,
  });
});

test("findNormalizedTextRange：片段不存在时返回 null 供整段 fallback", () => {
  assert.equal(findNormalizedTextRange("目标段文本", "不存在"), null);
});

test("findFragmentMatchCandidates：重复片段时返回同段内全部候选范围", () => {
  const candidates = findFragmentMatchCandidates("abc mixed xyz mixed", [
    { issueKey: "issue-1", affectedText: "mixed", severity: "error" },
  ]);

  assert.deepEqual(
    candidates.map((candidate) => candidate.range),
    [
      { start: 4, end: 9 },
      { start: 14, end: 19 },
    ],
  );
});

test("findBestFragmentMatch：同一 issue 在段内命中多次时返回 null，供整段 fallback", () => {
  assert.equal(
    findBestFragmentMatch("abc mixed xyz mixed", {
      issueKey: "issue-1",
      paraIndex: 0,
      text: "abc mixed xyz mixed",
      affectedText: "mixed",
      paragraphIssues: [
        { issueKey: "issue-1", affectedText: "mixed", severity: "error" },
      ],
    }),
    null,
  );
});

test("pickParagraphIssueKey：同段多个 issue 时按严重级和可见顺序稳定选择", () => {
  const issueKey = pickParagraphIssueKey(
    ["warn-1", "error-1", "info-1"],
    {
      issueKey: "warn-1",
      paraIndex: 0,
      text: "正文",
      paragraphIssues: [
        { issueKey: "warn-1", affectedText: null, severity: "warn" },
        { issueKey: "error-1", affectedText: "正文", severity: "error" },
        { issueKey: "info-1", affectedText: null, severity: "info" },
      ],
    },
  );

  assert.equal(issueKey, "error-1");
});

test("pickPreviewIssueInViewport：优先选择覆盖视口中心且最接近中心的 issue", () => {
  const issueKey = pickPreviewIssueInViewport(
    [
      { issueKey: "a", top: 0, bottom: 120 },
      { issueKey: "b", top: 140, bottom: 260 },
      { issueKey: "c", top: 200, bottom: 360 },
    ],
    { clientHeight: 200, scrollTop: 100 },
  );

  assert.equal(issueKey, "b");
});

test("pickPreviewIssueInViewport：没有中心命中时回退到视口内最靠前的 issue", () => {
  const issueKey = pickPreviewIssueInViewport(
    [
      { issueKey: "a", top: 0, bottom: 80 },
      { issueKey: "b", top: 120, bottom: 160 },
      { issueKey: "c", top: 170, bottom: 190 },
    ],
    { clientHeight: 60, scrollTop: 100 },
  );

  assert.equal(issueKey, "b");
});

test("pickPreviewIssueInViewport：视口内没有候选 issue 时返回 null", () => {
  assert.equal(
    pickPreviewIssueInViewport(
      [{ issueKey: "a", top: 0, bottom: 50 }],
      { clientHeight: 100, scrollTop: 200 },
    ),
    null,
  );
});

test("findPreviewIssueKeyFromNode：沿父节点链找到最近的 issueKey", () => {
  const root = { dataset: { issueKey: "root" }, parentElement: null };
  const child = { dataset: {}, parentElement: root };
  const leaf = { parentElement: child };

  assert.equal(findPreviewIssueKeyFromNode(leaf), "root");
  assert.equal(findPreviewIssueKeyFromNode(null), null);
});

test("findPreviewParagraphIssueKeysFromNode：沿父节点链读取段级 issueKey 列表", () => {
  const root = {
    dataset: { paragraphIssueKeys: "issue-1|issue-2" },
    parentElement: null,
  };
  const child = { dataset: {}, parentElement: root };

  assert.deepEqual(findPreviewParagraphIssueKeysFromNode(child), ["issue-1", "issue-2"]);
  assert.deepEqual(findPreviewParagraphIssueKeysFromNode(null), []);
});
