import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Module from "node:module";
import type { Severity, ValidationReport } from "@word-auto/validator";

type ModuleWithLoad = typeof Module & {
  _load: (request: string, parent: unknown, isMain: boolean) => unknown;
};

const moduleWithLoad = Module as ModuleWithLoad;
const originalLoad = moduleWithLoad._load;

const report: ValidationReport = {
  ruleName: "Demo",
  paragraphCount: 4,
  classifiedCount: 2,
  issues: [
    {
      paraIndex: 1,
      role: "heading1",
      field: "alignment",
      expected: "center",
      actual: "left",
      severity: "error",
      message: "标题应居中",
      textPreview: "第一章 绪论",
    },
  ],
  summary: {
    error: 1,
    warn: 0,
    info: 0,
    byRole: {
      heading1: 1,
    },
  },
};

test("DetectWorkspace：有检测结果时显示报告复制入口所在区域", async () => {
  moduleWithLoad._load = function patched(request, parent, isMain) {
    if (typeof request === "string" && request.endsWith("/PreviewPanel.js")) {
      return {
        PreviewPanel: () => createElement("div", null, "PREVIEW"),
      };
    }
    if (typeof request === "string" && request.endsWith("/ReportPanel.js")) {
      return {
        ReportPanel: () => createElement("div", null, "复制修改清单 / 复制修订建议卡片"),
      };
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    const { DetectWorkspace } = await import("./DetectWorkspace.js");
    const html = renderToStaticMarkup(createElement(DetectWorkspace, {
      active: new Set<Severity>(["error", "warn", "info"]),
      buffer: new ArrayBuffer(8),
      currentLibrary: undefined,
      error: null,
      fileName: "论文.docx",
      isAnalyzing: false,
      libraries: [],
      over: false,
      previewIssueTargets: [],
      reportGroupBy: "section",
      reportSortBy: "paragraph",
      result: {
        report,
        model: {} as never,
      },
      selectedIssueKey: null,
      selectedPreviewTarget: null,
      shouldScrollSelectedPreviewTarget: false,
      step: 3,
      suppressScrollSelectionUntil: 0,
      templateId: "default",
      unpublishedChanges: false,
      onGroupByChange: () => {},
      onOverChange: () => {},
      onPickFile: async () => {},
      onReset: () => {},
      onRun: () => {},
      onSelectIssue: () => {},
      onSelectIssueFromPreview: () => {},
      onSortByChange: () => {},
      onStepChange: () => {},
      onTemplateChange: () => {},
      onToggleSeverity: () => {},
    }));

    assert.match(html, /复制修改清单/);
    assert.match(html, /复制修订建议卡片/);
  } finally {
    moduleWithLoad._load = originalLoad;
  }
});
