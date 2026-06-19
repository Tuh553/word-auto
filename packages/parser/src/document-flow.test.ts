import { test } from "node:test";
import assert from "node:assert/strict";
import { strToU8, zipSync } from "fflate";
import { parseDocx } from "./index.js";

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

test("parseDocx：保留正文与表格段落的全局文档流顺序", () => {
  const model = parseDocx(makeDocx(`
    <w:p><w:r><w:t>正文A</w:t></w:r></w:p>
    <w:tbl>
      <w:tr>
        <w:tc>
          <w:p><w:r><w:t>表格段落</w:t></w:r></w:p>
        </w:tc>
      </w:tr>
    </w:tbl>
    <w:p><w:r><w:t>正文B</w:t></w:r></w:p>
  `));

  assert.deepEqual(
    model.paragraphs.map((paragraph) => paragraph.text),
    ["正文A", "表格段落", "正文B"],
  );
  assert.deepEqual(
    model.paragraphs.map((paragraph) => paragraph.index),
    [0, 1, 2],
  );
  assert.deepEqual(
    model.paragraphs.map((paragraph) => paragraph.inTable === true),
    [false, true, false],
  );
});
