import { useEffect, useRef } from "react";
import { renderAsync } from "docx-preview";

interface Props {
  buffer: ArrayBuffer;
  /** 要定位高亮的段落原文（文档级问题为 null，不定位） */
  targetText: string | null;
}

const norm = (s: string | null | undefined): string =>
  (s ?? "").replace(/\s+/g, "");

export function PreviewPanel({ buffer, targetText }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // 全量渲染：保留页眉/页脚/分页/字体，尽量贴近 Word 原貌。
  // 渲染到游离节点，完成后整体挂载；stale 标志丢弃过期渲染，
  // 避免 StrictMode/快速切换下两次 renderAsync 并发造成「重影」。
  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    let stale = false;
    const mount = document.createElement("div");
    renderAsync(buffer.slice(0), mount, undefined, {
      className: "docx",
      inWrapper: true,
      ignoreWidth: false,
      ignoreHeight: false,
      ignoreFonts: false,
      breakPages: true,
      ignoreLastRenderedPageBreak: true,
      experimental: true,
      useBase64URL: true,
      renderHeaders: true,
      renderFooters: true,
      renderFootnotes: true,
      renderEndnotes: true,
    })
      .then(() => {
        if (stale) return;
        host.replaceChildren(mount);
      })
      .catch((e: unknown) => {
        if (!stale) host.textContent = "预览渲染失败：" + (e as Error).message;
      });
    return () => {
      stale = true;
    };
  }, [buffer]);

  // 按段落原文匹配定位（不依赖序号，避免与渲染 DOM 错位）
  useEffect(() => {
    const el = ref.current;
    if (!el || !targetText) return;
    const key = norm(targetText).slice(0, 18);
    if (key.length < 3) return;

    el.querySelectorAll(".wa-hl").forEach((n) => n.classList.remove("wa-hl"));
    const blocks = el.querySelectorAll("p, h1, h2, h3, h4, h5, h6, td, li");
    for (const b of Array.from(blocks)) {
      if (norm(b.textContent).includes(key)) {
        b.classList.add("wa-hl");
        b.scrollIntoView({ behavior: "smooth", block: "center" });
        break;
      }
    }
  }, [targetText]);

  return <div className="preview" ref={ref} />;
}
