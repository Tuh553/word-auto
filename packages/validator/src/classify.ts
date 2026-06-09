import type { Paragraph } from "@word-auto/parser";
import type { Role } from "./types.js";

/** 去除所有空白，便于标题文本精确匹配 */
const compact = (s: string): string => s.replace(/\s+/g, "");

type Section = "pre" | "cn_abstract" | "en_abstract" | "toc" | "body" | "references";

/**
 * 按文档顺序的状态机，给每个段落判定语义角色。
 * 信号优先级：标题关键词 > 大纲级别 > 样式名 > 当前所在章节。
 * 识别不出的（空段、目录条目等）返回 null，不参与校验。
 */
export const classifyParagraphs = (paras: Paragraph[]): (Role | null)[] => {
  let section: Section = "pre";
  const roles: (Role | null)[] = [];

  for (const p of paras) {
    const t = compact(p.text);
    if (!t) {
      roles.push(null);
      continue;
    }

    // 1. 章节标题关键词（同时切换章节状态）
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

    // 2. 目录条目（TOC1/2/3 样式）
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

    // 3. 关键词行
    if (/^关键词/.test(t)) {
      roles.push("keywords_cn");
      continue;
    }
    if (/^key\s*words/i.test(t)) {
      roles.push("keywords_en");
      continue;
    }

    // 4. 大纲级别（标题）
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

    // 4. 按当前章节归类正文
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
        roles.push(null); // 目录条目（TOC1/2/3）格式复杂，PoC 暂不校验
        break;
      default:
        roles.push("body_text");
    }
  }

  return roles;
};
