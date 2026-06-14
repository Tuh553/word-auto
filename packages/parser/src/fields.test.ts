import { test } from "node:test";
import assert from "node:assert/strict";
import { strToU8, zipSync } from "fflate";
import { parseParagraphBookmarks, parseParagraphFields } from "./fields.js";
import { parseDocx } from "./index.js";
import { parseXml } from "./ooxml.js";

const wrapDocumentXml = (bodyInnerXml: string): string => `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://purl.oclc.org/ooxml/wordprocessingml/main">
  <w:body>
    ${bodyInnerXml}
  </w:body>
</w:document>`;

const makeDocx = (bodyInnerXml: string): Uint8Array =>
  zipSync({
    "word/document.xml": strToU8(wrapDocumentXml(bodyInnerXml)),
  });

const parseParagraphXml = (paragraphXml: string): any =>
  parseXml(wrapDocumentXml(paragraphXml))["w:document"]["w:body"]["w:p"][0];

test("parseParagraphFields：识别复杂 SEQ 域并提取序列名", () => {
  const wp = parseParagraphXml(`
    <w:p>
      <w:r><w:t>图 </w:t></w:r>
      <w:r><w:fldChar w:fldCharType="begin"/></w:r>
      <w:r><w:instrText xml:space="preserve"> SEQ Figure \\* ARABIC </w:instrText></w:r>
      <w:r><w:fldChar w:fldCharType="separate"/></w:r>
      <w:r><w:t>1-1</w:t></w:r>
      <w:r><w:fldChar w:fldCharType="end"/></w:r>
    </w:p>
  `);

  assert.deepEqual(parseParagraphFields(wp), [{
    type: "SEQ",
    instruction: "SEQ Figure \\* ARABIC",
    displayText: "1-1",
    sequence: "Figure",
    startRunIndex: 1,
    endRunIndex: 5,
  }]);
});

test("parseParagraphFields：支持嵌套复杂域", () => {
  const wp = parseParagraphXml(`
    <w:p>
      <w:r><w:fldChar w:fldCharType="begin"/></w:r>
      <w:r><w:instrText xml:space="preserve"> HYPERLINK "https://example.com" </w:instrText></w:r>
      <w:r><w:fldChar w:fldCharType="separate"/></w:r>
      <w:r><w:fldChar w:fldCharType="begin"/></w:r>
      <w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r>
      <w:r><w:fldChar w:fldCharType="separate"/></w:r>
      <w:r><w:t>12</w:t></w:r>
      <w:r><w:fldChar w:fldCharType="end"/></w:r>
      <w:r><w:fldChar w:fldCharType="end"/></w:r>
    </w:p>
  `);

  assert.deepEqual(parseParagraphFields(wp), [
    {
      type: "HYPERLINK",
      instruction: 'HYPERLINK "https://example.com"',
      displayText: "12",
      startRunIndex: 0,
      endRunIndex: 8,
    },
    {
      type: "PAGE",
      instruction: "PAGE",
      displayText: "12",
      startRunIndex: 3,
      endRunIndex: 7,
    },
  ]);
});

test("parseParagraphBookmarks：提取段落内书签起点", () => {
  const wp = parseParagraphXml(`
    <w:p>
      <w:bookmarkStart w:id="7" w:name="_RefFigure1"/>
      <w:r><w:t>图 </w:t></w:r>
      <w:bookmarkEnd w:id="7"/>
    </w:p>
  `);

  assert.deepEqual(parseParagraphBookmarks(wp), [{
    id: "7",
    name: "_RefFigure1",
  }]);
});

test("parseDocx：简单域写入 Paragraph.fields 与可见文本", () => {
  const model = parseDocx(makeDocx(`
    <w:p>
      <w:fldSimple w:instr=' HYPERLINK "https://example.com" '>
        <w:r><w:t>链接</w:t></w:r>
      </w:fldSimple>
    </w:p>
  `));

  assert.equal(model.paragraphs.length, 1);
  assert.equal(model.paragraphs[0]?.text, "链接");
  assert.deepEqual(model.paragraphs[0]?.fields, [{
    type: "HYPERLINK",
    instruction: 'HYPERLINK "https://example.com"',
    displayText: "链接",
    startRunIndex: 0,
    endRunIndex: 0,
  }]);
});

test("parseDocx：覆盖题注、REF/PAGEREF 交叉引用与页码域", () => {
  const model = parseDocx(makeDocx(`
    <w:p>
      <w:bookmarkStart w:id="1" w:name="_RefFigure1"/>
      <w:r><w:t>图 </w:t></w:r>
      <w:r><w:fldChar w:fldCharType="begin"/></w:r>
      <w:r><w:instrText xml:space="preserve"> SEQ Figure \\* ARABIC </w:instrText></w:r>
      <w:r><w:fldChar w:fldCharType="separate"/></w:r>
      <w:r><w:t>1</w:t></w:r>
      <w:r><w:fldChar w:fldCharType="end"/></w:r>
      <w:r><w:t> 研究装置</w:t></w:r>
      <w:bookmarkEnd w:id="1"/>
    </w:p>
    <w:p>
      <w:r><w:t>见图 </w:t></w:r>
      <w:r><w:fldChar w:fldCharType="begin"/></w:r>
      <w:r><w:instrText xml:space="preserve"> REF _RefFigure1 \\h </w:instrText></w:r>
      <w:r><w:fldChar w:fldCharType="separate"/></w:r>
      <w:r><w:t>1</w:t></w:r>
      <w:r><w:fldChar w:fldCharType="end"/></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>详见第 </w:t></w:r>
      <w:r><w:fldChar w:fldCharType="begin"/></w:r>
      <w:r><w:instrText xml:space="preserve"> PAGEREF _RefFigure1 \\h </w:instrText></w:r>
      <w:r><w:fldChar w:fldCharType="separate"/></w:r>
      <w:r><w:t>3</w:t></w:r>
      <w:r><w:fldChar w:fldCharType="end"/></w:r>
    </w:p>
    <w:p>
      <w:r><w:fldChar w:fldCharType="begin"/></w:r>
      <w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r>
      <w:r><w:fldChar w:fldCharType="separate"/></w:r>
      <w:r><w:t>7</w:t></w:r>
      <w:r><w:fldChar w:fldCharType="end"/></w:r>
    </w:p>
  `));

  assert.deepEqual(
    model.paragraphs.map((paragraph) => paragraph.fields?.[0]).filter(Boolean),
    [
      {
        type: "SEQ",
        instruction: "SEQ Figure \\* ARABIC",
        displayText: "1",
        sequence: "Figure",
        startRunIndex: 1,
        endRunIndex: 5,
      },
      {
        type: "REF",
        instruction: "REF _RefFigure1 \\h",
        displayText: "1",
        bookmark: "_RefFigure1",
        startRunIndex: 1,
        endRunIndex: 5,
      },
      {
        type: "PAGEREF",
        instruction: "PAGEREF _RefFigure1 \\h",
        displayText: "3",
        bookmark: "_RefFigure1",
        startRunIndex: 1,
        endRunIndex: 5,
      },
      {
        type: "PAGE",
        instruction: "PAGE",
        displayText: "7",
        startRunIndex: 0,
        endRunIndex: 4,
      },
    ],
  );
  assert.deepEqual(model.paragraphs[0]?.bookmarks, [{
    id: "1",
    name: "_RefFigure1",
  }]);
});
