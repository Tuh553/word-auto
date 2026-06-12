import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Severity, ValidationReport } from "@word-auto/validator";
import { ReportPanel } from "../components/ReportPanel.js";
import type { ReportGroupBy, ReportSortBy } from "./reportGroups.js";

const mkReport = (provenance?: string): ValidationReport => ({
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
    groupBy: DEFAULT_GROUP_BY,
    sortBy: DEFAULT_SORT_BY,
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
    groupBy: DEFAULT_GROUP_BY,
    sortBy: DEFAULT_SORT_BY,
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
    groupBy: DEFAULT_GROUP_BY,
    sortBy: DEFAULT_SORT_BY,
    onToggle: () => {},
    onGroupByChange: () => {},
    onSortByChange: () => {},
    onSelect: () => {},
  }));

  assert.match(html, /请将该段落字号调整为 12pt/);
  assert.match(html, /可自动修复/);
  assert.match(html, /fix-tag auto/);
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
    groupBy: DEFAULT_GROUP_BY,
    sortBy: DEFAULT_SORT_BY,
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
