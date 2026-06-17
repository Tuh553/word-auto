import { test } from "node:test";
import assert from "node:assert/strict";
import type { Bookmark, Field, Paragraph } from "@word-auto/parser";
import {
  checkHeadingSequence,
  checkFigureCaptionSequence,
  checkTableCaptionSequence,
} from "./numbering-check.js";
import type { ClassifiedParagraph } from "./types.js";

const mkPara = (
  text: string,
  opts: { outlineLevel?: number; index?: number; fields?: Field[]; bookmarks?: Bookmark[] } = {},
): Paragraph => ({
  index: opts.index ?? 0,
  styleId: undefined,
  styleName: undefined,
  directPara: {},
  markRun: {},
  runs: [{ text, props: {} }],
  text,
  bookmarks: opts.bookmarks,
  fields: opts.fields,
  structure: { drawingCount: 0, mathCount: 0, embeddedObjectCount: 0 },
  effective: { outlineLevel: opts.outlineLevel },
});

const mkClassified = (
  text: string,
  role: string,
  opts: { outlineLevel?: number; index?: number; fields?: Field[]; bookmarks?: Bookmark[] } = {},
): ClassifiedParagraph => ({
  para: mkPara(text, opts),
  role: role as any,
});

test("标题题序连续性检测：正常连续", () => {
  const classified = [
    mkClassified("第一章 绪论", "heading", { outlineLevel: 0, index: 0 }),
    mkClassified("正文", "body_text", { index: 1 }),
    mkClassified("第二章 文献综述", "heading", { outlineLevel: 0, index: 2 }),
    mkClassified("2.1 国内研究", "heading", { outlineLevel: 1, index: 3 }),
    mkClassified("2.2 国外研究", "heading", { outlineLevel: 1, index: 4 }),
    mkClassified("第三章 研究方法", "heading", { outlineLevel: 0, index: 5 }),
  ];

  const issues = checkHeadingSequence(classified);
  assert.equal(issues.length, 0);
});

test("标题题序连续性检测：一级标题跳号", () => {
  const classified = [
    mkClassified("第一章 绪论", "heading", { outlineLevel: 0, index: 0 }),
    mkClassified("第三章 研究方法", "heading", { outlineLevel: 0, index: 1 }),
  ];

  const issues = checkHeadingSequence(classified);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].paragraphIndex, 1);
  assert.equal(issues[0].field, "heading_sequence");
  assert.equal(issues[0].expected, 2);
  assert.equal(issues[0].actual, 3);
});

test("标题题序连续性检测：二级标题跳号", () => {
  const classified = [
    mkClassified("第一章 绪论", "heading", { outlineLevel: 0, index: 0 }),
    mkClassified("1.1 研究背景", "heading", { outlineLevel: 1, index: 1 }),
    mkClassified("1.3 研究意义", "heading", { outlineLevel: 1, index: 2 }),
  ];

  const issues = checkHeadingSequence(classified);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].paragraphIndex, 2);
  assert.equal(issues[0].expected, 2);
  assert.equal(issues[0].actual, 3);
});

test("标题题序连续性检测：章节变化后下级重置", () => {
  const classified = [
    mkClassified("第一章 绪论", "heading", { outlineLevel: 0, index: 0 }),
    mkClassified("1.1 背景", "heading", { outlineLevel: 1, index: 1 }),
    mkClassified("1.2 意义", "heading", { outlineLevel: 1, index: 2 }),
    mkClassified("第二章 文献综述", "heading", { outlineLevel: 0, index: 3 }),
    mkClassified("2.1 国内研究", "heading", { outlineLevel: 1, index: 4 }),
  ];

  const issues = checkHeadingSequence(classified);
  assert.equal(issues.length, 0);
});

