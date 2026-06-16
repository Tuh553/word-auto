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
    drawingCount?: number;
    mathCount?: number;
    embeddedObjectCount?: number;
  } = {},
): Paragraph => ({
  index: 0,
  styleId: undefined,
  styleName: opts.styleName,
  directPara: {},
  markRun: {},
  runs: [{ text, props: {} }],
  text,
  structure: {
    drawingCount: opts.drawingCount ?? 0,
    mathCount: opts.mathCount ?? 0,
    embeddedObjectCount: opts.embeddedObjectCount ?? 0,
  },
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
  numbering: { abstractNums: new Map(), nums: new Map() },
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

test("结构信号增强：drawing 邻接图题注、对象公式编号行不再落回 body_text", () => {
  const paras = [
    mkPara("摘要"),
    mkPara("这是摘要正文"),
    mkPara("第一章 绪论", { outlineLevel: 0 }),
    mkPara("", { drawingCount: 1 }),
    mkPara("续图1-1 系统架构图", { alignment: "center" }),
    mkPara("（3-2）", { alignment: "center", embeddedObjectCount: 1 }),
  ];

  assert.deepEqual(classifyParagraphs(paras), [
    "abstract_title_cn",
    "abstract_body_cn",
    "heading1",
    null,
    "figure_caption",
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
    numbering: { abstractNums: new Map(), nums: new Map() },
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
    numbering: { abstractNums: new Map(), nums: new Map() },
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
        structure: { drawingCount: 0, mathCount: 0, embeddedObjectCount: 0 },
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
        structure: { drawingCount: 0, mathCount: 0, embeddedObjectCount: 0 },
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

test("issue 透传命中规则的 provenance：正文与页面设置可回溯原始规范依据", () => {
  const model: DocModel = {
    paragraphs: [
      mkPara("摘要"),
      mkPara("这是摘要正文"),
      mkPara("第一章 绪论", { outlineLevel: 0, sizePt: 16 }),
      mkPara("正文内容", { alignment: "left", sizePt: 10 }),
    ],
    styles: new Map(),
    docDefaults: {},
    sections: [{
      marginTopTwips: 1000,
    }],
    headers: [],
    numbering: { abstractNums: new Map(), nums: new Map() },
  };
  const rules: RuleLibrary = {
    source: {
      provenance: {
        page_setup_comment: { text: "页面设置 A4纸，上边距3厘米。" },
        body: { text: "正文 中文字体为宋体，小四号，两端对齐。" },
      },
    },
    document: {
      margin_top_cm: 3,
    },
    styles: {
      body_text: { size_pt: 12, alignment: "justify" },
    },
  };

  const report = validateDoc(model, rules);
  const marginIssue = report.issues.find((issue) => issue.field === "margin_top_cm");
  const bodyIssue = report.issues.find((issue) => issue.role === "body_text" && issue.field === "size_pt");

  assert.equal(marginIssue?.provenance, "页面设置 A4纸，上边距3厘米。");
  assert.equal(bodyIssue?.provenance, "正文 中文字体为宋体，小四号，两端对齐。");
});

test("provenance 缺失时保持空值，不影响 issue 产出", () => {
  const model = mkModel([
    mkPara("摘要"),
    mkPara("这是摘要正文"),
    mkPara("第一章 绪论", { outlineLevel: 0, sizePt: 16 }),
    mkPara("正文内容", { alignment: "left", sizePt: 10 }),
  ]);
  const rules: RuleLibrary = {
    source: {
      provenance: {
        heading1: { text: "一级标题依据" },
      },
    },
    styles: {
      body_text: { size_pt: 12 },
    },
  };

  const report = validateDoc(model, rules);

  assert.equal(report.issues.length, 1);
  assert.equal(report.issues[0]?.field, "size_pt");
  assert.equal(report.issues[0]?.provenance, undefined);
});

test("validateDoc 产出的 issue 带修复建议与可修复性", () => {
  const model = mkModel([
    mkPara("摘要"),
    mkPara("这是摘要正文"),
    mkPara("第一章 绪论", { outlineLevel: 0, sizePt: 16 }),
    mkPara("正文内容", { alignment: "left", sizePt: 10 }),
  ]);
  const rules: RuleLibrary = {
    document: { margin_top_cm: 3 },
    styles: {
      body_text: { size_pt: 12 },
    },
  };

  const model2: DocModel = {
    ...model,
    sections: [{ marginTopTwips: 1000 }],
  };

  const report = validateDoc(model2, rules);
  const sizeIssue = report.issues.find((it) => it.field === "size_pt");
  const marginIssue = report.issues.find((it) => it.field === "margin_top_cm");

  // 段落样式问题：可自动修复，建议带目标值
  assert.equal(sizeIssue?.fixability, "auto");
  assert.match(sizeIssue?.suggestion ?? "", /12pt/);
  // 页面级问题：需手动处理
  assert.equal(marginIssue?.fixability, "manual");
  assert.ok((marginIssue?.suggestion ?? "").length > 0);
});

test("页眉内容检测：优先匹配结构化左侧页眉", () => {
  const model: DocModel = {
    ...mkModel([]),
    headerParts: [
      {
        kind: "header",
        path: "word/header1.xml",
        text: "重庆大学硕士学位论文 第一章 绪论",
        leftText: "重庆大学硕士学位论文",
        centerText: "",
        rightText: "第一章 绪论",
        hasPageNumber: false,
        paragraphs: [],
      },
    ],
  };
  const rules: RuleLibrary = {
    headers: { left_text: "重庆大学硕士学位论文" },
    styles: {},
  };

  const report = validateDoc(model, rules);

  assert.equal(report.issues.length, 0);
});

test("页眉内容检测：目标文字只在右侧时不算左侧页眉合格", () => {
  const model: DocModel = {
    ...mkModel([]),
    headerParts: [
      {
        kind: "header",
        path: "word/header1.xml",
        text: "第一章 绪论 重庆大学硕士学位论文",
        leftText: "第一章 绪论",
        centerText: "",
        rightText: "重庆大学硕士学位论文",
        hasPageNumber: false,
        paragraphs: [],
      },
    ],
  };
  const rules: RuleLibrary = {
    headers: { left_text: "重庆大学硕士学位论文" },
    styles: {},
  };

  const report = validateDoc(model, rules);

  assert.equal(report.issues.length, 1);
  assert.equal(report.issues[0]?.field, "header_text");
});

test("页眉页脚样式检测：合规字体、字号、页眉线与页码位置不报错", () => {
  const model: DocModel = {
    ...mkModel([]),
    headerParts: [
      {
        kind: "header",
        path: "word/header1.xml",
        text: "重庆大学硕士学位论文 第一章 绪论",
        leftText: "重庆大学硕士学位论文",
        centerText: "",
        rightText: "第一章 绪论",
        hasPageNumber: false,
        paragraphs: [{
          text: "重庆大学硕士学位论文",
          leftText: "重庆大学硕士学位论文",
          centerText: "",
          rightText: "",
          alignment: "left",
          hasPageNumber: false,
          effective: {
            fontEastAsia: "宋体",
            fontAscii: "Times New Roman",
            sizePt: 10.5,
          },
          bottomBorder: { style: "single" },
          segments: [{
            kind: "text",
            text: "重庆大学硕士学位论文",
            alignment: "left",
            effective: {
              fontEastAsia: "宋体",
              fontAscii: "Times New Roman",
              sizePt: 10.5,
            },
          }],
        }],
      },
    ],
    footerParts: [
      {
        kind: "footer",
        path: "word/footer1.xml",
        text: "3",
        leftText: "",
        centerText: "3",
        rightText: "",
        hasPageNumber: true,
        paragraphs: [{
          text: "3",
          leftText: "",
          centerText: "3",
          rightText: "",
          alignment: "center",
          hasPageNumber: true,
          effective: {},
          segments: [{
            kind: "pageNumber",
            text: "3",
            alignment: "center",
            effective: {
              fontAscii: "Times New Roman",
              sizePt: 9,
            },
          }],
        }],
      },
    ],
  };
  const rules: RuleLibrary = {
    headers: {
      left_text: "重庆大学硕士学位论文",
      font_east_asia: "宋体",
      font_latin: "Times New Roman",
      size_pt: 10.5,
      bottom_border: true,
    },
    page_numbers: {
      alignment: "center",
      font_latin: "Times New Roman",
      size_pt: 9,
    },
    styles: {},
  };

  const report = validateDoc(model, rules);

  assert.equal(report.issues.length, 0);
});

test("页眉页脚样式检测：报告字体、字号、页眉线与页码位置问题", () => {
  const model: DocModel = {
    ...mkModel([]),
    headerParts: [
      {
        kind: "header",
        path: "word/header1.xml",
        text: "重庆大学硕士学位论文",
        leftText: "重庆大学硕士学位论文",
        centerText: "",
        rightText: "",
        hasPageNumber: false,
        paragraphs: [{
          text: "重庆大学硕士学位论文",
          leftText: "重庆大学硕士学位论文",
          centerText: "",
          rightText: "",
          alignment: "left",
          hasPageNumber: false,
          effective: {
            fontEastAsia: "黑体",
            fontAscii: "Arial",
            sizePt: 12,
          },
          segments: [{
            kind: "text",
            text: "重庆大学硕士学位论文",
            alignment: "left",
            effective: {
              fontEastAsia: "黑体",
              fontAscii: "Arial",
              sizePt: 12,
            },
          }],
        }],
      },
    ],
    footerParts: [
      {
        kind: "footer",
        path: "word/footer1.xml",
        text: "3",
        leftText: "3",
        centerText: "",
        rightText: "",
        hasPageNumber: true,
        paragraphs: [{
          text: "3",
          leftText: "3",
          centerText: "",
          rightText: "",
          alignment: "left",
          hasPageNumber: true,
          effective: {},
          segments: [{
            kind: "pageNumber",
            text: "3",
            alignment: "left",
            effective: {
              fontAscii: "Arial",
              sizePt: 12,
            },
          }],
        }],
      },
    ],
  };
  const rules: RuleLibrary = {
    headers: {
      left_text: "重庆大学硕士学位论文",
      font_east_asia: "宋体",
      font_latin: "Times New Roman",
      size_pt: 10.5,
      bottom_border: true,
    },
    page_numbers: {
      alignment: "center",
      font_latin: "Times New Roman",
      size_pt: 9,
    },
    styles: {},
  };

  const report = validateDoc(model, rules);

  assert.deepEqual(
    report.issues.map((issue) => issue.field),
    [
      "header_font_east_asia",
      "header_font_latin",
      "header_size_pt",
      "header_bottom_border",
      "page_number_alignment",
      "page_number_font_latin",
      "page_number_size_pt",
    ],
  );
});
