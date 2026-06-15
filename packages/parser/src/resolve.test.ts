import { test } from "node:test";
import assert from "node:assert/strict";
import { computeEffective } from "./resolve.js";
import { parseStyles } from "./styles.js";
import type { Paragraph } from "./types.js";

const mkParagraph = (): Paragraph => ({
  index: 0,
  styleId: undefined,
  styleName: undefined,
  directPara: {},
  markRun: {},
  runs: [{ text: "正文内容", props: {} }],
  text: "正文内容",
  structure: { drawingCount: 0, mathCount: 0, embeddedObjectCount: 0 },
  effective: {},
});

test("computeEffective：无 pStyle 段落继承默认 paragraph style", () => {
  const { styles, docDefaults, defaultParagraphStyleId } = parseStyles(`
    <w:styles xmlns:w="w">
      <w:style w:type="paragraph" w:styleId="Base">
        <w:rPr>
          <w:sz w:val="28" />
        </w:rPr>
      </w:style>
      <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
        <w:basedOn w:val="Base" />
        <w:pPr>
          <w:jc w:val="both" />
        </w:pPr>
      </w:style>
    </w:styles>
  `);

  const effective = computeEffective(
    mkParagraph(),
    styles,
    docDefaults,
    defaultParagraphStyleId,
  );

  assert.equal(defaultParagraphStyleId, "Normal");
  assert.equal(effective.alignment, "both");
  assert.equal(effective.sizePt, 14);
});
