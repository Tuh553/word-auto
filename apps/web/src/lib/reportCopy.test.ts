import { test } from "node:test";
import assert from "node:assert/strict";
import type { Issue } from "@word-auto/validator";
import { getIssueKey } from "./reportGroups.js";
import {
  buildReportCopyState,
  buildVisibleIssues,
  formatIssueCardText,
  formatIssueChecklistText,
  resolveCopyCardIssue,
  writeTextToClipboard,
} from "./reportCopy.js";

const SAMPLE_ISSUES: Issue[] = [
  {
    paraIndex: 11,
    role: "body_text",
    field: "size_pt",
    expected: 12,
    actual: 10.5,
    severity: "warn",
    message: "字号应为 12pt，实际 10.5pt",
    textPreview: "正文 mixed text",
    affectedText: "mixed text",
    suggestion: "请将该段落字号调整为 12pt",
    provenance: "《排版规范》第 3.2 条：正文使用 12pt。",
  },
  {
    paraIndex: 2,
    role: "heading1",
    field: "alignment",
    expected: "center",
    actual: "left",
    severity: "error",
    message: "一级标题应居中",
    textPreview: "第一章 绪论",
  },
  {
    paraIndex: -1,
    role: "document",
    field: "margin_top_cm",
    expected: 2.5,
    actual: 3,
    severity: "error",
    message: "上边距应为 2.5cm，实际 3cm",
    textPreview: "页面设置",
    suggestion: "请将上边距调整为 2.5cm",
  },
];

test("formatIssueCardText：单条 issue 卡片格式稳定", () => {
  const result = formatIssueCardText(SAMPLE_ISSUES[1], {
    fileName: "论文.docx",
  });

  assert.equal(result.ok, true);
  assert.equal(
    result.text,
    [
      "修订建议卡片",
      "文件：论文.docx",
      "级别：错误",
      "位置：第 3 段",
      "角色：一级标题",
      "字段：对齐",
      "问题：一级标题应居中",
      "片段：“第一章 绪论”",
    ].join("\n"),
  );
});

test("formatIssueCardText：含 affectedText、suggestion、provenance 时格式稳定", () => {
  const result = formatIssueCardText(SAMPLE_ISSUES[0], {
    fileName: "论文.docx",
  });

  assert.equal(result.ok, true);
  assert.match(result.text, /片段：“mixed text”/);
  assert.match(result.text, /建议：请将该段落字号调整为 12pt/);
  assert.match(result.text, /依据：《排版规范》第 3\.2 条：正文使用 12pt。/);
});

test("formatIssueCardText：文档级 issue 文案正确", () => {
  const result = formatIssueCardText(SAMPLE_ISSUES[2], {
    fileName: "论文.docx",
  });

  assert.equal(result.ok, true);
  assert.match(result.text, /位置：文档级问题/);
  assert.match(result.text, /角色：文档设置/);
});

test("formatIssueChecklistText：基于当前 visible issues 顺序稳定输出", () => {
  const visibleIssues = buildVisibleIssues(
    SAMPLE_ISSUES,
    new Set(["error", "warn"]),
    "paragraph",
  );
  const result = formatIssueChecklistText(visibleIssues, {
    fileName: "论文.docx",
  });

  assert.equal(result.ok, true);
  assert.equal(
    result.text,
    [
      "《论文.docx》修改清单",
      "",
      "1. [错误] 第 3 段 · 一级标题 · 对齐",
      "问题：一级标题应居中",
      "片段：“第一章 绪论”",
      "",
      "2. [警告] 第 12 段 · 正文 · 字号",
      "问题：字号应为 12pt，实际 10.5pt",
      "片段：“mixed text”",
      "建议：请将该段落字号调整为 12pt",
      "依据：《排版规范》第 3.2 条：正文使用 12pt。",
      "",
      "3. [错误] 文档级问题 · 文档设置 · 上边距",
      "问题：上边距应为 2.5cm，实际 3cm",
      "片段：“页面设置”",
      "建议：请将上边距调整为 2.5cm",
    ].join("\n"),
  );
});

test("formatIssueChecklistText：空 issue 列表时返回明确可处理结果", () => {
  const result = formatIssueChecklistText([], {
    fileName: "论文.docx",
  });

  assert.equal(result.ok, false);
  assert.equal(result.text, "");
  assert.equal(result.reason, "当前筛选结果没有可复制的问题");
});

test("resolveCopyCardIssue：当前选中 issue 被筛掉时沿用 resolveSelectedIssue 语义", () => {
  const visibleIssues = buildVisibleIssues(
    SAMPLE_ISSUES,
    new Set(["error"]),
    "paragraph",
  );

  const issue = resolveCopyCardIssue(visibleIssues, getIssueKey(SAMPLE_ISSUES[0]!));

  assert.equal(issue?.paraIndex, 2);
  assert.equal(issue?.severity, "error");
});

test("buildReportCopyState：无可见 issue 时按钮不可用原因明确", () => {
  const state = buildReportCopyState({
    fileName: "论文.docx",
    visibleIssues: [],
    selectedIssueKey: null,
  });

  assert.equal(state.availability.canCopyChecklist, false);
  assert.equal(state.availability.checklistReason, "当前筛选结果没有可复制的问题");
  assert.equal(state.availability.canCopyCard, false);
  assert.equal(state.availability.cardReason, "当前没有可复制的问题卡片");
});

test("writeTextToClipboard：成功调用 Clipboard API", async () => {
  const calls: string[] = [];

  await writeTextToClipboard("hello", {
    writeText: async (text: string) => {
      calls.push(text);
    },
  });

  assert.deepEqual(calls, ["hello"]);
});

test("writeTextToClipboard：无 Clipboard API 时抛出明确错误", async () => {
  await assert.rejects(
    () => writeTextToClipboard("hello", null),
    /当前环境不支持剪贴板复制/,
  );
});
