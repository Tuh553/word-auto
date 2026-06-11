import { test } from "node:test";
import assert from "node:assert/strict";
import { parseParaProps, parseRunProps, parseSectPr } from "./ooxml.js";

test("parseRunProps：主题字体引用回填实际字体", () => {
  const props = parseRunProps(
    {
      "w:rFonts": {
        "@_w:eastAsiaTheme": "minorEastAsia",
        "@_w:asciiTheme": "majorAscii",
      },
      "w:sz": { "@_w:val": "24" },
      "w:b": {},
    },
    {
      major: { latin: "Times New Roman", eastAsia: "黑体" },
      minor: { latin: "Calibri", eastAsia: "宋体" },
    },
  );

  assert.deepEqual(props, {
    fontEastAsia: "宋体",
    fontAscii: "Times New Roman",
    sizePt: 12,
    bold: true,
  });
});

test("parseParaProps：兼容带单位测量值与多种行距写法", () => {
  const props = parseParaProps({
    "w:jc": { "@_w:val": "both" },
    "w:ind": {
      "@_w:firstLine": "2cm",
      "@_w:hanging": "12pt",
      "@_w:leftChars": "200",
    },
    "w:spacing": {
      "@_w:lineRule": "exact",
      "@_w:line": "20pt",
      "@_w:before": "6pt",
      "@_w:after": "12pt",
    },
    "w:outlineLvl": { "@_w:val": "1" },
  });

  assert.equal(props.alignment, "both");
  assert.equal(props.firstLineIndentTwips, 1134);
  assert.equal(props.hangingIndentTwips, 240);
  assert.equal(props.leftIndentChars, 2);
  assert.deepEqual(props.lineSpacing, { value: 20, rule: "exact", pt: 20 });
  assert.equal(props.spacingBeforePt, 6);
  assert.equal(props.spacingAfterPt, 12);
  assert.equal(props.outlineLevel, 1);
});

test("parseSectPr：解析页边距、纸张与页码格式", () => {
  const section = parseSectPr({
    "w:pgSz": { "@_w:w": "21cm", "@_w:h": "29.7cm" },
    "w:pgMar": {
      "@_w:top": "3cm",
      "@_w:bottom": "2.5cm",
      "@_w:left": "85.05pt",
      "@_w:right": "85.05pt",
      "@_w:header": "1.6cm",
      "@_w:footer": "30pt",
      "@_w:gutter": "1cm",
    },
    "w:pgNumType": { "@_w:fmt": "upperRoman", "@_w:start": "1" },
  });

  assert.deepEqual(section, {
    pageWidthTwips: 11906,
    pageHeightTwips: 16838,
    marginTopTwips: 1701,
    marginBottomTwips: 1417,
    marginLeftTwips: 1701,
    marginRightTwips: 1701,
    headerTwips: 907,
    footerTwips: 600,
    gutterTwips: 567,
    pageNumberFormat: "upperRoman",
    pageNumberStart: 1,
  });
});
