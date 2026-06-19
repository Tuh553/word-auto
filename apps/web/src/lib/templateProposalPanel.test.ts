import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { RuleDraft, RuleProposal } from "@word-auto/validator";
import { TemplateProposalPanel } from "../components/TemplateProposalPanel.js";
import { roleFieldProposalIgnoreKey } from "./proposalIgnores.js";

const draft: RuleDraft = {
  id: "tpl",
  name: "模板",
  version: "1.0.0",
  status: "draft",
  roles: [
    {
      role: "body_text",
      label: "正文",
      fields: [
        {
          key: "fontSizePt",
          label: "字号",
          enabled: false,
          severity: "error",
          value: { mode: "exact", exact: 12, unit: "pt" },
        },
        {
          key: "align",
          label: "对齐",
          enabled: true,
          severity: "warn",
          value: { mode: "exact", exact: "left", unit: "enum" },
        },
        {
          key: "bold",
          label: "加粗",
          enabled: true,
          severity: "warn",
          value: { mode: "exact", exact: true, unit: "bool" },
        },
      ],
    },
  ],
};

const proposal: RuleProposal = {
  sourceName: "sample.docx",
  extractedAt: "2026-06-19T00:00:00.000Z",
  paragraphCount: 4,
  classifiedCount: 4,
  unclassifiedCount: 0,
  notices: [],
  roles: [
    {
      role: "body_text",
      label: "正文",
      totalCount: 3,
      fields: [
        {
          key: "fontSizePt",
          proposedValue: { mode: "exact", exact: 12, unit: "pt" },
          confidence: 0.9,
          confidenceLevel: "high",
          confidenceHint: "主值集中",
          sampleCount: 3,
          coverage: 1,
          observedCount: 3,
          totalCount: 3,
          evidence: ["段落 3: 正文样本"],
          evidenceSamples: [{
            sampleIndex: 3,
            text: "正文样本",
            value: 12,
            role: "body_text",
            roleLabel: "正文",
            roleConfidence: "high",
          }],
        },
        {
          key: "align",
          proposedValue: { mode: "exact", exact: "justify", unit: "enum" },
          confidence: 0.8,
          confidenceLevel: "medium",
          confidenceHint: "存在少量冲突",
          sampleCount: 2,
          coverage: 0.67,
          observedCount: 3,
          totalCount: 3,
          evidence: ["段落 4: 低置信样本"],
          evidenceSamples: [{
            sampleIndex: 4,
            text: "低置信样本",
            value: "justify",
            role: "body_text",
            roleLabel: "正文",
            roleConfidence: "low",
            roleConfidenceReason: "仅按文本模式判断",
          }],
        },
        {
          key: "lineHeightPt",
          proposedValue: { mode: "exact", exact: 20, unit: "pt" },
          confidence: 0.7,
          confidenceLevel: "medium",
          confidenceHint: "样本可参考",
          sampleCount: 2,
          coverage: 0.67,
          observedCount: 2,
          totalCount: 3,
          evidence: [],
        },
        {
          key: "bold",
          proposedValue: { mode: "exact", exact: true, unit: "bool" },
          confidence: 0.9,
          confidenceLevel: "high",
          confidenceHint: "主值集中",
          sampleCount: 3,
          coverage: 1,
          observedCount: 3,
          totalCount: 3,
          evidence: [],
        },
      ],
    },
  ],
};

const renderPanel = (
  ignoredProposalKeys = new Set<string>(),
  showIgnoredProposals = false,
): string =>
  renderToStaticMarkup(
    React.createElement(TemplateProposalPanel, {
      draft,
      ignoredProposalKeys,
      proposal,
      proposalFeedback: null,
      showIgnoredProposals,
      templateId: "tpl",
      onAcceptDocument: () => undefined,
      onAcceptDocumentField: () => undefined,
      onAcceptField: () => undefined,
      onAcceptRole: () => undefined,
      onClearFeedback: () => undefined,
      onExtract: () => undefined,
      onIgnoreProposal: () => undefined,
      onRestoreProposal: () => undefined,
      onToggleIgnoredProposals: () => undefined,
    }),
  );

test("TemplateProposalPanel：展示候选 diff 与证据下钻信息", () => {
  const html = renderPanel();

  assert.match(html, /启用已禁用字段/);
  assert.match(html, /覆盖已有值/);
  assert.match(html, /新增字段/);
  assert.match(html, /与当前值一致/);
  assert.match(html, /查看证据/);
  assert.match(html, /样本 4 · 正文 · 角色置信度低/);
  assert.match(html, /角色识别置信度低：仅按文本模式判断/);
});

test("TemplateProposalPanel：默认隐藏已忽略候选，展开后可取消忽略", () => {
  const key = roleFieldProposalIgnoreKey("tpl", "body_text", "align");
  const hiddenHtml = renderPanel(new Set([key]));
  const shownHtml = renderPanel(new Set([key]), true);

  assert.match(hiddenHtml, /已忽略 1 个候选/);
  assert.doesNotMatch(hiddenHtml, /覆盖已有值/);
  assert.match(shownHtml, /已忽略/);
  assert.match(shownHtml, /取消忽略/);
  assert.match(shownHtml, /覆盖已有值/);
});