test("标题题序连续性检测：数字加空格的一级标题可重置下级", () => {
  const classified = [
    mkClassified("1 绪论", "heading1", { outlineLevel: 0, index: 0 }),
    mkClassified("1.1 背景", "heading2", { outlineLevel: 1, index: 1 }),
    mkClassified("1.2 意义", "heading2", { outlineLevel: 1, index: 2 }),
    mkClassified("2 标题", "heading1", { outlineLevel: 0, index: 3 }),
    mkClassified("2.1 国内研究", "heading2", { outlineLevel: 1, index: 4 }),
  ];

  const issues = checkHeadingSequence(classified);
  assert.equal(issues.length, 0);
});

test("标题题序连续性检测：无编号一级标题也会重置下级", () => {
  const classified = [
    mkClassified("绪论", "heading1", { outlineLevel: 0, index: 0 }),
    mkClassified("1.1 背景", "heading2", { outlineLevel: 1, index: 1 }),
    mkClassified("1.2 意义", "heading2", { outlineLevel: 1, index: 2 }),
    mkClassified("偏振理论与超透镜器件工作原理", "heading1", { outlineLevel: 0, index: 3 }),
    mkClassified("2.1 偏振基本理论", "heading2", { outlineLevel: 1, index: 4 }),
  ];

  const issues = checkHeadingSequence(classified);
  assert.equal(issues.length, 0);
});

test("标题题序连续性检测：多级编号后无空格也能识别", () => {
  const classified = [
    mkClassified("偏振检测结果与校准分析", "heading1", { outlineLevel: 0, index: 0 }),
    mkClassified("4.1六种基矢量偏振输入下的焦平面响应结果", "heading2", { outlineLevel: 1, index: 1 }),
    mkClassified("4.2 基于理想Stokes初步重建", "heading2", { outlineLevel: 1, index: 2 }),
  ];

  const issues = checkHeadingSequence(classified);
  assert.equal(issues.length, 0);
});

test("图题注连号检测：单级编号正常", () => {
  const classified = [
    mkClassified("图 1 研究框架", "figure_caption", { index: 0 }),
    mkClassified("图 2 技术路线", "figure_caption", { index: 1 }),
    mkClassified("图 3 流程图", "figure_caption", { index: 2 }),
  ];

  const issues = checkFigureCaptionSequence(classified);
  assert.equal(issues.length, 0);
});

test("图题注连号检测：单级编号跳号", () => {
  const classified = [
    mkClassified("图 1 研究框架", "figure_caption", { index: 0 }),
    mkClassified("图 3 流程图", "figure_caption", { index: 1 }),
  ];

  const issues = checkFigureCaptionSequence(classified);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].paragraphIndex, 1);
  assert.equal(issues[0].expected, 2);
  assert.equal(issues[0].actual, 3);
});

test("图题注连号检测：两级编号正常", () => {
  const classified = [
    mkClassified("第一章 绪论", "heading", { outlineLevel: 0, index: 0 }),
    mkClassified("图 1-1 研究框架", "figure_caption", { index: 1 }),
    mkClassified("图 1-2 技术路线", "figure_caption", { index: 2 }),
    mkClassified("第二章 文献综述", "heading", { outlineLevel: 0, index: 3 }),
    mkClassified("图 2-1 理论模型", "figure_caption", { index: 4 }),
  ];

  const issues = checkFigureCaptionSequence(classified);
  assert.equal(issues.length, 0);
});

test("图题注连号检测：章节跟踪支持 heading1 角色", () => {
  const classified = [
    mkClassified("1 绪论", "heading1", { outlineLevel: 0, index: 0 }),
    mkClassified("图 1-1 研究框架", "figure_caption", { index: 1 }),
    mkClassified("2 标题", "heading1", { outlineLevel: 0, index: 2 }),
    mkClassified("图 2-1 理论模型", "figure_caption", { index: 3 }),
  ];

  const issues = checkFigureCaptionSequence(classified);
  assert.equal(issues.length, 0);
});

