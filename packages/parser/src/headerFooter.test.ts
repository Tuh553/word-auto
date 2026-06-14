import { test } from "node:test";
import assert from "node:assert/strict";
import { parseHeaderFooterPart } from "./headerFooter.js";

test("parseHeaderFooterPart：按长空白拆分页眉左右内容", () => {
  const part = parseHeaderFooterPart(
    `<w:hdr xmlns:w="http://purl.oclc.org/ooxml/wordprocessingml/main">
      <w:p>
        <w:r><w:t>重庆大学硕士学位论文</w:t></w:r>
        <w:r><w:t xml:space="preserve">        </w:t></w:r>
        <w:r><w:t>第一章 绪论</w:t></w:r>
      </w:p>
    </w:hdr>`,
    "word/header1.xml",
    "header",
  );

  assert.equal(part.kind, "header");
  assert.equal(part.path, "word/header1.xml");
  assert.equal(part.leftText, "重庆大学硕士学位论文");
  assert.equal(part.rightText, "第一章 绪论");
  assert.equal(part.centerText, "");
  assert.equal(part.hasPageNumber, false);
});

test("parseHeaderFooterPart：识别居中 PAGE 页码域", () => {
  const part = parseHeaderFooterPart(
    `<w:ftr xmlns:w="http://purl.oclc.org/ooxml/wordprocessingml/main">
      <w:p>
        <w:pPr><w:jc w:val="center"/></w:pPr>
        <w:r><w:fldChar w:fldCharType="begin"/></w:r>
        <w:r><w:instrText xml:space="preserve"> PAGE  \\* MERGEFORMAT </w:instrText></w:r>
        <w:r><w:fldChar w:fldCharType="separate"/></w:r>
        <w:r><w:t>3</w:t></w:r>
        <w:r><w:fldChar w:fldCharType="end"/></w:r>
      </w:p>
    </w:ftr>`,
    "word/footer1.xml",
    "footer",
  );

  assert.equal(part.kind, "footer");
  assert.equal(part.hasPageNumber, true);
  assert.equal(part.centerText, "3");
  assert.deepEqual(
    part.paragraphs[0]?.segments.map((segment) => [
      segment.kind,
      segment.alignment,
      segment.text,
    ]),
    [["pageNumber", "center", "3"]],
  );
});
