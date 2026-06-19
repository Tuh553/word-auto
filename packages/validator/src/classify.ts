import type { Paragraph } from "@word-auto/parser";
import type {
  ClassifiedParagraphDetail,
  Role,
  RoleConfidence,
} from "./types.js";

/** 去除所有空白，便于标题文本精确匹配 */
const compact = (s: string): string => s.replace(/\s+/g, "");
const normalizeInline = (s: string): string => s.replace(/\s+/g, " ").trim();

/**
 * 封面/扉页特征字段。出现这些（且为短段落）大概率是封面页信息，
 * 而非正文——规则 scope 不含封面，应跳过校验。
 */
const COVER_HINT =
  /^(学生姓名|姓名|指导教师|导师|专业学位类别|专业名称|专业[:：]|研究方向|答辩委员会|主席|委员|授位时间|学号|分类号|密级|学校代码|论文提交日期|论文答辩日期|独创性声明|学位论文使用授权)|大学(博士|硕士)?(专业)?学位论文$/;

const ACK_HEADING =
  /^(致谢|鸣谢|acknowledg?ments?)$/i;
const APPENDIX_HEADING =
  /^(附录[A-Z0-9一二三四五六七八九十]*|appendix[A-Z0-9-]*)$/i;
const ACHIEVEMENT_HEADING =
  /^(攻读.*学位期间.*成果|攻读学位期间发表的学术成果|在学期间取得的研究成果)$/;
