import { test } from "node:test";
import assert from "node:assert/strict";
import type { DocModel, Paragraph } from "@word-auto/parser";
import { validateDoc } from "./validate.js";
import type { EditableRuleLibrary, StatisticsRuleSet } from "./types.js";

interface StatsModelInput {
  preface?: string[];
  cnAbstract?: string;
  cnKeywords?: string;
  enAbstract?: string;
  enKeywords?: string;
  references?: string[];
}

const mkPara = (
  text: string,
  index: number,
  outlineLevel?: number,
): Paragraph => ({
  index,
  styleId: undefined,
  styleName: undefined,
  directPara: {},
  markRun: {},
  runs: [{ text, props: {} }],
  text,
  structure: { drawingCount: 0, mathCount: 0, embeddedObjectCount: 0 },
  effective: { outlineLevel },
});

const mkModel = ({
  preface = [],
  cnAbstract = "研究方法结论",
  cnKeywords = "关键词：算法；模型；优化",
  enAbstract = "one two three four",
  enKeywords = "Key words: alpha; beta; gamma",
  references = ["Smith J. Research Method. Journal, 2020."],
}: StatsModelInput = {}): DocModel => {
  const entries: Array<[string, number | undefined]> = [
    ...preface.map((text) => [text, undefined] as [string, undefined]),
    ["摘要", undefined],
    [cnAbstract, undefined],
    [cnKeywords, undefined],
    ["Abstract", undefined],
    [enAbstract, undefined],
    [enKeywords, undefined],
    ["第一章 绪论", 0],
    ["正文内容", undefined],
    ["参考文献", undefined],
    ...references.map((text) => [text, undefined] as [string, undefined]),
  ];
  return {
    paragraphs: entries.map(([text, outlineLevel], index) => mkPara(text, index, outlineLevel)),
    styles: new Map(),
    docDefaults: {},
    sections: [],
    headers: [],
    numbering: { abstractNums: new Map(), nums: new Map() },
  };
};

const mkRules = (statistics: StatisticsRuleSet): EditableRuleLibrary => ({
  id: "stats",
  name: "Stats",
  version: "1.0.0",
  source: {
    provenance: {
      cn_keywords: { text: "一般每篇论文应选取3-5个词作为关键字。" },
      en_keywords: { text: "Keywords follow the same count requirement." },
      cn_abstract_body: { text: "中文摘要一般为600-800字。" },
      en_abstract_body: { text: "英文摘要应控制在规定词数范围内。" },
      references: { text: "参考文献不少于规定数量，其中外文文献一般不少于三分之一。" },
    },
  },
  statistics,
  roles: [],
});

const statIssues = (
  model: DocModel,
  statistics: StatisticsRuleSet,
) => validateDoc(model, mkRules(statistics)).issues;

test("统计检测：关键词 3/5 个合格", () => {
  const issues = statIssues(
    mkModel({
      cnKeywords: "关键词：算法；模型；优化",
      enKeywords: "Key words: alpha; beta; gamma; delta; epsilon",
    }),
    {
      keywords: {
        cn: { min: 3, max: 5 },
        en: { min: 3, max: 5 },
      },
    },
  );

  assert.equal(issues.length, 0);
});

test("统计检测：关键词 2/6 个不合格", () => {
  const issues = statIssues(
    mkModel({
      cnKeywords: "关键词：算法；模型",
      enKeywords: "Key words: alpha; beta; gamma; delta; epsilon; zeta",
    }),
    {
      keywords: {
        cn: { min: 3, max: 5 },
        en: { min: 3, max: 5 },
      },
    },
  );

  assert.deepEqual(
    issues.map((issue) => [issue.field, issue.actual, issue.expected]),
    [
      ["keywords_cn_count", 2, "3-5 个"],
      ["keywords_en_count", 6, "3-5 个"],
    ],
  );
  assert.match(issues[0]?.message ?? "", /中文关键词数量应为 3-5 个，实际 2 个/);
  assert.equal(issues[0]?.provenance, "一般每篇论文应选取3-5个词作为关键字。");
  assert.equal(issues[0]?.fixability, "manual");
});

test("统计检测：摘要字数低于或高于范围时报文档级 issue", () => {
  const issues = statIssues(
    mkModel({
      cnAbstract: "研究",
      enAbstract: "one two three four five six",
    }),
    {
      abstract: {
        cn: { min: 3, max: 5 },
        en: { min: 3, max: 5 },
      },
    },
  );

  assert.deepEqual(
    issues.map((issue) => [issue.field, issue.actual, issue.expected]),
    [
      ["abstract_cn_chars", 2, "3-5 字"],
      ["abstract_en_words", 6, "3-5 词"],
    ],
  );
  assert.match(issues[1]?.suggestion ?? "", /英文摘要/);
});

test("统计检测：参考文献数量不足时报 error", () => {
  const issues = statIssues(
    mkModel({
      references: [
        "张三. 中文文献一[J]. 期刊, 2020.",
        "李四. 中文文献二[J]. 期刊, 2021.",
      ],
    }),
    { references: { min_count: 3 } },
  );

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.field, "references_count");
  assert.equal(issues[0]?.severity, "error");
  assert.equal(issues[0]?.actual, 2);
  assert.equal(issues[0]?.expected, "不少于 3 条");
  assert.match(issues[0]?.suggestion ?? "", /补充参考文献/);
});

test("统计检测：外文参考文献占比不足时报 warn", () => {
  const issues = statIssues(
    mkModel({
      references: [
        "Smith J. Research Method. Journal, 2020.",
        "张三. 中文文献一[J]. 期刊, 2020.",
        "李四. 中文文献二[J]. 期刊, 2021.",
      ],
    }),
    { references: { min_foreign_fraction: 0.5 } },
  );

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.field, "references_foreign_fraction");
  assert.equal(issues[0]?.severity, "warn");
  assert.equal(issues[0]?.actual, "33.33%");
  assert.equal(issues[0]?.expected, "不低于 50%");
  assert.match(issues[0]?.message, /1\/3/);
});

test("统计检测：未识别段落不参与统计", () => {
  const issues = statIssues(
    mkModel({
      preface: [
        "关键词：额外一；额外二；额外三；额外四；额外五；额外六",
        "Brown A. Extra Foreign Reference. Journal, 2022.",
      ],
      cnKeywords: "关键词：算法；模型；优化",
      enKeywords: "Key words: alpha; beta; gamma",
      references: ["Smith J. Research Method. Journal, 2020."],
    }),
    {
      keywords: {
        cn: { min: 3, max: 3 },
        en: { min: 3, max: 3 },
      },
      references: {
        min_count: 1,
        min_foreign_fraction: 1,
      },
    },
  );

  assert.equal(issues.length, 0);
});
