// 文档模型类型：把 .docx 抽象成段落 + 样式 + 有效格式。

/** run（文本游程）级格式 */
export interface RunProps {
  fontEastAsia?: string;
  fontAscii?: string;
  fontHAnsi?: string;
  /** 字号 pt（已由 half-point 换算） */
  sizePt?: number;
  bold?: boolean;
  italic?: boolean;
}

/** 行距 */
export interface LineSpacing {
  /** lineRule=auto 时为倍数（如 1.5）；exact/atLeast 时为 pt */
  value: number;
  rule: "auto" | "exact" | "atLeast";
  /** 便于直接比对：固定/最小行距的 pt 值（auto 时为 undefined） */
  pt?: number;
  /** auto 时的倍数（exact/atLeast 时为 undefined） */
  multiple?: number;
}

/** 段落级格式 */
export interface ParaProps {
  /** 段落引用的样式 id（仅出现在段落上，不在样式定义里） */
  styleId?: string;
  /** 对齐：left/center/right/both(两端对齐)/distribute 等 */
  alignment?: string;
  firstLineIndentTwips?: number;
  firstLineIndentChars?: number;
  hangingIndentTwips?: number;
  hangingIndentChars?: number;
  leftIndentTwips?: number;
  leftIndentChars?: number;
  lineSpacing?: LineSpacing;
  spacingBeforePt?: number;
  spacingAfterPt?: number;
  /** 大纲级别 0-8（对应 Word 1-9 级）；正文为 undefined（=正文级 9/“正文文本”） */
  outlineLevel?: number;
}

/** styles.xml 里的一个样式定义 */
export interface StyleDef {
  styleId: string;
  name?: string;
  type?: string; // paragraph | character | table | numbering
  basedOn?: string;
  para?: ParaProps;
  run?: RunProps;
}

/** 计算继承后得到的“有效格式”——校验就比对它 */
export interface EffectiveProps {
  fontEastAsia?: string;
  fontAscii?: string;
  sizePt?: number;
  bold?: boolean;
  alignment?: string;
  firstLineIndentChars?: number;
  firstLineIndentPt?: number;
  hangingIndentChars?: number;
  leftIndentChars?: number;
  lineSpacing?: LineSpacing;
  spacingBeforePt?: number;
  spacingAfterPt?: number;
  outlineLevel?: number;
}

export interface Run {
  text: string;
  props: RunProps;
}

export interface Paragraph {
  index: number;
  /** 段落引用的样式 id */
  styleId?: string;
  /** 段落引用样式的可读名（styles 表里查到的 name） */
  styleName?: string;
  /** 段落直接格式（pPr） */
  directPara: ParaProps;
  /** 段落标记的 run 直接格式（pPr/rPr） */
  markRun: RunProps;
  runs: Run[];
  /** 拼接后的纯文本 */
  text: string;
  /** 继承解析后的有效格式 */
  effective: EffectiveProps;
  /** 是否位于表格单元格内（w:tbl 内提取的段落） */
  inTable?: boolean;
}

export interface DocDefaults {
  para?: ParaProps;
  run?: RunProps;
}

/** 一个分节的页面设置（来自 sectPr），单位 twips */
export interface SectionProps {
  pageWidthTwips?: number;
  pageHeightTwips?: number;
  marginTopTwips?: number;
  marginBottomTwips?: number;
  marginLeftTwips?: number;
  marginRightTwips?: number;
  headerTwips?: number;
  footerTwips?: number;
  gutterTwips?: number;
  /** 页码格式：decimal / upperRoman / lowerRoman 等（缺省视为 decimal） */
  pageNumberFormat?: string;
  /** 页码起始值（pgNumType@start） */
  pageNumberStart?: number;
}

export interface DocModel {
  paragraphs: Paragraph[];
  styles: Map<string, StyleDef>;
  docDefaults: DocDefaults;
  /** 文档各分节的页面设置，按出现顺序；最后一个为正文主体节 */
  sections: SectionProps[];
  /** 各页眉（header*.xml）的纯文本，用于页眉内容检测 */
  headers: string[];
}
