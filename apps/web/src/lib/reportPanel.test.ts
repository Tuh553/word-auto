import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Severity, ValidationReport } from "@word-auto/validator";
import {
  createReportCopyHandlers,
  findSelectedIssueElement,
  ReportPanel,
} from "../components/ReportPanel.js";
import { buildReportCopyState } from "./reportCopy.js";
import { getIssueKey, type ReportGroupBy, type ReportSortBy } from "./reportGroups.js";

const mkReport = (
  provenance?: string,
  issuePatch: Partial<ValidationReport["issues"][number]> = {},
): ValidationReport => ({
  ruleName: "Demo",
  paragraphCount: 4,
  classifiedCount: 2,
  issues: [
    {
      paraIndex: 3,
      role: "body_text",
      field: "size_pt",
      expected: 12,
      actual: 10.5,
      severity: "error",
      message: "字号应为 12pt，实际 10.5pt",
      textPreview: "正文内容",
      provenance,
      suggestion: "请将该段落字号调整为 12pt",
      fixability: "auto",
      ...issuePatch,
    },
  ],
  summary: {
    error: 1,
    warn: 0,
    info: 0,
    byRole: {
      body_text: 1,
    },
  },
});

const ALL_SEVERITIES = new Set<Severity>(["error", "warn", "info"]);
const DEFAULT_GROUP_BY: ReportGroupBy = "section";
const DEFAULT_SORT_BY: ReportSortBy = "paragraph";

test("ReportPanel：issue 有 provenance 时渲染可展开的规范依据", () => {
  const html = renderToStaticMarkup(createElement(ReportPanel, {
    report: mkReport("正文 中文字体为宋体，小四号。"),
    active: ALL_SEVERITIES,
    fileName: "论文.docx",
    groupBy: DEFAULT_GROUP_BY,
    sortBy: DEFAULT_SORT_BY,
    selectedIssueKey: null,
    onToggle: () => {},
    onGroupByChange: () => {},
    onSortByChange: () => {},
    onSelect: () => {},
  }));

  assert.match(html, /规范依据/);
  assert.match(html, /正文 中文字体为宋体，小四号。/);
  assert.match(html, /<details/);
});

test("ReportPanel：issue 无 provenance 时不渲染依据区块", () => {
  const html = renderToStaticMarkup(createElement(ReportPanel, {
    report: mkReport(),
    active: ALL_SEVERITIES,
    fileName: "论文.docx",
    groupBy: DEFAULT_GROUP_BY,
    sortBy: DEFAULT_SORT_BY,
    selectedIssueKey: null,
    onToggle: () => {},
    onGroupByChange: () => {},
    onSortByChange: () => {},
    onSelect: () => {},
  }));

  assert.equal(html.includes("规范依据"), false);
  assert.equal(html.includes("<details"), false);
});

test("ReportPanel：渲染修复建议文案与可修复性标签", () => {
  const html = renderToStaticMarkup(createElement(ReportPanel, {
    report: mkReport(),
    active: ALL_SEVERITIES,
    fileName: "论文.docx",
    groupBy: DEFAULT_GROUP_BY,
    sortBy: DEFAULT_SORT_BY,
    selectedIssueKey: null,
    onToggle: () => {},
    onGroupByChange: () => {},
    onSortByChange: () => {},
    onSelect: () => {},
  }));

  assert.match(html, /请将该段落字号调整为 12pt/);
  assert.match(html, /可自动修复/);
  assert.match(html, /fix-tag auto/);
});

test("ReportPanel：低置信 issue 渲染角色识别提示", () => {
  const html = renderToStaticMarkup(createElement(ReportPanel, {
    report: mkReport(undefined, {
      roleConfidence: "low",
      roleConfidenceReason: "仅按文本题注模式判断",
    }),
    active: ALL_SEVERITIES,
    fileName: "论文.docx",
    groupBy: DEFAULT_GROUP_BY,
    sortBy: DEFAULT_SORT_BY,
    selectedIssueKey: null,
    onToggle: () => {},
    onGroupByChange: () => {},
    onSortByChange: () => {},
    onSelect: () => {},
  }));

  assert.match(html, /角色识别置信度低：仅按文本题注模式判断/);
});

