import { test } from "node:test";
import assert from "node:assert/strict";
import type { Issue } from "@word-auto/validator";
import {
  buildPreviewHighlightTarget,
  buildPreviewIssueTargets,
  buildReportGroups,
  findFirstNavigableIssue,
  findVisibleIssuesForParagraph,
  findVisibleIssueForParagraph,
  formatIssueField,
  formatIssueRole,
  getIssueKey,
  resolveSelectedIssue,
} from "./reportGroups.js";

const SAMPLE_ISSUES: Issue[] = [
  {
    paraIndex: 5,
    role: "body_text",
    field: "size_pt",
    expected: 12,
    actual: 10.5,
    severity: "warn",
    message: "正文字号问题",
    textPreview: "正文内容",
  },
  {
    paraIndex: 1,
    role: "heading1",
    field: "alignment",
    expected: "center",
    actual: "left",
    severity: "error",
    message: "一级标题对齐问题",
    textPreview: "第一章 绪论",
  },
  {
    paraIndex: -1,
    role: "document",
    field: "margin_top_cm",
    expected: 2.5,
    actual: 3,
    severity: "error",
    message: "页面设置问题",
    textPreview: "页面设置",
  },
  {
    paraIndex: 7,
    role: "reference_body",
    field: "font_east_asia",
    expected: "宋体",
    actual: "黑体",
    severity: "info",
    message: "参考文献字体问题",
    textPreview: "参考文献内容",
  },
];

test("buildReportGroups：按语义章节分组时保留语义顺序，组内按段落顺序排序", () => {
  const groups = buildReportGroups(SAMPLE_ISSUES, "section", "paragraph");

  assert.deepEqual(
    groups.map((group) => group.key),
    ["body", "references", "document"],
  );
  assert.deepEqual(
    groups[0]?.issues.map((issue) => issue.paraIndex),
    [1, 5],
  );
});

test("buildReportGroups：按严重级分组时固定为错误、警告、提示顺序", () => {
  const groups = buildReportGroups(SAMPLE_ISSUES, "severity", "severity");

  assert.deepEqual(
    groups.map((group) => group.key),
    ["error", "warn", "info"],
  );
  assert.deepEqual(
    groups[0]?.issues.map((issue) => issue.paraIndex),
    [1, -1],
  );
});

test("findFirstNavigableIssue：跳过文档级问题，返回首个可定位段落问题", () => {
  const issue = findFirstNavigableIssue(SAMPLE_ISSUES);

  assert.equal(issue?.paraIndex, 1);
  assert.equal(issue?.role, "heading1");
});

test("formatIssueField：统计型字段使用中文标签", () => {
  assert.equal(formatIssueField("keywords_cn_count"), "中文关键词数量");
  assert.equal(formatIssueField("references_foreign_fraction"), "外文参考文献占比");
});

test("附录细分角色：报告标签和语义章节分组正常", () => {
  const issues: Issue[] = [
    {
      paraIndex: 10,
      role: "appendix_subheading",
      field: "size_pt",
      expected: 12,
      actual: 10.5,
      severity: "warn",
      message: "附录小标题字号问题",
      textPreview: "A.1 调查问卷",
    },
    {
      paraIndex: 11,
      role: "appendix_list_item",
      field: "alignment",
      expected: "left",
      actual: "center",
      severity: "warn",
      message: "附录清单对齐问题",
      textPreview: "1. 原始访谈记录",
    },
    {
      paraIndex: 12,
      role: "appendix_signature",
      field: "font_east_asia",
      expected: "宋体",
      actual: "黑体",
      severity: "warn",
      message: "附录落款字体问题",
      textPreview: "日期：2026年6月20日",
    },
  ];

  const groups = buildReportGroups(issues, "section", "paragraph");

  assert.equal(formatIssueRole("appendix_subheading"), "附录小标题");
  assert.equal(formatIssueRole("appendix_list_item"), "附录清单");
  assert.equal(formatIssueRole("appendix_signature"), "附录落款");
  assert.deepEqual(
    groups.map((group) => [group.key, group.label, group.issues.length]),
    [["appendix", "附录", 3]],
  );
});

test("findVisibleIssueForParagraph：同一段多个 issue 时返回确定的首个可见问题", () => {
  const issues: Issue[] = [
    {
      paraIndex: 2,
      role: "body_text",
      field: "alignment",
      expected: "justify",
      actual: "left",
      severity: "warn",
      message: "正文对齐问题",
      textPreview: "正文内容",
    },
    {
      paraIndex: 2,
      role: "body_text",
      field: "size_pt",
      expected: 12,
      actual: 10,
      severity: "error",
      message: "正文字号问题",
      textPreview: "正文内容",
    },
  ];

  const issue = findVisibleIssueForParagraph(issues, 2);

  assert.equal(issue?.field, "size_pt");
});

test("findVisibleIssuesForParagraph：同一段多个 issue 时按稳定顺序返回当前可见列表", () => {
  const issues: Issue[] = [
    {
      paraIndex: 2,
      role: "body_text",
      field: "alignment",
      expected: "justify",
      actual: "left",
      severity: "warn",
      message: "正文对齐问题",
      textPreview: "正文内容",
    },
    {
      paraIndex: 2,
      role: "body_text",
      field: "size_pt",
      expected: 12,
      actual: 10,
      severity: "error",
      message: "正文字号问题",
      textPreview: "正文内容",
    },
  ];

  assert.deepEqual(
    findVisibleIssuesForParagraph(issues, 2).map((issue) => issue.field),
    ["size_pt", "alignment"],
  );
});

