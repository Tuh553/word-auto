import { test } from "node:test";
import assert from "node:assert/strict";
import { strToU8, zipSync } from "fflate";
import { parseDocx } from "./index.js";
import { parseNoteDefinitions } from "./notes.js";

const wrapDocumentXml = (bodyInnerXml: string): string => `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://purl.oclc.org/ooxml/wordprocessingml/main">
  <w:body>
    ${bodyInnerXml}
  </w:body>
</w:document>`;

const wrapNotesXml = (
  type: "footnote" | "endnote",
  innerXml: string,
): string => {
  const tag = type === "footnote" ? "footnotes" : "endnotes";
  const itemTag = type === "footnote" ? "footnote" : "endnote";
  return `<?xml version="1.0" encoding="UTF-8"?>
<w:${tag} xmlns:w="http://purl.oclc.org/ooxml/wordprocessingml/main">
  <w:${itemTag} w:type="separator" w:id="-1">
    <w:p><w:r><w:separator /></w:r></w:p>
  </w:${itemTag}>
  ${innerXml}
</w:${tag}>`;
};

const makeDocx = (
  bodyInnerXml: string,
  options?: {
    footnotesXml?: string;
    endnotesXml?: string;
  },
): Uint8Array =>
  zipSync({
    "word/document.xml": strToU8(wrapDocumentXml(bodyInnerXml)),
    ...(options?.footnotesXml
      ? { "word/footnotes.xml": strToU8(options.footnotesXml) }
      : {}),
    ...(options?.endnotesXml
      ? { "word/endnotes.xml": strToU8(options.endnotesXml) }
      : {}),
  });

test("parseNoteDefinitions：解析脚注/尾注正文并忽略分隔符注释", () => {
  const footnotes = parseNoteDefinitions(
    wrapNotesXml("footnote", `
      <w:footnote w:id="2">
        <w:p>
          <w:r><w:footnoteRef/></w:r>
          <w:r><w:t>脚注第一段</w:t></w:r>
        </w:p>
        <w:p><w:r><w:t>脚注第二段</w:t></w:r></w:p>
      </w:footnote>
    `),
    "footnote",
  );
  const endnotes = parseNoteDefinitions(
    wrapNotesXml("endnote", `
      <w:endnote w:id="7">
        <w:p><w:r><w:t>尾注正文</w:t></w:r></w:p>
      </w:endnote>
    `),
    "endnote",
  );

  assert.deepEqual(footnotes, [{
    id: "2",
    type: "footnote",
    content: "脚注第一段\n脚注第二段",
  }]);
  assert.deepEqual(endnotes, [{
    id: "7",
    type: "endnote",
    content: "尾注正文",
  }]);
});

test("parseDocx：回填段落脚注/尾注引用位置并关联定义存在性", () => {
  const model = parseDocx(makeDocx(`
    <w:p>
      <w:r><w:t>正文甲</w:t></w:r>
      <w:r><w:footnoteReference w:id="2"/></w:r>
      <w:r><w:t>与正文乙</w:t></w:r>
      <w:r><w:endnoteReference w:id="7"/></w:r>
    </w:p>
  `, {
    footnotesXml: wrapNotesXml("footnote", `
      <w:footnote w:id="2">
        <w:p><w:r><w:t>脚注正文</w:t></w:r></w:p>
      </w:footnote>
    `),
    endnotesXml: wrapNotesXml("endnote", `
      <w:endnote w:id="7">
        <w:p><w:r><w:t>尾注正文</w:t></w:r></w:p>
      </w:endnote>
    `),
  }));

  assert.deepEqual(model.noteDefinitions, [
    { id: "2", type: "footnote", content: "脚注正文" },
    { id: "7", type: "endnote", content: "尾注正文" },
  ]);
  assert.deepEqual(model.paragraphs[0]?.notes, [
    {
      id: "2",
      type: "footnote",
      runIndex: 1,
      hasDefinition: true,
    },
    {
      id: "7",
      type: "endnote",
      runIndex: 3,
      hasDefinition: true,
    },
  ]);
});

test("parseDocx：保留缺失定义的注释引用以供 validator 报错", () => {
  const model = parseDocx(makeDocx(`
    <w:p>
      <w:r><w:t>正文</w:t></w:r>
      <w:r><w:footnoteReference w:id="99"/></w:r>
    </w:p>
  `));

  assert.deepEqual(model.noteDefinitions, []);
  assert.deepEqual(model.paragraphs[0]?.notes, [{
    id: "99",
    type: "footnote",
    runIndex: 1,
    hasDefinition: false,
  }]);
});