test("图题注连号检测：两级次编号跳号", () => {
  const classified = [
    mkClassified("第一章 绪论", "heading", { outlineLevel: 0, index: 0 }),
    mkClassified("图 1-1 研究框架", "figure_caption", { index: 1 }),
    mkClassified("图 1-3 技术路线", "figure_caption", { index: 2 }),
  ];

  const issues = checkFigureCaptionSequence(classified);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].paragraphIndex, 2);
  assert.equal(issues[0].severity, "error");
});

test("图题注连号检测：主编号变化后次编号未重置", () => {
  const classified = [
    mkClassified("第一章 绪论", "heading", { outlineLevel: 0, index: 0 }),
    mkClassified("图 1-2 研究框架", "figure_caption", { index: 1 }),
    mkClassified("第二章 文献", "heading", { outlineLevel: 0, index: 2 }),
    mkClassified("图 2-3 理论模型", "figure_caption", { index: 3 }),
  ];

  const issues = checkFigureCaptionSequence(classified);
  // 两个图题注都有问题：1-2应为1-1，2-3应为2-1
  assert.equal(issues.length, 2);
  assert.equal(issues[0].paragraphIndex, 1);
  assert.equal(issues[0].message.includes("应从 1 开始"), true);
  assert.equal(issues[1].paragraphIndex, 3);
  assert.equal(issues[1].message.includes("应从 1 开始"), true);
});

test("图题注连号检测：优先使用 SEQ 域编号而不是段落正则", () => {
  const classified = [
    mkClassified("第一章 绪论", "heading", { outlineLevel: 0, index: 0 }),
    mkClassified("图 X 研究框架", "figure_caption", {
      index: 1,
      bookmarks: [{ name: "_RefFigure1" }],
      fields: [{
        type: "SEQ",
        instruction: "SEQ Figure \\* ARABIC",
        displayText: "1-1",
        sequence: "Figure",
        startRunIndex: 1,
        endRunIndex: 5,
      }],
    }),
    mkClassified("图 X 技术路线", "figure_caption", {
      index: 2,
      bookmarks: [{ name: "_RefFigure2" }],
      fields: [{
        type: "SEQ",
        instruction: "SEQ Figure \\* ARABIC",
        displayText: "1-3",
        sequence: "Figure",
        startRunIndex: 1,
        endRunIndex: 5,
      }],
    }),
  ];

  const issues = checkFigureCaptionSequence(classified);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].paragraphIndex, 2);
  assert.equal(issues[0].actual, "1-3");
  assert.equal(issues[0].expected, "1-2");
});

test("表题注连号检测：正常连续", () => {
  const classified = [
    mkClassified("表 1 实验数据", "table_caption", { index: 0 }),
    mkClassified("表 2 对比分析", "table_caption", { index: 1 }),
  ];

  const issues = checkTableCaptionSequence(classified);
  assert.equal(issues.length, 0);
});

test("表题注连号检测：跳号", () => {
  const classified = [
    mkClassified("表 1 实验数据", "table_caption", { index: 0 }),
    mkClassified("表 3 对比分析", "table_caption", { index: 1 }),
  ];

  const issues = checkTableCaptionSequence(classified);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].expected, 2);
  assert.equal(issues[0].actual, 3);
});

test("混合编号检测：图表独立编号", () => {
  const classified = [
    mkClassified("第一章 绪论", "heading", { outlineLevel: 0, index: 0 }),
    mkClassified("图 1 研究框架", "figure_caption", { index: 1 }),
    mkClassified("表 1 实验数据", "table_caption", { index: 2 }),
    mkClassified("图 2 技术路线", "figure_caption", { index: 3 }),
    mkClassified("表 2 对比分析", "table_caption", { index: 4 }),
  ];

  const figIssues = checkFigureCaptionSequence(classified);
  const tblIssues = checkTableCaptionSequence(classified);
  assert.equal(figIssues.length, 0);
  assert.equal(tblIssues.length, 0);
});