test("ReportPanel：非低置信 issue 不渲染角色识别提示", () => {
  const html = renderToStaticMarkup(createElement(ReportPanel, {
    report: mkReport(undefined, { roleConfidence: "medium" }),
    active: ALL_SEVERITIES,
    fileName: "论文.docx",
    groupBy: DEFAULT_GROUP_BY,
    sortBy: DEFAULT_SORT_BY,
    selectedIssueKey: null,
    onToggle: () => {},
    onGroupByChange: () => {},
    onSortByChange: () => {},
    onSelect: () => {},
  }));

  assert.equal(html.includes("角色识别置信度低"), false);
});

test("ReportPanel：渲染分组与排序控件，并按语义章节输出分组标题", () => {
  const html = renderToStaticMarkup(createElement(ReportPanel, {
    report: {
      ...mkReport(),
      issues: [
        {
          paraIndex: 2,
          role: "body_text",
          field: "size_pt",
          expected: 12,
          actual: 10.5,
          severity: "error",
          message: "正文问题",
          textPreview: "正文内容",
        },
        {
          paraIndex: 8,
          role: "reference_body",
          field: "font_east_asia",
          expected: "宋体",
          actual: "黑体",
          severity: "warn",
          message: "参考文献问题",
          textPreview: "参考文献内容",
        },
      ],
      summary: {
        error: 1,
        warn: 1,
        info: 0,
        byRole: {
          body_text: 1,
          reference_body: 1,
        },
      },
    },
    active: ALL_SEVERITIES,
    fileName: "论文.docx",
    groupBy: DEFAULT_GROUP_BY,
    sortBy: DEFAULT_SORT_BY,
    selectedIssueKey: null,
    onToggle: () => {},
    onGroupByChange: () => {},
    onSortByChange: () => {},
    onSelect: () => {},
  }));

  assert.match(html, /分组方式/);
  assert.match(html, /组内排序/);
  assert.match(html, /正文/);
  assert.match(html, /参考文献/);
});

test("ReportPanel：当前选中 issue 渲染 selected 状态", () => {
  const report = mkReport();
  const html = renderToStaticMarkup(createElement(ReportPanel, {
    report,
    active: ALL_SEVERITIES,
    fileName: "论文.docx",
    groupBy: DEFAULT_GROUP_BY,
    sortBy: DEFAULT_SORT_BY,
    selectedIssueKey: getIssueKey(report.issues[0]!),
    onToggle: () => {},
    onGroupByChange: () => {},
    onSortByChange: () => {},
    onSelect: () => {},
  }));

  assert.match(html, /issue error selected/);
  assert.match(html, /data-issue-key=/);
});

test("ReportPanel：有检测结果时显示复制入口", () => {
  const html = renderToStaticMarkup(createElement(ReportPanel, {
    report: mkReport(),
    active: ALL_SEVERITIES,
    fileName: "论文.docx",
    groupBy: DEFAULT_GROUP_BY,
    sortBy: DEFAULT_SORT_BY,
    selectedIssueKey: null,
    onToggle: () => {},
    onGroupByChange: () => {},
    onSortByChange: () => {},
    onSelect: () => {},
  }));

  assert.match(html, /复制修改清单/);
  assert.match(html, /复制修订建议卡片/);
});

test("ReportPanel：无可见 issue 时复制清单按钮禁用且提示明确", () => {
  const html = renderToStaticMarkup(createElement(ReportPanel, {
    report: mkReport(),
    active: new Set<Severity>(),
    fileName: "论文.docx",
    groupBy: DEFAULT_GROUP_BY,
    sortBy: DEFAULT_SORT_BY,
    selectedIssueKey: null,
    onToggle: () => {},
    onGroupByChange: () => {},
    onSortByChange: () => {},
    onSelect: () => {},
  }));

  assert.match(html, /复制修改清单/);
  assert.match(html, /disabled=""/);
  assert.match(html, /title="当前筛选结果没有可复制的问题"/);
});

