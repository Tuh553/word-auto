import { test } from "node:test";
import assert from "node:assert/strict";
import { parseHeaderFooterPart } from "./headerFooter.js";
import type { StyleDef } from "./types.js";

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

test("parseHeaderFooterPart：解析页眉有效格式与下边框", () => {
  const styles = new Map<string, StyleDef>([
    ["Header", {
      styleId: "Header",
      type: "paragraph",
      run: {
        fontEastAsia: "宋体",
        fontAscii: "Times New Roman",
        fontHAnsi: "Times New Roman",
        sizePt: 10.5,
      },
    }],
  ]);
  const part = parseHeaderFooterPart(
    `<w:hdr xmlns:w="http://purl.oclc.org/ooxml/wordprocessingml/main">
      <w:p>
        <w:pPr>
          <w:pStyle w:val="Header"/>
          <w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="auto"/></w:pBdr>
        </w:pPr>
        <w:r><w:t>重庆大学硕士学位论文</w:t></w:r>
      </w:p>
    </w:hdr>`,
    "word/header1.xml",
    "header",
    {
      styles,
      docDefaults: {
        run: {
          fontEastAsia: "仿宋",
          fontAscii: "Arial",
          sizePt: 12,
        },
      },
    },
  );

  const paragraph = part.paragraphs[0];
  const segment = paragraph?.segments[0];
  assert.equal(paragraph?.effective.fontEastAsia, "宋体");
  assert.equal(paragraph?.effective.fontAscii, "Times New Roman");
  assert.equal(paragraph?.effective.sizePt, 10.5);
  assert.deepEqual(paragraph?.bottomBorder, {
    style: "single",
    size: 6,
    color: "auto",
    space: 1,
  });
  assert.equal(segment?.effective?.fontEastAsia, "宋体");
  assert.equal(segment?.effective?.fontAscii, "Times New Roman");
  assert.equal(segment?.effective?.sizePt, 10.5);
});

test("parseHeaderFooterPart：解析页码结果 run 的有效格式", () => {
  const part = parseHeaderFooterPart(
    `<w:ftr xmlns:w="http://purl.oclc.org/ooxml/wordprocessingml/main">
      <w:p>
        <w:pPr><w:jc w:val="center"/></w:pPr>
        <w:r><w:fldChar w:fldCharType="begin"/></w:r>
        <w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r>
        <w:r><w:fldChar w:fldCharType="separate"/></w:r>
        <w:r>
          <w:rPr>
            <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/>
            <w:sz w:val="18"/>
          </w:rPr>
          <w:t>3</w:t>
        </w:r>
        <w:r><w:fldChar w:fldCharType="end"/></w:r>
      </w:p>
    </w:ftr>`,
    "word/footer1.xml",
    "footer",
    {
      docDefaults: {
        run: {
          fontAscii: "Arial",
          sizePt: 12,
        },
      },
    },
  );

  const pageNumber = part.paragraphs[0]?.segments[0];
  assert.equal(pageNumber?.kind, "pageNumber");
  assert.equal(pageNumber?.alignment, "center");
  assert.equal(pageNumber?.effective?.fontAscii, "Times New Roman");
  assert.equal(pageNumber?.effective?.sizePt, 9);
});