test("resolveSelectedIssue：当前选择被筛选隐藏时切换到首个可定位问题", () => {
  const selected = SAMPLE_ISSUES[0]!;
  const visible = SAMPLE_ISSUES.filter((issue) => issue.severity === "error");

  const issue = resolveSelectedIssue(visible, getIssueKey(selected));

  assert.equal(issue?.paraIndex, 1);
  assert.equal(issue?.severity, "error");
});

test("buildPreviewIssueTargets：按可见 issue 为每个段落只生成一个反向定位目标", () => {
  const targets = buildPreviewIssueTargets(
    [SAMPLE_ISSUES[0]!, SAMPLE_ISSUES[1]!, SAMPLE_ISSUES[2]!],
    [
      { text: "封面" },
      { text: "第一章 绪论" },
      { text: "第二段" },
      { text: "第三段" },
      { text: "第四段" },
      { text: "正文内容" },
    ],
  );

  assert.deepEqual(
    targets.map((target) => [target.paraIndex, target.text, target.occurrenceIndex]),
    [
      [1, "第一章 绪论", 0],
      [5, "正文内容", 0],
    ],
  );
});

test("buildPreviewIssueTargets：同一段多个可见 issue 时稳定选择排序靠前的问题", () => {
  const issues: Issue[] = [
    {
      paraIndex: 2,
      role: "body_text",
      field: "alignment",
      expected: "justify",
      actual: "left",
      severity: "warn",
      message: "正文对齐问题",
      textPreview: "正文内容",
    },
    {
      paraIndex: 2,
      role: "body_text",
      field: "size_pt",
      expected: 12,
      actual: 10,
      severity: "error",
      message: "正文字号问题",
      textPreview: "正文内容",
    },
  ];

  const targets = buildPreviewIssueTargets(issues, [
    { text: "封面" },
    { text: "目录" },
    { text: "正文内容" },
  ]);

  assert.equal(targets.length, 1);
  assert.equal(targets[0]?.issueKey, getIssueKey(issues[1]!));
  assert.equal(targets[0]?.paraIndex, 2);
  assert.equal(targets[0]?.occurrenceIndex, 0);
  assert.deepEqual(
    targets[0]?.issues.map((issue) => issue.issueKey),
    [getIssueKey(issues[1]!), getIssueKey(issues[0]!)],
  );
});

test("buildPreviewIssueTargets：重复正文段会记录上下文与重复序号供预览去歧义", () => {
  const issue: Issue = {
    paraIndex: 3,
    role: "body_text",
    field: "alignment",
    expected: "justify",
    actual: "left",
    severity: "warn",
    message: "正文对齐问题",
    textPreview: "正文文字正文文字正文文字",
  };

  const targets = buildPreviewIssueTargets([issue], [
    { text: "章节 A" },
    { text: "正文文字正文文字正文文字" },
    { text: "过渡段" },
    { text: "正文文字正文文字正文文字" },
    { text: "章节 B" },
  ]);

  assert.equal(targets[0]?.occurrenceIndex, 1);
  assert.equal(targets[0]?.previousText, "过渡段");
  assert.equal(targets[0]?.nextText, "章节 B");
});

test("buildPreviewHighlightTarget：为当前选中 issue 保留片段文本", () => {
  const issue: Issue = {
    paraIndex: 0,
    role: "body_text",
    field: "font_latin",
    expected: "Times New Roman",
    actual: "Arial",
    severity: "error",
    message: "局部西文字体问题",
    textPreview: "正文 mixed text",
    startRunIndex: 1,
    endRunIndex: 1,
    affectedText: "mixed",
  };

  const target = buildPreviewHighlightTarget(
    issue,
    [{ text: "正文 mixed text" }],
    [issue],
  );

  assert.equal(target?.text, "正文 mixed text");
  assert.equal(target?.affectedText, "mixed");
  assert.equal(target?.paraIndex, 0);
  assert.equal(target?.issueKey, getIssueKey(issue));
  assert.equal(target?.occurrenceIndex, 0);
  assert.equal(target?.previousText, null);
  assert.equal(target?.nextText, null);
  assert.deepEqual(target?.paragraphIssues, [{
    affectedText: "mixed",
    issueKey: getIssueKey(issue),
    severity: "error",
  }]);
});

test("buildPreviewHighlightTarget：文档级 issue 不生成预览定位目标", () => {
  assert.equal(buildPreviewHighlightTarget(SAMPLE_ISSUES[2], [], SAMPLE_ISSUES), null);
});

test("buildPreviewHighlightTarget：筛选后仅携带当前可见 issue 集合", () => {
  const visibleIssues: Issue[] = [
    {
      paraIndex: 1,
      role: "body_text",
      field: "size_pt",
      expected: 12,
      actual: 10.5,
      severity: "error",
      message: "字号问题",
      textPreview: "正文 mixed text",
      affectedText: "mixed",
    },
  ];
  const hiddenIssue: Issue = {
    paraIndex: 0,
    role: "body_text",
    field: "alignment",
    expected: "justify",
    actual: "left",
    severity: "warn",
    message: "对齐问题",
    textPreview: "正文 mixed text",
  };

  const target = buildPreviewHighlightTarget(
    visibleIssues[0],
    [{ text: "引言" }, { text: "正文 mixed text" }, { text: "结尾" }],
    visibleIssues,
  );

  assert.equal(target?.paragraphIssues?.length, 1);
  assert.equal(target?.paragraphIssues?.[0]?.issueKey, getIssueKey(visibleIssues[0]!));
  assert.notEqual(target?.paragraphIssues?.[0]?.issueKey, getIssueKey(hiddenIssue));
  assert.equal(target?.previousText, "引言");
  assert.equal(target?.nextText, "结尾");
});
