import { test } from "node:test";
import assert from "node:assert/strict";
import { ParseError } from "@word-auto/parser";
import { getFriendlyAnalyzeErrorMessage } from "./analyze.js";

test("getFriendlyAnalyzeErrorMessage：旧版 .doc 给出明确中文提示", () => {
  const message = getFriendlyAnalyzeErrorMessage(
    new ParseError("LEGACY_DOC", "legacy doc"),
  );
  assert.match(message, /旧版 \.doc/);
  assert.match(message, /只支持 \.docx/);
});

test("getFriendlyAnalyzeErrorMessage：未知异常保留检测失败前缀", () => {
  const message = getFriendlyAnalyzeErrorMessage(new Error("boom"));
  assert.equal(message, "检测失败：boom");
});
