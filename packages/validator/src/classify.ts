import type { Paragraph } from "@word-auto/parser";
import type { Role } from "./types.js";

/** 去除所有空白，便于标题文本精确匹配 */
const compact = (s: string): string => s.replace(/\s+/g, "");

/**
 * 封面/扉页特征字段。出现这些（且为短段落）大概率是封面页信息，
 * 而非正文——规则 scope 不含封面，应跳过校验。
 */
const COVER_HINT =
  /^(学生姓名|姓名|指导教师|导师|专业学位类别|专业名称|专业[:：]|研究方向|答辩委员会|主席|委员|授位时间|学号|分类号|密级|学校代码|论文提交日期|论文答辩日期|独创性声明|学位论文使用授权)|大学(博士|硕士)?(专业)?学位论文$/;

type Section =
  | "cover"
  | "cn_abstract"
  | "en_abstract"
  | "toc"
  | "body"
  | "references";

/**
 * 按文档顺序的状态机，给每个段落判定语义角色。
 * 信号优先级：章节标题关键词 > 封面区 > 目录样式 > 大纲级别 > 当前章节。
 * 文档开头到第一个「摘要」之间视为封面/扉页区，整体跳过（规则 scope 不含封面）。
 * 识别不出的（空段、目录条目等）返回 null，不参与校验。
 */
export const classifyParagraphs = (paras: Paragraph[]): (Role | null)[] => {
  let section: Section = "cover";
  const roles: (Role | null)[] = [];

  for (const p of paras) {
    const t = compact(p.text);
    if (!t) {
      roles.push(null);
      continue;
    }

    // 1. 章节标题关键词（任何时候都能切换章节，是离开封面区的边界）
    if (t === "摘要") {
      section = "cn_abstract";
      roles.push("abstract_title_cn");
      continue;
    }
    if (/^abstract$/i.test(t)) {
      section = "en_abstract";
      roles.push("abstract_title_en");
      continue;
    }
    if (t === "目录") {
      section = "toc";
      roles.push("toc_title");
      continue;
    }
    if (t === "参考文献") {
      section = "references";
      roles.push("reference_heading");
      continue;
    }

    // 2. 封面/扉页区：遇到「摘要」之前的一切（标题页、声明、授权书）整体跳过
    if (section === "cover") {
      roles.push(null);
      continue;
    }

    // 3. 目录条目（TOC1/2/3 样式）
    const sid = (p.styleId ?? "").toLowerCase();
    if (sid === "toc1") {
      roles.push("toc1");
      continue;
    }
    if (sid === "toc2") {
      roles.push("toc2");
      continue;
    }
    if (sid === "toc3") {
      roles.push("toc3");
      continue;
    }

    // 4. 关键词行
    if (/^关键词/.test(t)) {
      roles.push("keywords_cn");
      continue;
    }
    if (/^key\s*words/i.test(t)) {
      roles.push("keywords_en");
      continue;
    }

    // 5. 大纲级别（标题）
    const ol = p.effective.outlineLevel;
    const sn = (p.styleName ?? "").toLowerCase();
    if (ol === 0 || /heading\s*1|标题\s*1/.test(sn)) {
      section = "body";
      roles.push("heading1");
      continue;
    }
    if (ol === 1 || /heading\s*2|标题\s*2/.test(sn)) {
      roles.push("heading2");
      continue;
    }
    if (ol === 2 || /heading\s*3|标题\s*3/.test(sn)) {
      roles.push("heading3");
      continue;
    }

    // 6. 按当前章节归类正文
    switch (section) {
      case "cn_abstract":
        roles.push("abstract_body_cn");
        break;
      case "en_abstract":
        roles.push("abstract_body_en");
        break;
      case "references":
        roles.push("reference_body");
        break;
      case "toc":
        roles.push(null); // 目录条目里非 TOC 样式的内容，暂不校验
        break;
      default:
        // 正文兜底：短段落且命中封面特征字段（异常排版的封面信息）也跳过
        if (COVER_HINT.test(t) && t.length < 25) {
          roles.push(null);
        } else {
          roles.push("body_text");
        }
    }
  }

  return roles;
};
