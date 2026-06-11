import { test } from "node:test";
import assert from "node:assert/strict";
import type { DocModel, LineSpacing, Paragraph } from "@word-auto/parser";
import { classifyParagraphs, validateDoc, type EditableRuleLibrary, type RuleLibrary } from "./index.js";

const mkPara = (
  text: string,
  opts: {
    outlineLevel?: number;
    styleName?: string;
    alignment?: string;
    sizePt?: number;
  inTable?: boolean;
  } = {},
): Paragraph => ({
  index: 0,
  styleId: undefined,
  styleName: opts.styleName,
  directPara: {},
  markRun: {},
  runs: [{ text, props: {} }],
  text,
  effective: {
    outlineLevel: opts.outlineLevel,
    alignment: opts.alignment,
    sizePt: opts.sizePt,
  },
  inTable: opts.inTable,
});

const mkModel = (paragraphs: Paragraph[]): DocModel => ({
  paragraphs,
  styles: new Map(),
  docDefaults: {},
  sections: [],
  headers: [],
});

const exactLineSpacing = (pt: number): LineSpacing => ({
  value: pt,
  rule: "exact",
  pt,
});

const autoLineSpacing = (multiple: number): LineSpacing => ({
  value: multiple,
  rule: "auto",
  multiple,
});

test("章节尾部：参考文献后切到致谢/附录/成果，不再继续 reference_body", () => {
  const paras = [
    mkPara("摘要"),
    mkPara("这是摘要正文"),
    mkPara("第一章 绪论", { outlineLevel: 0 }),
    mkPara("参考文献"),
    mkPara("[1] 示例文献"),
    mkPara("致谢"),
    mkPara("感谢导师和同学的帮助。"),
    mkPara("附录A"),
    mkPara("附录中的补充材料"),
    mkPara("攻读学位期间取得的研究成果"),
    mkPara("已发表论文若干"),
  ];

  assert.deepEqual(classifyParagraphs(paras), [
    "abstract_title_cn",
    "abstract_body_cn",
    "heading1",
    "reference_heading",
    "reference_body",
    "acknowledgement_heading",
    "acknowledgement_body",
    "appendix_heading",
    "appendix_body",
    "achievement_heading",
    "achievement_body",
  ]);
});

test("特殊正文元素：图注/表注/资料来源/公式编号从 body_text 分流", () => {
  const paras = [
    mkPara("摘要"),
    mkPara("这是摘要正文"),
    mkPara("第一章 绪论", { outlineLevel: 0 }),
    mkPara("图1-1 系统架构图"),
    mkPara("表2-3 实验结果"),
    mkPara("资料来源：教育部统计年鉴"),
    mkPara("F=ma（3-2）", { alignment: "center" }),
  ];

  assert.deepEqual(classifyParagraphs(paras), [
    "abstract_title_cn",
    "abstract_body_cn",
    "heading1",
    "figure_caption",
    "table_caption",
    "source_note",
    "formula_line",
  ]);
});

test("校验命中新规则：特殊元素与后置章节按专属角色校验", () => {
  const model = {
    paragraphs: [
      mkPara("摘要"),
      mkPara("这是摘要正文"),
      mkPara("第一章 绪论", { outlineLevel: 0, sizePt: 16 }),
      mkPara("图1-1 系统架构图", { alignment: "center", sizePt: 10.5 }),
      mkPara("资料来源：教育部统计年鉴", { sizePt: 12 }),
      mkPara("F=ma（3-2）", { alignment: "center", sizePt: 12 }),
      mkPara("参考文献"),
      mkPara("[1] 示例文献", { sizePt: 10 }),
      mkPara("致谢"),
      mkPara("感谢导师和同学的帮助。", { sizePt: 10 }),
    ],
    styles: new Map(),
    docDefaults: {},
    sections: [],
    headers: [],
  };
  const rules: RuleLibrary = {
    styles: {
      figure_caption: { size_pt: 10.5, alignment: "center" },
      source_note: { size_pt: 9, first_line_indent_chars: 2 },
      formula_line: { size_pt: 10.5, alignment: "center" },
      reference_body: { size_pt: 10 },
      acknowledgement_body: { size_pt: 12, first_line_indent_chars: 2 },
    },
  };

  const report = validateDoc(model, rules);
  assert.equal(report.issues.length, 3);
  assert.deepEqual(
    report.issues.map((it) => [it.role, it.field]),
    [
      ["source_note", "size_pt"],
      ["formula_line", "size_pt"],
      ["acknowledgement_body", "size_pt"],
    ],
  );
});

