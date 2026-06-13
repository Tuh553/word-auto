import { test } from "node:test";
import assert from "node:assert/strict";
import type { Paragraph, NumberingDefinitions } from "@word-auto/parser";
import { recognizeList, recognizeAllLists, groupLists } from "./list-recognition.js";

const mkNumbering = (): NumberingDefinitions => ({
  abstractNums: new Map([
    [
      "0",
      {
        abstractNumId: "0",
        multiLevelType: "singleLevel",
        levels: [
          {
            ilvl: 0,
            start: 1,
            numFmt: "decimal",
            lvlText: "%1.",
          },
        ],
      },
    ],
    [
      "1",
      {
        abstractNumId: "1",
        multiLevelType: "singleLevel",
        levels: [
          {
            ilvl: 0,
            start: 1,
            numFmt: "bullet",
            lvlText: "•",
          },
        ],
      },
    ],
  ]),
  nums: new Map([
    ["1", { numId: "1", abstractNumId: "0" }],
    ["2", { numId: "2", abstractNumId: "1" }],
  ]),
});

const mkPara = (
  text: string,
  opts: { index?: number; numId?: string; ilvl?: number } = {},
): Paragraph => ({
  index: opts.index ?? 0,
  styleId: undefined,
  styleName: undefined,
  directPara: {},
  markRun: {},
  runs: [{ text, props: {} }],
  text,
  structure: { drawingCount: 0, mathCount: 0, embeddedObjectCount: 0 },
  effective: {},
  numbering:
    opts.numId !== undefined
      ? { numId: opts.numId, ilvl: opts.ilvl ?? 0 }
      : undefined,
});

test("列表识别：有序列表", () => {
  const numbering = mkNumbering();
  const para = mkPara("第一项", { index: 0, numId: "1", ilvl: 0 });

  const item = recognizeList(para, numbering);
  assert.ok(item);
  assert.equal(item.listType, "ordered");
  assert.equal(item.level, 0);
  assert.equal(item.numId, "1");
});

test("列表识别：无序列表", () => {
  const numbering = mkNumbering();
  const para = mkPara("无序项", { index: 0, numId: "2", ilvl: 0 });

  const item = recognizeList(para, numbering);
  assert.ok(item);
  assert.equal(item.listType, "unordered");
  assert.equal(item.level, 0);
});

test("列表识别：非列表段落", () => {
  const numbering = mkNumbering();
  const para = mkPara("普通段落", { index: 0 });

  const item = recognizeList(para, numbering);
  assert.equal(item, null);
});

test("识别所有列表项", () => {
  const numbering = mkNumbering();
  const paragraphs = [
    mkPara("标题", { index: 0 }),
    mkPara("第一项", { index: 1, numId: "1", ilvl: 0 }),
    mkPara("第二项", { index: 2, numId: "1", ilvl: 0 }),
    mkPara("普通段落", { index: 3 }),
    mkPara("无序项1", { index: 4, numId: "2", ilvl: 0 }),
    mkPara("无序项2", { index: 5, numId: "2", ilvl: 0 }),
  ];

  const items = recognizeAllLists(paragraphs, numbering);
  assert.equal(items.length, 4);
  assert.equal(items[0].listType, "ordered");
  assert.equal(items[1].listType, "ordered");
  assert.equal(items[2].listType, "unordered");
  assert.equal(items[3].listType, "unordered");
});

test("列表分组：按 numId 和类型分组", () => {
  const numbering = mkNumbering();
  const paragraphs = [
    mkPara("有序1", { index: 0, numId: "1", ilvl: 0 }),
    mkPara("有序2", { index: 1, numId: "1", ilvl: 0 }),
    mkPara("无序1", { index: 2, numId: "2", ilvl: 0 }),
    mkPara("无序2", { index: 3, numId: "2", ilvl: 0 }),
    mkPara("有序3", { index: 4, numId: "1", ilvl: 0 }),
  ];

  const items = recognizeAllLists(paragraphs, numbering);
  const groups = groupLists(items);

  assert.equal(groups.length, 3);
  assert.equal(groups[0].type, "ordered");
  assert.equal(groups[0].items.length, 2);
  assert.equal(groups[1].type, "unordered");
  assert.equal(groups[1].items.length, 2);
  assert.equal(groups[2].type, "ordered");
  assert.equal(groups[2].items.length, 1);
});