const FIGURE_CAPTION =
  /^(图|figure)\d+(?:[-－—.．]\d+)*[A-Za-z]*(?=\s|[:：]|$|[（(])/i;
const FIGURE_CAPTION_RELAXED = /^(续?图|figure)/i;
const TABLE_CAPTION =
  /^(表|table)\d+(?:[-－—.．]\d+)*[A-Za-z]*(?=\s|[:：]|$|[（(])/i;
const SOURCE_NOTE =
  /^(资料来源|数据来源|图源|表源|source[:：]|注[:：](资料|数据|图表?)来源)/i;
const EQUATION_NUMBER =
  /(?:\(|（)\d+(?:[-－—.．]\d+)*(?:\)|）)$/;
const MATH_OPERATOR =
  /[=+\-*/×÷≤≥≠≈∑∫√]/;
const APPENDIX_LIST_MARKER =
  /^(?:[（(]?[0-9一二三四五六七八九十]+[）).、．.]|[①②③④⑤⑥⑦⑧⑨⑩]|[-•·●▪◆◇■□])\s*\S+/;
const APPENDIX_MATERIAL_ITEM =
  /^(?:材料|附件|附表|附图)\s*[一二三四五六七八九十0-9]+(?:[:：\s]|$)/;
const APPENDIX_SIGNATURE_LABEL =
  /^(?:姓名|署名|作者|申请人|填表人|签名|日期|时间|地点|单位)[:：]\S{1,40}$/;
const APPENDIX_FULL_DATE =
  /^(?:[一-鿿]{2,8}\s*)?(?:20|19)\d{2}年\d{1,2}月\d{1,2}日$/;

type Section =
  | "cover"
  | "cn_abstract"
  | "en_abstract"
  | "toc"
  | "body"
  | "references"
  | "acknowledgement"
  | "appendix"
  | "achievement";

type BackMatterSection = Extract<Section, "acknowledgement" | "appendix" | "achievement">;
type BodySection = Extract<Section, "cn_abstract" | "en_abstract" | "references" | BackMatterSection | "toc" | "body">;
type SectionRole = { role: Role; section: Section };
type RoleDetail = {
  role: Role | null;
  confidence: RoleConfidence;
  reason?: string;
};

const TOC_ROLE_BY_STYLE_ID: Record<string, Role> = {
  toc1: "toc1",
  toc2: "toc2",
  toc3: "toc3",
};

const BODY_ROLE_BY_SECTION: Partial<Record<BodySection, Role | null>> = {
  cn_abstract: "abstract_body_cn",
  en_abstract: "abstract_body_en",
  references: "reference_body",
  acknowledgement: "acknowledgement_body",
  appendix: "appendix_body",
  achievement: "achievement_body",
  toc: null,
};

const headingLevel = (p: Paragraph): 0 | 1 | 2 | null => {
  const ol = p.effective.outlineLevel;
  const sn = (p.styleName ?? "").toLowerCase();
  if (ol === 0 || /heading\s*1|标题\s*1/.test(sn)) return 0;
  if (ol === 1 || /heading\s*2|标题\s*2/.test(sn)) return 1;
  if (ol === 2 || /heading\s*3|标题\s*3/.test(sn)) return 2;
  return null;
};

const backMatterHeading = (
  t: string,
): { role: Role; section: BackMatterSection } | null => {
  if (ACK_HEADING.test(t)) {
    return { role: "acknowledgement_heading", section: "acknowledgement" };
  }
  if (APPENDIX_HEADING.test(t)) {
    return { role: "appendix_heading", section: "appendix" };
  }
  if (ACHIEVEMENT_HEADING.test(t)) {
    return { role: "achievement_heading", section: "achievement" };
  }
  return null;
};

const hasDrawing = (p: Paragraph | undefined): boolean =>
  (p?.structure.drawingCount ?? 0) > 0;

const hasFormulaStructure = (p: Paragraph): boolean =>
  (p.structure.mathCount ?? 0) > 0 || (p.structure.embeddedObjectCount ?? 0) > 0;

const isAlignedCaption = (alignment: Paragraph["effective"]["alignment"]): boolean =>
  alignment === "center" || alignment === "left" || alignment === "right";

const isFigureCaption = (text: string): boolean =>
  FIGURE_CAPTION.test(text) && text.length <= 80;

const isRelaxedFigureCaption = (
  text: string,
  adjacentDrawing: boolean,
  alignment: Paragraph["effective"]["alignment"],
): boolean =>
  adjacentDrawing &&
  FIGURE_CAPTION_RELAXED.test(text) &&
  text.length <= 80 &&
  isAlignedCaption(alignment);

const isTableCaption = (text: string): boolean =>
  TABLE_CAPTION.test(text) && text.length <= 80;

const isSourceNote = (text: string): boolean =>
  SOURCE_NOTE.test(text) && text.length <= 120;

const isEquationLine = (
  text: string,
  p: Paragraph,
  alignment: Paragraph["effective"]["alignment"],
): boolean => {
  const cjkCount = (text.match(/[一-鿿]/g) ?? []).length;
  return EQUATION_NUMBER.test(text) &&
    (MATH_OPERATOR.test(text) || hasFormulaStructure(p)) &&
    cjkCount <= 4 &&
    (alignment === "center" || alignment === "right" || text.length <= 80);
};

const detail = (
  para: Paragraph,
  role: Role | null,
  confidence: RoleConfidence,
  reason?: string,
): ClassifiedParagraphDetail => ({
  para,
  role,
  confidence,
  reason,
});

const specialBodyRole = (
  paras: Paragraph[],
  index: number,
  p: Paragraph,
  t: string,
): RoleDetail | null => {
  const align = p.effective.alignment;
  const adjacentDrawing = hasDrawing(paras[index - 1]) || hasDrawing(paras[index + 1]);

  if (isRelaxedFigureCaption(t, adjacentDrawing, align)) {
    return {
      role: "figure_caption",
      confidence: "high",
      reason: "drawing 邻接结构信号支持图题注判断",
    };
  }
  if (isFigureCaption(t)) {
    return adjacentDrawing
      ? {
          role: "figure_caption",
          confidence: "high",
          reason: "drawing 邻接结构信号支持图题注判断",
        }
      : {
          role: "figure_caption",
          confidence: "low",
          reason: "仅按文本题注模式判断",
        };
  }
  if (isTableCaption(t)) {
    return {
      role: "table_caption",
      confidence: "low",
      reason: "仅按文本题注模式判断",
    };
  }
  if (isSourceNote(t)) {
    return {
      role: "source_note",
      confidence: "low",
      reason: "仅按资料来源文本模式判断",
    };
  }
  if (isEquationLine(t, p, align)) {
    return hasFormulaStructure(p)
      ? {
          role: "formula_line",
          confidence: "high",
          reason: "OMML 或嵌入对象结构信号支持公式行判断",
        }
      : {
          role: "formula_line",
          confidence: "low",
          reason: "仅按文本公式编号模式判断",
        };
  }
  return null;
};

const sectionHeadingRole = (text: string): SectionRole | null => {
  if (text === "摘要") return { role: "abstract_title_cn", section: "cn_abstract" };
  if (/^abstract$/i.test(text)) return { role: "abstract_title_en", section: "en_abstract" };
  if (text === "目录") return { role: "toc_title", section: "toc" };
  if (text === "参考文献") return { role: "reference_heading", section: "references" };
  return backMatterHeading(text);
};

const tocRole = (styleId?: string): Role | null =>
  TOC_ROLE_BY_STYLE_ID[(styleId ?? "").toLowerCase()] ?? null;

const keywordRole = (text: string): Role | null => {
  if (/^关键词/.test(text)) return "keywords_cn";
  if (/^key\s*words/i.test(text)) return "keywords_en";
  return null;
};

const outlineRole = (p: Paragraph): SectionRole | null => {
  const level = headingLevel(p);
  if (level === 0) return { role: "heading1", section: "body" };
  if (level === 1) return { role: "heading2", section: "body" };
  if (level === 2) return { role: "heading3", section: "body" };
  return null;
};

const isAppendixSubheading = (p: Paragraph, text: string): boolean =>
  headingLevel(p) !== null && text.length <= 80;

const isAppendixListItem = (p: Paragraph, text: string): boolean =>
  p.numbering != null ||
  APPENDIX_LIST_MARKER.test(text) ||
  APPENDIX_MATERIAL_ITEM.test(text);

const isAppendixSignature = (text: string): boolean =>
  text.length <= 50 &&
  (APPENDIX_SIGNATURE_LABEL.test(text) || APPENDIX_FULL_DATE.test(text));

const appendixRole = (p: Paragraph, text: string): RoleDetail | null => {
  if (isAppendixSubheading(p, text)) {
    return {
      role: "appendix_subheading",
      confidence: "high",
      reason: "附录上下文内由大纲级别或标题样式判断",
    };
  }
  if (isAppendixListItem(p, text)) {
    return {
      role: "appendix_list_item",
      confidence: p.numbering ? "high" : "medium",
      reason: p.numbering ? "附录上下文内由自动编号判断" : "附录上下文内由清单文本模式判断",
    };
  }
  if (isAppendixSignature(text)) {
    return {
      role: "appendix_signature",
      confidence: "medium",
      reason: "附录上下文内由短落款或日期模式判断",
    };
  }
  return null;
};

const bodyRoleForSection = (section: BodySection, text: string): RoleDetail => {
  if (section !== "body") {
    return {
      role: BODY_ROLE_BY_SECTION[section] ?? null,
      confidence: "high",
      reason: "由明确章节上下文判断",
    };
  }
  if (COVER_HINT.test(text) && text.length < 25) {
    return {
      role: null,
      confidence: "medium",
      reason: "疑似封面字段，跳过正文规则",
    };
  }
  return {
    role: "body_text",
    confidence: "high",
    reason: "由正文标题上下文判断",
  };
};

/**
 * 按文档顺序的状态机，给每个段落判定语义角色。
 * 信号优先级：章节标题关键词 > 封面区 > 目录样式 > 大纲级别 > 当前章节。
 * 文档开头到第一个「摘要」之间视为封面/扉页区，整体跳过（规则 scope 不含封面）。
 * 识别不出的（空段、目录条目等）返回 null，不参与校验。
 */
export const classifyParagraphDetails = (paras: Paragraph[]): ClassifiedParagraphDetail[] => {
  let section: Section = "cover";
  const out: ClassifiedParagraphDetail[] = [];

  for (let i = 0; i < paras.length; i += 1) {
    const p = paras[i];
    // 表格单元格段落：独立角色，不参与正文章节状态机
    if (p.inTable) {
      out.push(detail(p, "table_cell", "high", "表格单元格结构标记"));
      continue;
    }
    const compactText = compact(p.text);
    if (!compactText) {
      out.push(detail(p, null, "high", "空段落"));
      continue;
    }
    const inlineText = normalizeInline(p.text);

    const sectionHeading = sectionHeadingRole(compactText);
    if (sectionHeading) {
      section = sectionHeading.section;
      out.push(detail(p, sectionHeading.role, "high", "明确章节标题关键词命中"));
      continue;
    }

    if (section === "cover") {
      out.push(detail(p, null, "high", "摘要前封面区跳过"));
      continue;
    }

    const toc = tocRole(p.styleId);
    if (toc) {
      out.push(detail(p, toc, "high", "目录样式明确命中"));
      continue;
    }

    const keyword = keywordRole(compactText);
    if (keyword) {
      out.push(detail(p, keyword, "medium", "关键词文本模式命中"));
      continue;
    }

    if (section === "appendix") {
      const appendixDetail = appendixRole(p, compactText);
      if (appendixDetail) {
        out.push(detail(p, appendixDetail.role, appendixDetail.confidence, appendixDetail.reason));
        continue;
      }
    }

    const outline = outlineRole(p);
    if (outline) {
      section = outline.section;
      out.push(detail(p, outline.role, "high", "大纲级别或标题样式明确命中"));
      continue;
    }

    if (section === "body") {
      const special = specialBodyRole(paras, i, p, inlineText);
      if (special) {
        out.push(detail(p, special.role, special.confidence, special.reason));
        continue;
      }
    }

    const body = bodyRoleForSection(section, compactText);
    out.push(detail(p, body.role, body.confidence, body.reason));
  }

  return out;
};

export const classifyParagraphs = (paras: Paragraph[]): (Role | null)[] =>
  classifyParagraphDetails(paras).map((item) => item.role);
