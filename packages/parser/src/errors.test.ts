import { test } from "node:test";
import assert from "node:assert/strict";
import { strToU8, zipSync } from "fflate";
import { ParseError, parseDocx } from "./index.js";

const expectParseError = (
  buf: Uint8Array,
  code: ParseError["code"],
): ParseError => {
  assert.throws(
    () => parseDocx(buf),
    (error: unknown) => {
      assert.ok(error instanceof ParseError);
      assert.equal(error.code, code);
      return true;
    },
  );

  try {
    parseDocx(buf);
  } catch (error) {
    assert.ok(error instanceof ParseError);
    return error;
  }
  throw new Error("expected parseDocx to throw");
};

test("parseDocx：旧版 .doc OLE 复合文档 -> LEGACY_DOC", () => {
  const error = expectParseError(
    Uint8Array.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
    "LEGACY_DOC",
  );
  assert.match(error.message, /旧版 \.doc/);
});

test("parseDocx：非 ZIP 输入 -> NOT_ZIP", () => {
  const error = expectParseError(Uint8Array.from([0x6e, 0x6f, 0x70, 0x65]), "NOT_ZIP");
  assert.match(error.message, /ZIP/);
});

test("parseDocx：ZIP 头损坏 -> CORRUPT", () => {
  const error = expectParseError(Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]), "CORRUPT");
  assert.match(error.message, /解压失败|损坏/);
});

test("parseDocx：加密 Office 包 -> ENCRYPTED", () => {
  const buf = zipSync({
    EncryptedPackage: Uint8Array.from([1, 2, 3]),
    EncryptionInfo: Uint8Array.from([4, 5, 6]),
  });
  const error = expectParseError(buf, "ENCRYPTED");
  assert.match(error.message, /加密包|密码保护/);
});

test("parseDocx：缺少 document.xml -> NOT_DOCX", () => {
  const buf = zipSync({
    "[Content_Types].xml": strToU8("<Types/>"),
  });
  const error = expectParseError(buf, "NOT_DOCX");
  assert.match(error.message, /word\/document\.xml/);
});

test("parseDocx：document.xml 结构不对 -> NOT_DOCX", () => {
  const buf = zipSync({
    "word/document.xml": strToU8("<root/>"),
  });
  const error = expectParseError(buf, "NOT_DOCX");
  assert.match(error.message, /OOXML/);
});
