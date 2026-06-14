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

export interface Bookmark {
  /** 书签 ID（w:id），可用于与 bookmarkEnd 对应；当前主要保留作调试信息 */
  id?: string;
  /** 书签名称（如 _Ref12345678） */
  name: string;
}

export interface Field {
  /** 域类型：REF / SEQ / PAGEREF / PAGE / HYPERLINK 等 */
  type: string;
  /** 完整域指令文本 */
  instruction: string;
  /** 域显示结果文本 */
  displayText: string;
  /** REF / PAGEREF 引用的书签 */
  bookmark?: string;
  /** SEQ 序列名，如 Figure / Table / Equation */
  sequence?: string;
  /** 域起始 run 索引（复杂域为 begin run，简单域为首个结果 run） */
  startRunIndex: number;
  /** 域结束 run 索引（复杂域为 end run，简单域为最后一个结果 run） */
  endRunIndex: number;
}

/** 段落内可用于分类/降噪的结构信号 */
export interface ParagraphStructure {
  /** 段落内 `w:drawing` 的出现次数（图片/图形等 DrawingML） */
  drawingCount: number;
  /** 段落内 OMML 公式节点（`m:oMath` / `m:oMathPara`）出现次数 */
  mathCount: number;
  /** 段落内嵌入对象容器（如 `w:object`）出现次数 */
  embeddedObjectCount: number;
}

/** 段落的编号引用（从 pPr/numPr 提取） */
export interface ParagraphNumbering {
  /** 编号实例 ID（关联到 numbering.xml 的 num） */
  numId: string;
  /** 当前段落使用的级别（0-8，对应 Word 的 1-9 级） */
  ilvl: number;
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
  /** 段落内定义的书签起点（w:bookmarkStart） */
  bookmarks?: Bookmark[];
  /** 段落中的结构化域结果（复杂域 + 简单域） */
  fields?: Field[];
  /** 段落级结构信号：辅助识别图题注、公式行等特殊正文元素 */
  structure: ParagraphStructure;
  /** 继承解析后的有效格式 */
  effective: EffectiveProps;
  /** 是否位于表格单元格内（w:tbl 内提取的段落） */
  inTable?: boolean;
  /** 编号引用（如果段落参与自动编号） */
  numbering?: ParagraphNumbering;
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

/** 编号级别定义（来自 numbering.xml） */
export interface NumberingLevel {
  /** 级别索引（0-8 对应 Word 的 1-9 级） */
  ilvl: number;
  /** 起始值（默认 1） */
  start: number;
  /** 格式类型 */
  numFmt: string;
  /** 编号文本模板（如 "%1."、"第%1章"、"%1.%2.%3"） */
  lvlText: string;
  /** 重启规则：每个上级编号变化时重启此级（如 3.1 → 3.2 → 4.1）；0=不重启 */
  lvlRestart?: number;
}

/** 抽象编号定义（abstractNum） */
export interface AbstractNumbering {
  abstractNumId: string;
  multiLevelType?: "multilevel" | "singleLevel" | "hybridMultilevel";
  levels: NumberingLevel[];
}

/** 编号实例（num） */
export interface NumberingInstance {
  numId: string;
  abstractNumId: string;
  lvlOverride?: Map<number, { start?: number }>;
}

/** numbering.xml 解析结果 */
export interface NumberingDefinitions {
  abstractNums: Map<string, AbstractNumbering>;
  nums: Map<string, NumberingInstance>;
}

/** 页眉/页脚内容所在的基础位置。 */
export type HeaderFooterAlignment = "left" | "center" | "right";

/** 页眉/页脚段落内的内容片段。 */
export interface HeaderFooterSegment {
  /** 普通文本或页码域结果 */
  kind: "text" | "pageNumber";
  /** 片段展示文本；页码域无结果文本时可为空 */
  text: string;
  /** 基于段落对齐、制表符或长空白推断的位置 */
  alignment: HeaderFooterAlignment;
  /** 域代码，如 PAGE */
  instruction?: string;
}

export interface HeaderFooterParagraph {
  text: string;
  leftText: string;
  centerText: string;
  rightText: string;
  alignment: HeaderFooterAlignment;
  hasPageNumber: boolean;
  segments: HeaderFooterSegment[];
}

/** 一个 header*.xml / footer*.xml 部件的结构化解析结果。 */
export interface HeaderFooterPart {
  kind: "header" | "footer";
  path: string;
  text: string;
  leftText: string;
  centerText: string;
  rightText: string;
  hasPageNumber: boolean;
  paragraphs: HeaderFooterParagraph[];
}

export interface DocModel {
  paragraphs: Paragraph[];
  styles: Map<string, StyleDef>;
  docDefaults: DocDefaults;
  /** 文档各分节的页面设置，按出现顺序；最后一个为正文主体节 */
  sections: SectionProps[];
  /** 各页眉（header*.xml）的纯文本，用于页眉内容检测 */
  headers: string[];
  /** 各页脚（footer*.xml）的纯文本，兼容文档级页码/页脚检测扩展 */
  footers?: string[];
  /** 结构化页眉部件；新逻辑应优先使用该字段，headers 仅保留兼容 */
  headerParts?: HeaderFooterPart[];
  /** 结构化页脚部件；包含 PAGE 页码域的基础识别 */
  footerParts?: HeaderFooterPart[];
  /** 编号定义（来自 numbering.xml） */
  numbering: NumberingDefinitions;
}