test("旧规则兼容：后置部分旧泛化规则仍能覆盖新角色", () => {
  const model = {
    paragraphs: [
      mkPara("摘要"),
      mkPara("这是摘要正文"),
      mkPara("第一章 绪论", { outlineLevel: 0, sizePt: 16 }),
      mkPara("致谢"),
      mkPara("感谢导师和同学的帮助。", { sizePt: 10 }),
    ],
    styles: new Map(),
    docDefaults: {},
    sections: [],
    headers: [],
  };
  const rules: RuleLibrary = {
    styles: {
      back_matter_body: { size_pt: 12 },
    },
  };

  const report = validateDoc(model, rules);
  assert.deepEqual(
    report.issues.map((it) => [it.role, it.field, it.expected]),
    [["acknowledgement_body", "size_pt", 12]],
  );
});

test("可编辑规则：oneOf / range / unset 直接回灌检测", () => {
  const model = mkModel([
      mkPara("摘要"),
      mkPara("这是摘要正文"),
      mkPara("第一章 绪论", { outlineLevel: 0, sizePt: 16 }),
      {
        ...mkPara("正文内容", { alignment: "justify", sizePt: 12 }),
        effective: {
          alignment: "justify",
          sizePt: 12,
          lineSpacing: exactLineSpacing(20),
        },
      },
    ]);
  const rules: EditableRuleLibrary = {
    id: "editable",
    name: "Editable",
    version: "1.0.0",
    roles: [
      {
        role: "body_text",
        label: "正文",
        fields: [
          { key: "fontSizePt", label: "字号", enabled: true, severity: "error", value: { mode: "oneOf", oneOf: [10.5, 12], unit: "pt" } },
          { key: "align", label: "对齐", enabled: true, severity: "warn", value: { mode: "oneOf", oneOf: ["left", "justify"], unit: "enum" } },
          { key: "lineHeightPt", label: "行距", enabled: true, severity: "warn", value: { mode: "range", min: 18, max: 22, unit: "pt" } },
          { key: "bold", label: "加粗", enabled: true, severity: "info", value: { mode: "unset", unit: "bool" } },
        ],
      },
    ],
  };

  const report = validateDoc(model, rules);
  assert.equal(report.issues.length, 0);
});

test("可编辑规则：严重级别与字段模式进入报告", () => {
  const model = mkModel([
      mkPara("摘要"),
      mkPara("这是摘要正文"),
      mkPara("第一章 绪论", { outlineLevel: 0, sizePt: 16 }),
      {
        ...mkPara("正文内容", { alignment: "right", sizePt: 9 }),
        effective: {
          alignment: "right",
          sizePt: 9,
          lineSpacing: autoLineSpacing(1.5),
        },
      },
    ]);
  const rules: EditableRuleLibrary = {
    id: "editable",
    name: "Editable",
    version: "1.0.0",
    roles: [
      {
        role: "body_text",
        label: "正文",
        fields: [
          { key: "fontSizePt", label: "字号", enabled: true, severity: "error", value: { mode: "oneOf", oneOf: [10.5, 12], unit: "pt" } },
          { key: "align", label: "对齐", enabled: true, severity: "info", value: { mode: "exact", exact: "justify", unit: "enum" } },
          { key: "lineHeightPt", label: "行距", enabled: true, severity: "warn", value: { mode: "range", min: 18, max: 22, unit: "pt" } },
        ],
      },
    ],
  };

  const report = validateDoc(model, rules);
  assert.deepEqual(
    report.issues.map((it) => [it.field, it.severity]),
    [
      ["size_pt", "error"],
      ["alignment", "info"],
      ["line_spacing_pt", "warn"],
    ],
  );
});
