import { test } from "node:test";
import assert from "node:assert/strict";
import type { Issue } from "@word-auto/validator";
import {
  buildPreviewIssueTargets,
  buildReportGroups,
  findFirstNavigableIssue,
  findVisibleIssueForParagraph,
  formatIssueField,
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
    targets.map((target) => [target.paraIndex, target.text]),
    [
      [1, "第一章 绪论"],
      [5, "正文内容"],
    ],
  );
});