test("createReportCopyHandlers：点击复制清单时使用当前可见 issue 集", async () => {
  const report: ValidationReport = {
    ...mkReport(),
    issues: [
      {
        paraIndex: 2,
        role: "body_text",
        field: "size_pt",
        expected: 12,
        actual: 10.5,
        severity: "warn",
        message: "正文问题",
        textPreview: "正文内容",
      },
      {
        paraIndex: 1,
        role: "heading1",
        field: "alignment",
        expected: "center",
        actual: "left",
        severity: "error",
        message: "标题问题",
        textPreview: "第一章 绪论",
      },
    ],
    summary: {
      error: 1,
      warn: 1,
      info: 0,
      byRole: {
        body_text: 1,
        heading1: 1,
      },
    },
  };
  const copyState = buildReportCopyState({
    fileName: "论文.docx",
    visibleIssues: [report.issues[1]!, report.issues[0]!],
    selectedIssueKey: getIssueKey(report.issues[1]!),
  });
  const writes: string[] = [];
  const feedback: string[] = [];
  const handlers = createReportCopyHandlers({
    copyState,
    issueCount: 2,
    setCopyFeedback: (message) => feedback.push(message),
    writeText: async (text) => {
      writes.push(text);
    },
  });

  await handlers.handleCopyChecklist();

  assert.equal(writes.length, 1);
  assert.match(writes[0] ?? "", /^《论文\.docx》修改清单/);
  assert.match(writes[0] ?? "", /1\. \[错误\] 第 2 段 · 一级标题 · 对齐/);
  assert.match(writes[0] ?? "", /2\. \[警告\] 第 3 段 · 正文 · 字号/);
  assert.equal(feedback.at(-1), "已复制 2 条修改清单");
});

test("createReportCopyHandlers：点击复制卡片时使用当前选中 issue", async () => {
  const report = mkReport(undefined, {
    paraIndex: 3,
    role: "body_text",
    field: "size_pt",
    severity: "error",
    message: "字号应为 12pt，实际 10.5pt",
    textPreview: "正文内容",
  });
  const copyState = buildReportCopyState({
    fileName: "论文.docx",
    visibleIssues: report.issues,
    selectedIssueKey: getIssueKey(report.issues[0]!),
  });
  const writes: string[] = [];
  const handlers = createReportCopyHandlers({
    copyState,
    issueCount: 1,
    setCopyFeedback: () => {},
    writeText: async (text) => {
      writes.push(text);
    },
  });

  await handlers.handleCopyCard();

  assert.equal(writes.length, 1);
  assert.match(writes[0] ?? "", /^修订建议卡片/);
  assert.match(writes[0] ?? "", /位置：第 4 段/);
  assert.match(writes[0] ?? "", /字段：字号/);
});

test("createReportCopyHandlers：无选中或无可见 issue 时反馈不回退", async () => {
  const feedback: string[] = [];
  const handlers = createReportCopyHandlers({
    copyState: buildReportCopyState({
      fileName: "论文.docx",
      visibleIssues: [],
      selectedIssueKey: null,
    }),
    issueCount: 0,
    setCopyFeedback: (message) => feedback.push(message),
    writeText: async () => {
      throw new Error("should not run");
    },
  });

  await handlers.handleCopyChecklist();
  await handlers.handleCopyCard();

  assert.deepEqual(feedback, [
    "当前筛选结果没有可复制的问题",
    "当前没有可复制的问题卡片",
  ]);
});

test("findSelectedIssueElement：能稳定找到当前选中的报告项", () => {
  const selectedIssueKey = "issue-2";
  const selected = {
    dataset: { issueKey: selectedIssueKey },
  } as unknown as HTMLElement;
  const container = {
    querySelectorAll: () => [
      { dataset: { issueKey: "issue-1" } },
      selected,
      { dataset: { issueKey: "issue-3" } },
    ],
  } as unknown as ParentNode;

  assert.equal(findSelectedIssueElement(container, selectedIssueKey), selected);
  assert.equal(findSelectedIssueElement(container, "missing"), null);
  assert.equal(findSelectedIssueElement(null, selectedIssueKey), null);
});

test("findSelectedIssueElement：selectedIssueKey 为空时不触发滚入视图目标查找", () => {
  let queried = false;
  const container = {
    querySelectorAll: () => {
      queried = true;
      return [];
    },
  } as unknown as ParentNode;

  assert.equal(findSelectedIssueElement(container, null), null);
  assert.equal(queried, false);
});
