import { test } from "node:test";
import assert from "node:assert/strict";
import {
  findNormalizedTextRange,
  findPreviewBlockTextIndex,
  normalizePreviewText,
} from "./previewHighlight.js";

test("normalizePreviewText：移除空白用于预览文本匹配", () => {
  assert.equal(normalizePreviewText(" 中 文 \n text\t"), "中文text");
});

test("findPreviewBlockTextIndex：只返回目标段落文本命中的 block", () => {
  const index = findPreviewBlockTextIndex(
    ["第一段有重复片段", "目标段包含 局部错误 文本", "第三段也有局部错误"],
    "目标段包含局部错误文本",
  );

  assert.equal(index, 1);
});

test("findPreviewBlockTextIndex：目标文本太短时不猜测命中", () => {
  assert.equal(findPreviewBlockTextIndex(["甲", "乙"], "甲"), -1);
});

test("findNormalizedTextRange：在段落内返回片段原始下标范围", () => {
  const text = "这是一个局部错误片段。";

  assert.deepEqual(findNormalizedTextRange(text, "局部错误"), {
    start: 4,
    end: 8,
  });
});

test("findNormalizedTextRange：片段匹配兼容渲染文本空白差异", () => {
  const text = "混排  字体\n异常";

  assert.deepEqual(findNormalizedTextRange(text, "字体异常"), {
    start: 4,
    end: 9,
  });
});

test("findNormalizedTextRange：片段不存在时返回 null 供整段 fallback", () => {
  assert.equal(findNormalizedTextRange("目标段文本", "不存在"), null);
});
