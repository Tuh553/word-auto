import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Severity, ValidationReport } from "@word-auto/validator";
import { ReportPanel } from "../components/ReportPanel.js";

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

test("ReportPanel：issue 有 provenance 时渲染可展开的规范依据", () => {
  const html = renderToStaticMarkup(createElement(ReportPanel, {
    report: mkReport("正文 中文字体为宋体，小四号。"),
    active: ALL_SEVERITIES,
    onToggle: () => {},
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
    onToggle: () => {},
    onSelect: () => {},
  }));

  assert.equal(html.includes("规范依据"), false);
  assert.equal(html.includes("<details"), false);
});
